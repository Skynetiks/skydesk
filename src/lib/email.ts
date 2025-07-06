import nodemailer from "nodemailer";
import {
  SESClient,
  SendEmailCommand,
  VerifyEmailIdentityCommand,
  SendRawEmailCommand,
} from "@aws-sdk/client-ses";
import { db } from "@/server/db";

interface Attachment {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
}

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  headers?: Record<string, string>; // Custom headers for threading
  attachments?: Attachment[];
}

// Get email configuration from database
async function getEmailConfig() {
  const configs = await db.configuration.findMany({
    where: {
      key: {
        in: [
          "EMAIL_PROVIDER",
          "EMAIL_HOST",
          "EMAIL_PORT",
          "EMAIL_USER",
          "EMAIL_PASS",
          "SENDER_EMAIL",
          "AWS_REGION",
          "AWS_ACCESS_KEY_ID",
          "AWS_SECRET_ACCESS_KEY",
          "AWS_SES_SENDER_EMAIL",
        ],
      },
    },
  });

  const configMap = configs.reduce((acc, config) => {
    acc[config.key] = config.value;
    return acc;
  }, {} as Record<string, string>);

  console.log("Email config retrieved from database:", {
    provider: configMap.EMAIL_PROVIDER,
    host: configMap.EMAIL_HOST,
    port: configMap.EMAIL_PORT,
    user: configMap.EMAIL_USER,
    hasPassword: !!configMap.EMAIL_PASS,
    senderEmail: configMap.SENDER_EMAIL,
    awsRegion: configMap.AWS_REGION,
    hasAwsAccessKey: !!configMap.AWS_ACCESS_KEY_ID,
    hasAwsSecretKey: !!configMap.AWS_SECRET_ACCESS_KEY,
    awsSenderEmail: configMap.AWS_SES_SENDER_EMAIL,
  });

  return configMap;
}

// Create AWS SES client
function createSESClient(config: Record<string, string>) {
  if (
    !config.AWS_REGION ||
    !config.AWS_ACCESS_KEY_ID ||
    !config.AWS_SECRET_ACCESS_KEY
  ) {
    throw new Error("Missing AWS SES configuration");
  }

  return new SESClient({
    region: config.AWS_REGION,
    credentials: {
      accessKeyId: config.AWS_ACCESS_KEY_ID,
      secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
    },
  });
}

// Create transporter with database config (for SMTP)
async function createTransporter() {
  const config = await getEmailConfig();
  const provider = config.EMAIL_PROVIDER || "smtp";

  if (provider === "aws") {
    // For AWS SES, we'll use the SES client directly, not nodemailer transporter
    throw new Error("AWS SES uses direct client, not nodemailer transporter");
  } else {
    // SMTP configuration
    if (!config.EMAIL_HOST || !config.EMAIL_USER || !config.EMAIL_PASS) {
      console.error("Missing SMTP configuration:", {
        hasHost: !!config.EMAIL_HOST,
        hasUser: !!config.EMAIL_USER,
        hasPassword: !!config.EMAIL_PASS,
      });
      throw new Error("SMTP configuration not found in database");
    }

    console.log("Creating SMTP transporter with config:", {
      host: config.EMAIL_HOST,
      port: parseInt(config.EMAIL_PORT || "587"),
      user: config.EMAIL_USER,
      secure: false,
    });

    const transporter = nodemailer.createTransport({
      host: config.EMAIL_HOST,
      port: parseInt(config.EMAIL_PORT || "587"),
      secure: false, // true for 465, false for other ports
      auth: {
        user: config.EMAIL_USER,
        pass: config.EMAIL_PASS,
      },
    });

    // Test the connection immediately
    try {
      console.log("Testing SMTP connection...");
      await transporter.verify();
      console.log("SMTP connection verified successfully");
    } catch (error) {
      console.error("SMTP connection test failed:", error);
      throw new Error(
        `SMTP connection failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    return transporter;
  }
}

// Helper function to create MIME message with attachments
function createMimeMessage({
  from,
  to,
  subject,
  text,
  html,
  attachments,
  headers,
}: {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
  headers?: Record<string, string>;
}) {
  const boundary = `----=_NextPart_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;

  let mimeMessage = "";

  // Headers
  mimeMessage += `From: ${from}\r\n`;
  mimeMessage += `To: ${to}\r\n`;
  mimeMessage += `Subject: ${subject}\r\n`;
  mimeMessage += `MIME-Version: 1.0\r\n`;
  mimeMessage += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n`;

  // Add custom headers
  if (headers) {
    Object.entries(headers).forEach(([key, value]) => {
      mimeMessage += `${key}: ${value}\r\n`;
    });
  }

  mimeMessage += "\r\n";

  // Text/HTML part
  mimeMessage += `--${boundary}\r\n`;
  mimeMessage += `Content-Type: multipart/alternative; boundary="${boundary}_alt"\r\n\r\n`;

  // Text part
  mimeMessage += `--${boundary}_alt\r\n`;
  mimeMessage += `Content-Type: text/plain; charset=UTF-8\r\n`;
  mimeMessage += `Content-Transfer-Encoding: 7bit\r\n\r\n`;
  mimeMessage += `${text}\r\n\r\n`;

  // HTML part (if provided)
  if (html) {
    mimeMessage += `--${boundary}_alt\r\n`;
    mimeMessage += `Content-Type: text/html; charset=UTF-8\r\n`;
    mimeMessage += `Content-Transfer-Encoding: 7bit\r\n\r\n`;
    mimeMessage += `${html}\r\n\r\n`;
  }

  mimeMessage += `--${boundary}_alt--\r\n\r\n`;

  // Attachments
  attachments.forEach((attachment) => {
    mimeMessage += `--${boundary}\r\n`;
    mimeMessage += `Content-Type: ${attachment.contentType}; name="${attachment.filename}"\r\n`;
    mimeMessage += `Content-Disposition: attachment; filename="${attachment.filename}"\r\n`;
    mimeMessage += `Content-Transfer-Encoding: base64\r\n\r\n`;
    mimeMessage += `${attachment.content.toString("base64")}\r\n\r\n`;
  });

  mimeMessage += `--${boundary}--\r\n`;

  return mimeMessage;
}

// Helper function to process attachments
async function processAttachments(attachments: Attachment[] = []) {
  console.log(`Processing ${attachments.length} attachments...`);
  const processedAttachments = [];

  for (const attachment of attachments) {
    try {
      console.log(
        `Processing attachment: ${attachment.originalName} (${attachment.mimeType}, ${attachment.size} bytes)`
      );

      // Handle base64 data URLs
      if (attachment.url.startsWith("data:")) {
        const [, base64Data] = attachment.url.split(",");
        const fileBuffer = Buffer.from(base64Data, "base64");

        console.log(
          `Successfully processed attachment: ${attachment.originalName} (${fileBuffer.length} bytes)`
        );

        processedAttachments.push({
          filename: attachment.originalName,
          content: fileBuffer,
          contentType: attachment.mimeType,
        });
      } else {
        // Handle regular URLs (fallback for existing attachments)
        console.warn(
          `Skipping attachment ${attachment.originalName} - not a data URL`
        );
      }
    } catch (error) {
      console.error(
        `Failed to process attachment ${attachment.originalName}:`,
        error
      );
      // Continue with other attachments even if one fails
    }
  }

  console.log(
    `Successfully processed ${processedAttachments.length} out of ${attachments.length} attachments`
  );
  return processedAttachments;
}

export async function sendEmail(options: EmailOptions) {
  console.log("sendEmail called with options:", {
    to: options.to,
    subject: options.subject,
    hasHtml: !!options.html,
    hasText: !!options.text,
    attachmentsCount: options.attachments?.length || 0,
  });

  const config = await getEmailConfig();
  const provider = config.EMAIL_PROVIDER || "smtp";

  if (provider === "aws") {
    // Use AWS SES client directly
    console.log("Using AWS SES provider...");
    const sesClient = createSESClient(config);
    const senderEmail = config.AWS_SES_SENDER_EMAIL || config.AWS_ACCESS_KEY_ID;

    console.log("AWS SES configuration:", {
      region: config.AWS_REGION,
      senderEmail: senderEmail,
      hasAccessKey: !!config.AWS_ACCESS_KEY_ID,
      hasSecretKey: !!config.AWS_SECRET_ACCESS_KEY,
    });

    // Check if sender email is verified
    try {
      console.log("Checking if sender email is verified in AWS SES...");
      const verifyCommand = new VerifyEmailIdentityCommand({
        EmailAddress: senderEmail,
      });
      await sesClient.send(verifyCommand);
      console.log("Sender email verification check completed");
    } catch (verifyError) {
      console.error("Sender email verification failed:", verifyError);
      // This might be expected if the email is already verified, so we continue
    }

    // Process attachments if any
    const processedAttachments = await processAttachments(options.attachments);

    if (processedAttachments.length > 0) {
      // Use SendRawEmailCommand for emails with attachments
      console.log("Sending email with attachments via AWS SES SendRawEmail...");

      // Create MIME message with attachments
      const mimeMessage = createMimeMessage({
        from: senderEmail,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: processedAttachments,
        headers: options.headers,
      });

      const rawCommand = new SendRawEmailCommand({
        RawMessage: {
          Data: Buffer.from(mimeMessage),
        },
      });

      try {
        const result = await sesClient.send(rawCommand);
        console.log(
          "Email with attachments sent successfully via AWS SES:",
          result.MessageId
        );
        return result;
      } catch (error) {
        console.error(
          "Error sending email with attachments via AWS SES:",
          error
        );
        throw error;
      }
    } else {
      // Use SendEmailCommand for emails without attachments
      console.log("Sending email without attachments via AWS SES SendEmail...");

      const command = new SendEmailCommand({
        Source: senderEmail,
        Destination: {
          ToAddresses: [options.to],
        },
        Message: {
          Subject: {
            Data: options.subject,
            Charset: "UTF-8",
          },
          Body: {
            Text: {
              Data: options.text,
              Charset: "UTF-8",
            },
            ...(options.html && {
              Html: {
                Data: options.html,
                Charset: "UTF-8",
              },
            }),
          },
        },
      });

      try {
        console.log("SES command:", JSON.stringify(command, null, 2));
        const result = await sesClient.send(command);
        console.log("Email sent successfully via AWS SES:", result.MessageId);
        return result;
      } catch (error) {
        console.error("Error sending email via AWS SES:", error);
        throw error;
      }
    }
  } else {
    // Use nodemailer for SMTP
    const transporter = await createTransporter();
    const senderEmail = config.SENDER_EMAIL || config.EMAIL_USER;

    // Process attachments if any
    const processedAttachments = await processAttachments(options.attachments);

    const mailOptions = {
      from: senderEmail,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html || options.text,
      headers: options.headers || {},
      attachments: processedAttachments,
    };

    console.log("Mail options prepared:", {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
      hasHtml: !!mailOptions.html,
      hasText: !!mailOptions.text,
      attachmentsCount: processedAttachments.length,
      provider,
    });

    if (processedAttachments.length > 0) {
      console.log(
        "Attachments to be sent:",
        processedAttachments.map((a) => ({
          filename: a.filename,
          contentType: a.contentType,
          size: a.content.length,
        }))
      );
    }

    try {
      console.log("Attempting to send email via SMTP...");
      const info = await transporter.sendMail(mailOptions);
      console.log("Email sent successfully via SMTP:", info.messageId);
      return info;
    } catch (error) {
      console.error("Error sending email via SMTP:", error);
      throw error;
    }
  }
}

// Verify transporter connection
export async function verifyEmailConnection() {
  try {
    const config = await getEmailConfig();
    const provider = config.EMAIL_PROVIDER || "smtp";

    console.log("Testing email connection for provider:", provider);

    if (provider === "aws") {
      // Test AWS SES connection
      const sesClient = createSESClient(config);

      // Try to verify the sender email identity (this will test the connection)
      const verifyCommand = new VerifyEmailIdentityCommand({
        EmailAddress: config.AWS_SES_SENDER_EMAIL || config.AWS_ACCESS_KEY_ID,
      });

      console.log("Testing AWS SES connection...");
      await sesClient.send(verifyCommand);

      console.log("AWS SES connection verified successfully");
      return true;
    } else {
      // Test SMTP connection
      const transporter = await createTransporter();

      console.log("Testing SMTP connection...");
      await transporter.verify();

      console.log("SMTP connection verified successfully");
      return true;
    }
  } catch (error) {
    console.error("Email server connection failed:", error);

    // Provide more specific error information
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
      });
    }

    return false;
  }
}
