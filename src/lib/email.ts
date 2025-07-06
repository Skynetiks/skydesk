import nodemailer from "nodemailer";
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
          "AWS_SES_SMTP_USERNAME",
          "AWS_SES_SMTP_PASSWORD",
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
    hasAwsSmtpUsername: !!configMap.AWS_SES_SMTP_USERNAME,
    hasAwsSmtpPassword: !!configMap.AWS_SES_SMTP_PASSWORD,
    awsSenderEmail: configMap.AWS_SES_SENDER_EMAIL,
  });

  return configMap;
}

// Create transporter with database config
async function createTransporter() {
  const config = await getEmailConfig();
  const provider = config.EMAIL_PROVIDER || "smtp";

  if (provider === "aws") {
    // AWS SES configuration
    if (
      !config.AWS_REGION ||
      !config.AWS_SES_SMTP_USERNAME ||
      !config.AWS_SES_SMTP_PASSWORD
    ) {
      console.error("Missing AWS SES configuration:", {
        hasRegion: !!config.AWS_REGION,
        hasSmtpUsername: !!config.AWS_SES_SMTP_USERNAME,
        hasSmtpPassword: !!config.AWS_SES_SMTP_PASSWORD,
      });
      throw new Error("AWS SES configuration not found in database");
    }

    console.log("Creating AWS SES transporter with config:", {
      region: config.AWS_REGION,
      hasSmtpUsername: !!config.AWS_SES_SMTP_USERNAME,
      hasSmtpPassword: !!config.AWS_SES_SMTP_PASSWORD,
    });

    return nodemailer.createTransport({
      host: `email-smtp.${config.AWS_REGION}.amazonaws.com`,
      port: 587,
      secure: false,
      auth: {
        user: config.AWS_SES_SMTP_USERNAME,
        pass: config.AWS_SES_SMTP_PASSWORD,
      },
    });
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

  const transporter = await createTransporter();
  const config = await getEmailConfig();
  const provider = config.EMAIL_PROVIDER || "smtp";

  // Determine sender email based on provider
  let senderEmail: string;
  if (provider === "aws") {
    senderEmail = config.AWS_SES_SENDER_EMAIL || config.AWS_SES_SMTP_USERNAME;
  } else {
    senderEmail = config.SENDER_EMAIL || config.EMAIL_USER;
  }

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
    console.log("Attempting to send email...");
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}

// Verify transporter connection
export async function verifyEmailConnection() {
  try {
    const transporter = await createTransporter();
    await transporter.verify();
    console.log("Email server connection verified");
    return true;
  } catch (error) {
    console.error("Email server connection failed:", error);
    return false;
  }
}
