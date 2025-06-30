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
          "EMAIL_HOST",
          "EMAIL_PORT",
          "EMAIL_USER",
          "EMAIL_PASS",
          "SUPPORT_EMAIL",
        ],
      },
    },
  });

  const configMap = configs.reduce((acc, config) => {
    acc[config.key] = config.value;
    return acc;
  }, {} as Record<string, string>);

  return configMap;
}

// Create transporter with database config
async function createTransporter() {
  const config = await getEmailConfig();

  if (!config.EMAIL_HOST || !config.EMAIL_USER || !config.EMAIL_PASS) {
    throw new Error("Email configuration not found in database");
  }

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

export async function sendEmail(options: EmailOptions) {
  const transporter = await createTransporter();
  const config = await getEmailConfig();

  const mailOptions = {
    from: config.SUPPORT_EMAIL || config.EMAIL_USER,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html || options.text,
    headers: options.headers || {},
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.messageId);
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
