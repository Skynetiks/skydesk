import nodemailer from "nodemailer";
import {
  SESClient,
  SendEmailCommand,
  VerifyEmailIdentityCommand,
} from "@aws-sdk/client-ses";
import { db } from "@/server/db";

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  headers?: Record<string, string>; // Custom headers for threading
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

    return nodemailer.createTransport({
      host: config.EMAIL_HOST,
      port: parseInt(config.EMAIL_PORT || "587"),
      secure: false, // true for 465, false for other ports
      auth: {
        user: config.EMAIL_USER,
        pass: config.EMAIL_PASS,
      },
    });
  }
}

export async function sendEmail(options: EmailOptions) {
  console.log("sendEmail called with options:", {
    to: options.to,
    subject: options.subject,
    hasHtml: !!options.html,
    hasText: !!options.text,
  });

  const config = await getEmailConfig();
  const provider = config.EMAIL_PROVIDER || "smtp";

  if (provider === "aws") {
    // Use AWS SES client directly
    const sesClient = createSESClient(config);
    const senderEmail = config.AWS_SES_SENDER_EMAIL || config.AWS_ACCESS_KEY_ID;

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
      console.log("Sending email via AWS SES...");
      const result = await sesClient.send(command);
      console.log("Email sent successfully via AWS SES:", result.MessageId);
      return result;
    } catch (error) {
      console.error("Error sending email via AWS SES:", error);
      throw error;
    }
  } else {
    // Use nodemailer for SMTP
    const transporter = await createTransporter();
    const senderEmail = config.SENDER_EMAIL || config.EMAIL_USER;

    const mailOptions = {
      from: senderEmail,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html || options.text,
      headers: options.headers || {},
    };

    console.log("Mail options prepared:", {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
      hasHtml: !!mailOptions.html,
      hasText: !!mailOptions.text,
      provider,
    });

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
