import { db } from "@/server/db";

export interface EmailTemplateData {
  companyName?: string;
  companyLogo?: string;
  companyWebsite?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
}

export async function getCompanyBranding(): Promise<EmailTemplateData> {
  try {
    const configs = await db.configuration.findMany({
      where: {
        key: {
          in: [
            "COMPANY_NAME",
            "COMPANY_LOGO",
            "COMPANY_WEBSITE",
            "COMPANY_ADDRESS",
            "COMPANY_PHONE",
            "COMPANY_EMAIL",
          ],
        },
      },
    });

    const branding: EmailTemplateData = {};

    configs.forEach((config) => {
      switch (config.key) {
        case "COMPANY_NAME":
          branding.companyName = config.value;
          break;
        case "COMPANY_LOGO":
          branding.companyLogo = config.value;
          break;
        case "COMPANY_WEBSITE":
          branding.companyWebsite = config.value;
          break;
        case "COMPANY_ADDRESS":
          branding.companyAddress = config.value;
          break;
        case "COMPANY_PHONE":
          branding.companyPhone = config.value;
          break;
        case "COMPANY_EMAIL":
          branding.companyEmail = config.value;
          break;
      }
    });

    return branding;
  } catch (error) {
    console.error("Error fetching company branding:", error);
    return {};
  }
}

export function generateEmailHeader(branding: EmailTemplateData): string {
  const logoHtml = branding.companyLogo
    ? `<img src="${branding.companyLogo}" alt="${
        branding.companyName || "Company Logo"
      }" style="max-height: 60px; max-width: 200px; object-fit: contain;">`
    : `<h1 style="color: #374151; margin: 0; font-size: 24px; font-weight: bold;">${
        branding.companyName || "Support Team"
      }</h1>`;

  return `
    <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-bottom: 1px solid #e5e7eb;">
      ${logoHtml}
    </div>
  `;
}

export function generateEmailFooter(branding: EmailTemplateData): string {
  const contactInfo = [];

  if (branding.companyWebsite) {
    contactInfo.push(
      `<a href="${branding.companyWebsite}" style="color: #374151; text-decoration: none;">${branding.companyWebsite}</a>`
    );
  }

  if (branding.companyPhone) {
    contactInfo.push(
      `<span style="color: #6b7280;">Phone: ${branding.companyPhone}</span>`
    );
  }

  if (branding.companyEmail) {
    contactInfo.push(
      `<a href="mailto:${branding.companyEmail}" style="color: #374151; text-decoration: none;">${branding.companyEmail}</a>`
    );
  }

  const contactHtml =
    contactInfo.length > 0
      ? `<div style="margin-top: 10px; font-size: 12px; color: #6b7280;">
         ${contactInfo.join(" • ")}
       </div>`
      : "";

  return `
    <div style="background-color: #f9fafb; padding: 20px; border-top: 1px solid #e5e7eb; margin-top: 20px;">
      <div style="text-align: center; color: #6b7280; font-size: 14px;">
        <p style="margin: 0 0 5px 0;">
          <strong style="color: #374151;">${
            branding.companyName || "Support Team"
          }</strong>
        </p>
        ${
          branding.companyAddress
            ? `<p style="margin: 0 0 10px 0; font-size: 12px;">${branding.companyAddress}</p>`
            : ""
        }
        ${contactHtml}
        <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af;">
          <p style="margin: 0;">
            This email was sent from our support system. This email thread is linked to your support ticket.
          </p>
          <p style="margin: 5px 0 0 0;">
            © ${new Date().getFullYear()} ${
    branding.companyName || "Support Team"
  }. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  `;
}

export function generateEmailTemplate(
  content: string,
  branding: EmailTemplateData,
  title?: string
): string {
  const header = generateEmailHeader(branding);
  const footer = generateEmailFooter(branding);

  const titleHtml = title
    ? `<h2 style="color: #111827; margin: 0 0 20px 0; font-size: 20px; font-weight: 600;">${title}</h2>`
    : "";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title || "Support Notification"}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #374151; margin: 0; padding: 0; background-color: #ffffff;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; overflow: hidden;">
        ${header}
        
        <div style="padding: 30px;">
          ${titleHtml}
          <div style="color: #374151; line-height: 1.6;">
            ${content}
          </div>
        </div>
        
        ${footer}
      </div>
    </body>
    </html>
  `;
}

// Specific email templates
export async function generateTicketConfirmationEmail(
  ticketId: string,
  subject: string,
  content: string,
  priority: string = "Medium"
): Promise<{ html: string; text: string }> {
  const branding = await getCompanyBranding();

  const emailContent = `
    <p style="margin: 0 0 20px 0; color: #374151;">
      Thank you for contacting us. We have received your ticket and opened a case for you.
    </p>
    
    <div style="background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; margin: 20px 0;">
      <h3 style="color: #111827; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">Ticket Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #374151;">Ticket ID:</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-family: monospace;">${ticketId}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #374151;">Subject:</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${subject}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #374151;">Status:</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #059669;">Open</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-weight: 600; color: #374151;">Priority:</td>
          <td style="padding: 8px 0; color: #d97706;">${priority}</td>
        </tr>
      </table>
    </div>
    
    <div style="background-color: #f9fafb; padding: 15px; border: 1px solid #e5e7eb; margin: 20px 0;">
      <h4 style="margin: 0 0 10px 0; color: #374151; font-size: 14px; font-weight: 600;">Your Original Message:</h4>
      <div style="white-space: pre-wrap; background-color: white; padding: 15px; border: 1px solid #e5e7eb; color: #374151; font-size: 14px;">${content}</div>
    </div>
    
    <div style="background-color: #f9fafb; padding: 15px; border: 1px solid #e5e7eb; margin: 20px 0;">
      <p style="margin: 0; color: #374151; font-size: 14px;">
        <strong>Important:</strong> You can reply to this email thread to add more information to your ticket. 
        Our support team will review your request and get back to you as soon as possible.
      </p>
    </div>
  `;

  const html = generateEmailTemplate(emailContent, branding, "Ticket Received");

  const text = `Thank you for contacting us. We have received your ticket and opened a case for you.

Ticket Details:
- Ticket ID: ${ticketId}
- Subject: ${subject}
- Status: Open
- Priority: ${priority}

Your original message:
${content}

You can reply to this email thread to add more information to your ticket. Our support team will review your request and get back to you as soon as possible.`;

  return { html, text };
}

export async function generateTicketReplyEmail(
  ticketId: string,
  replyContent: string
): Promise<{ html: string; text: string }> {
  const branding = await getCompanyBranding();

  const emailContent = `
    <div style="background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; margin: 20px 0;">
      ${replyContent.replace(/\n/g, "<br>")}
    </div>
  `;

  const html = generateEmailTemplate(emailContent, branding);

  const text = `${replyContent}

---
Ticket ID: ${ticketId}
This email thread is linked to your support ticket.`;

  return { html, text };
}

export async function generateTicketRejectionEmail(
  subject: string
): Promise<{ html: string; text: string }> {
  const branding = await getCompanyBranding();

  const emailContent = `
    
    <div style="background-color: #ffffff; padding: 20px; border: 1px solid #e5e7eb; margin: 20px 0;">
      <p style="margin: 0 0 15px 0; color: #374151;">
        We regret to inform you that your ticket request has been <strong>rejected</strong>. 
        Our support system is configured to accept support tickets only from registered client email addresses.
      </p>
      
      <div style="background-color: #f9fafb; padding: 15px; border: 1px solid #e5e7eb; margin: 15px 0;">
        <h4 style="margin: 0 0 10px 0; color: #374151;">What you can do:</h4>
        <ul style="margin: 0; color: #374151; padding-left: 20px;">
          <li>Ensure you are using an email address that is registered with our system</li>
          <li>If you believe this is an error, contact our support team directly</li>
          <li>If you are an existing client, contact your account manager to update your contact information</li>
        </ul>
      </div>
      
      <p style="margin: 15px 0 0 0; color: #374151;">
        We apologize for any inconvenience this may cause.
      </p>
    </div>
  `;

  const html = generateEmailTemplate(
    emailContent,
    branding,
    "Ticket Request Rejected"
  );

  const text = `Dear Valued Customer,

Thank you for contacting us regarding: ${subject}

We regret to inform you that your ticket request has been rejected. Our support system is configured to accept support tickets only from registered client email addresses.

To submit a support ticket, please ensure you are using an email address that is registered with our system. If you believe this is an error or need to register your email address, please contact our support team directly.

If you are an existing client and believe your email should be registered, please contact your account manager or our support team to update your contact information.

We apologize for any inconvenience this may cause.`;

  return { html, text };
}
