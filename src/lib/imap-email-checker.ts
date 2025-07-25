import { db } from "@/server/db";
import type { Ticket, User } from "@prisma/client";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import {
  generateTicketConfirmationEmail,
  generateTicketRejectionEmail,
} from "@/lib/email-templates";
import { assignTicketToUser } from "@/lib/ticket-assignment";

interface EmailConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  secure: boolean;
}

interface TicketWithAssignedTo extends Ticket {
  assignedTo: User | null;
}

// Get email configuration from database
async function getEmailConfig(): Promise<EmailConfig> {
  const configs = await db.configuration.findMany({
    where: {
      key: {
        in: ["IMAP_HOST", "IMAP_PORT", "IMAP_USER", "IMAP_PASS", "IMAP_SECURE"],
      },
    },
  });

  const configMap = configs.reduce((acc, config) => {
    acc[config.key] = config.value;
    return acc;
  }, {} as Record<string, string>);

  return {
    host: configMap.IMAP_HOST || "",
    port: parseInt(configMap.IMAP_PORT || "993"),
    user: configMap.IMAP_USER || "",
    password: configMap.IMAP_PASS || "",
    secure: configMap.IMAP_SECURE === "true",
  };
}

// Get system user ID for automated operations
async function getSystemUserId(): Promise<string> {
  const systemUser = await db.user.findUnique({
    where: { email: "system@company.com" },
  });

  if (systemUser) {
    return systemUser.id;
  }

  // Fallback: try to find any admin user
  const adminUser = await db.user.findFirst({
    where: { role: "ADMIN" },
  });

  if (adminUser) {
    return adminUser.id;
  }

  throw new Error(
    "No system user or admin user found. Please run the database seed first."
  );
}

// Check if email is from a registered client
async function findClientByEmail(
  email: string
): Promise<{ id: string; name: string; emails: string[] } | null> {
  const normalizedEmail = email.toLowerCase().trim();

  // Get all clients and check their emails manually for better matching
  const allClients = await db.client.findMany({
    select: {
      id: true,
      name: true,
      emails: true,
    },
  });

  // Find client by checking if any of their emails match
  const client = allClients.find((client) =>
    client.emails.some((email) => {
      const normalizedStoredEmail = email.toLowerCase().trim();
      return normalizedStoredEmail === normalizedEmail;
    })
  );

  return client || null;
}

// Get client-only tickets configuration
async function getClientOnlyTicketsConfig(): Promise<boolean> {
  const config = await db.configuration.findUnique({
    where: { key: "CLIENT_ONLY_TICKETS" },
  });
  return config?.value === "true";
}

// Mark email as read
async function markAllEmailAsRead(client: ImapFlow): Promise<boolean> {
  try {
    await client.messageFlagsAdd({ seen: false }, ["\\Seen"]);
    console.log(`✅ Marked all email as read`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to mark all email as read:`, error);
    return false;
  }
}

// Find existing ticket by various methods
async function findExistingTicket(
  text: string,
  messageId: string | null,
  inReplyTo: string | null,
  references: string | null,
  subject: string | null
): Promise<TicketWithAssignedTo | null> {
  // Check if this messageId already exists
  if (messageId) {
    const existingMessage = await db.message.findFirst({
      where: { messageId: messageId },
      include: {
        ticket: {
          include: { assignedTo: true },
        },
      },
    });

    if (existingMessage) {
      console.log(
        `Found existing ticket ${existingMessage.ticket.id} by messageId: ${messageId}`
      );
      return existingMessage.ticket as TicketWithAssignedTo;
    }
  }

  // Check for ticket ID in subject line
  if (subject) {
    const subjectTicketIdPattern = /\[([a-zA-Z0-9]+)\]/;
    const match = subject.match(subjectTicketIdPattern);
    if (match && match[1]) {
      const ticket = await db.ticket.findUnique({
        where: { id: match[1] },
        include: { assignedTo: true },
      });

      if (ticket) {
        console.log(
          `Found existing ticket ${ticket.id} by ticket ID in subject: ${match[1]}`
        );
        return ticket as TicketWithAssignedTo;
      }
    }
  }

  // Check threading headers
  if (inReplyTo || references) {
    const searchTerms = [inReplyTo, references].filter(Boolean);

    for (const term of searchTerms) {
      if (term) {
        const tickets = await db.ticket.findMany({
          where: {
            OR: [
              { emailId: term },
              { messages: { some: { messageId: term } } },
              { messages: { some: { inReplyTo: term } } },
            ],
          },
          include: { assignedTo: true },
          take: 1,
        });

        if (tickets.length > 0) {
          console.log(
            `Found existing ticket ${tickets[0].id} by threading header: ${term}`
          );
          return tickets[0] as TicketWithAssignedTo;
        }
      }
    }
  }

  // Check for embedded ticket ID in email body
  const ticketIdPatterns = [
    /Ticket ID:\s*([a-zA-Z0-9]+)/i,
    /ticket\s*#?\s*([a-zA-Z0-9]+)/i,
    /case\s*#?\s*([a-zA-Z0-9]+)/i,
  ];

  for (const pattern of ticketIdPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const ticket = await db.ticket.findUnique({
        where: { id: match[1] },
        include: { assignedTo: true },
      });

      if (ticket) {
        console.log(`Found existing ticket ${ticket.id} by embedded ticket ID`);
        return ticket as TicketWithAssignedTo;
      }
    }
  }

  return null;
}

// Add message to existing ticket
async function addMessageToExistingTicket(
  ticket: TicketWithAssignedTo,
  emailData: {
    from: string;
    subject: string;
    text: string;
    html?: string;
    messageId: string | null;
    inReplyTo: string | null;
    references: string | null;
  }
): Promise<void> {
  const { from, text, messageId, inReplyTo, references } = emailData;

  console.log(`Adding message to existing ticket ${ticket.id}`);

  // Add message to existing ticket
  await db.message.create({
    data: {
      content: text,
      ticketId: ticket.id,
      isFromUser: true,
      messageId: messageId || undefined,
      inReplyTo: inReplyTo || undefined,
      references: references || undefined,
    },
  });

  // Update ticket's last replied timestamp
  await db.ticket.update({
    where: { id: ticket.id },
    data: {
      lastReplied: new Date(),
      lastMessageId: messageId || undefined,
      messageIds: messageId
        ? {
            push: messageId,
          }
        : undefined,
    },
  });

  console.log(`Added message to existing ticket ${ticket.id} from ${from}`);
}

// Generate unique email ID
function generateEmailId(): string {
  return `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Extract sender information from email
function extractSenderInfo(from: string): {
  name: string | null;
  email: string;
} {
  const fromMatch = from.match(/(.*?)\s*<(.+?)>/);
  const name = fromMatch ? fromMatch[1].trim() : null;
  const email = fromMatch ? fromMatch[2] : from;
  return { name, email };
}

// Process a single email
async function processEmail(emailData: {
  from: string;
  subject: string;
  text: string;
  html?: string;
  messageId?: string | null;
  inReplyTo?: string | null;
  references?: string | null;
}): Promise<void> {
  const { from, subject, text, messageId, inReplyTo, references } = emailData;

  if (!from || !subject || !text) {
    console.log("Skipping email: Missing required fields");
    return;
  }

  const { name, email } = extractSenderInfo(from);
  console.log(`Processing email from: ${email}, subject: ${subject}`);

  // Check if this is a reply to an existing ticket
  const existingTicket = await findExistingTicket(
    text,
    messageId || null,
    inReplyTo || null,
    references || null,
    subject
  );

  if (existingTicket) {
    // This is a reply to an existing ticket
    await addMessageToExistingTicket(existingTicket, {
      from: `${name || ""} <${email}>`,
      subject,
      text,
      html: emailData.html,
      messageId: messageId || null,
      inReplyTo: inReplyTo || null,
      references: references || null,
    });
    return;
  }

  const client = await findClientByEmail(email);
  let clientId: string | undefined = undefined;

  if (client) {
    console.log(
      `Found client: ${client.name} with emails: ${client.emails.join(", ")}`
    );
    clientId = client.id;
  } else {
    console.log(`No client found for email: ${email}`);
  }

  // Check if client-only tickets is enabled and if email is from a registered client
  const clientOnlyTickets = await getClientOnlyTicketsConfig();
  if (clientOnlyTickets && !client) {
    console.log(
      `Skipping email from ${email}: Client-only tickets enabled but email is not from a registered client`
    );

    // Send rejection email
    try {
      const { sendEmail } = await import("@/lib/email");
      const { html, text } = await generateTicketRejectionEmail(subject);

      await sendEmail({
        to: email,
        subject: `Ticket Request Rejected: ${subject}`,
        text,
        html,
      });

      console.log(`Rejection email sent to ${email} for non-registered client`);
    } catch (error) {
      console.error("Failed to send rejection email:", error);
    }

    return;
  }

  if (clientOnlyTickets && client) {
    console.log(
      `Email from ${email} is from a registered client, proceeding with ticket creation`
    );
  }

  // This is a new email, create a new ticket
  const emailId = generateEmailId();
  const systemUserId = await getSystemUserId();

  console.log(
    `Creating new ticket for email from: ${email}, subject: ${subject}`
  );

  console.log(`Creating ticket with clientId: ${clientId || "null"}`);

  // Generate confirmation email content first
  const confirmationMessageId = `ticket-confirmation-${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 9)}@${
    process.env.NEXTAUTH_URL?.replace(/^https?:\/\//, "") || "company.com"
  }`;

  const { html, text: emailText } = await generateTicketConfirmationEmail(
    `temp-${Date.now()}`, // Temporary ID for email generation
    subject,
    text,
    "MEDIUM" // Default priority
  );

  // Send confirmation email first - if this fails, no ticket will be created
  try {
    const { sendEmail } = await import("@/lib/email");
    await sendEmail({
      to: email,
      subject: `Ticket Received: ${subject}`,
      text: emailText,
      html,
      headers: {
        "Message-ID": confirmationMessageId,
        ...(messageId
          ? {
              "In-Reply-To": messageId,
              References:
                references && messageId
                  ? `${references} ${messageId}`.trim()
                  : messageId,
            }
          : {}),
      },
    });

    console.log(`Confirmation email sent to ${email} successfully`);
  } catch (emailError) {
    console.error("Failed to send confirmation email:", emailError);
    throw emailError;
  }

  // Create ticket only if email was sent successfully
  const ticket = await db.ticket.create({
    data: {
      subject,
      fromEmail: email,
      fromName: name || undefined,
      emailId,
      createdById: systemUserId,
      clientId: clientId,
      lastMessageId: messageId || undefined,
      messageIds: messageId ? [messageId] : [],
      messages: {
        create: {
          content: text,
          isFromUser: true,
          messageId: messageId || undefined,
          inReplyTo: inReplyTo || undefined,
          references: references || undefined,
        },
      },
    },
  });

  // Assign ticket based on configuration
  const assignedUserId = await assignTicketToUser(ticket.id);
  if (assignedUserId) {
    console.log(
      `Ticket ${ticket.id} automatically assigned to user ${assignedUserId}`
    );
  } else {
    console.log(`Ticket ${ticket.id} created without assignment`);
  }

  // Update ticket with the actual confirmation message ID
  await db.ticket.update({
    where: { id: ticket.id },
    data: {
      lastMessageId: confirmationMessageId,
      messageIds: {
        push: confirmationMessageId,
      },
    },
  });

  console.log(
    `Ticket ${ticket.id} created successfully after email confirmation`
  );
}

// Main function to check for new emails
export async function checkForNewEmails(): Promise<void> {
  console.log("Starting email check...");

  let client: ImapFlow | null = null;
  let lock: Awaited<ReturnType<ImapFlow["getMailboxLock"]>> | null = null;

  try {
    // Get configuration
    const config = await getEmailConfig();
    if (!config.host || !config.user || !config.password) {
      console.error("IMAP configuration not found in database");
      return;
    }

    console.log("IMAP config found:", {
      host: config.host,
      port: config.port,
      user: config.user,
      secure: config.secure,
    });

    // Connect to IMAP server
    client = new ImapFlow({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.password },
      logger: false,
    });

    await client.connect();
    console.log("Connected to IMAP server");

    // Get mailbox lock
    lock = await client.getMailboxLock("INBOX");
    // await client.mailboxOpen("INBOX", { readOnly: false });
    console.log("Got mailbox lock");

    try {
      // Check mailbox status first
      const mailboxStatus = await client.status("INBOX", {
        messages: true,
        unseen: true,
        uidNext: true,
        uidValidity: true,
      });
      console.log("Mailbox status:", mailboxStatus);

      // Search for unread emails
      console.log("Searching for unread emails...");
      const unreadUids = await client.search({ seen: false }, { uid: true });
      console.log(`Found ${unreadUids.length} unread emails:`, unreadUids);

      if (unreadUids.length === 0) {
        console.log("No unread emails found");
        return;
      }

      // Sort UIDs to process them in order (newest first typically)
      unreadUids.sort((a, b) => b - a);
      console.log("Processing UIDs in order:", unreadUids);

      // Process each unread email - reduced batch size for faster processing
      let processedCount = 0;
      const BATCH_SIZE = 5; // Reduced from 10 to 5 for faster processing

      for (const uid of unreadUids.slice(0, BATCH_SIZE)) {
        try {
          console.log(`Processing unread email UID: ${uid}`);

          // Fetch the email with optimized options
          console.log(`Fetching message UID: ${uid}...`);
          const messages = await client.fetch(
            [uid],
            {
              source: true,
              envelope: true,
              flags: true,
              uid: true,
            },
            { uid: true }
          );

          console.log(`Fetch completed for UID: ${uid}, starting iteration...`);
          let messageFound = false;

          for await (const message of messages) {
            messageFound = true;

            // Double-check if message is actually unread
            if (message.flags?.has("\\Seen")) {
              console.log(
                `Message UID: ${message.uid} is already read, skipping`
              );
              continue;
            }

            // Parse the email
            console.log(`Parsing message UID: ${message.uid}...`);
            if (!message.source) {
              console.warn(
                `Message UID: ${message.uid} has no source, skipping`
              );
              continue;
            }

            const parsed = await simpleParser(message.source);

            console.log("--- Parsed Email ---");
            console.log("From:", parsed.from?.text || "");
            console.log("Subject:", parsed.subject || "");
            console.log("Message-ID:", parsed.messageId || "");
            console.log("In-Reply-To:", parsed.inReplyTo || "");
            console.log("References:", parsed.references || "");
            console.log("Text length:", parsed.text?.length || 0);
            console.log("Date:", parsed.date);
            console.log("--------------------");

            // Process the email
            console.log(`Processing email UID: ${message.uid}...`);
            await processEmail({
              from: parsed.from?.text || "",
              subject: parsed.subject || "",
              text: parsed.text || "",
              html: parsed.html || "",
              messageId: parsed.messageId || null,
              inReplyTo: parsed.inReplyTo || null,
              references: Array.isArray(parsed.references)
                ? parsed.references.join(" ")
                : parsed.references || null,
            });

            processedCount++;
            console.log(`Email ${message.uid} processed successfully`);
          }

          if (!messageFound) {
            console.warn(
              `No message found for UID ${uid} - it may have been deleted or is invalid`
            );
          }
        } catch (error) {
          console.error(`Error processing email UID ${uid}:`, error);
          if (error instanceof Error) {
            console.error("Error details:", error.message);
            console.error("Error stack:", error.stack);
          }
          // Continue processing other emails even if one fails
          continue;
        }
      }
      await markAllEmailAsRead(client);
      console.log(`Email check completed. Processed ${processedCount} emails`);
    } finally {
      if (lock) {
        lock.release();
        console.log("Mailbox lock released");
      }
    }
  } catch (error) {
    console.error("Error checking emails:", error);
    throw error;
  } finally {
    if (client) {
      try {
        await client.logout();
        console.log("IMAP client logged out");
      } catch (logoutError) {
        console.warn("Error during logout:", logoutError);
      }
    }
  }
}

// Test IMAP connection
export async function testImapConnection(): Promise<boolean> {
  try {
    const config = await getEmailConfig();
    if (!config.host || !config.user || !config.password) {
      return false;
    }

    const client = new ImapFlow({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.password },
      logger: false,
    });

    await client.connect();
    await client.logout();
    return true;
  } catch (error) {
    console.error("IMAP connection test failed:", error);
    return false;
  }
}

// Get unread email count
export async function getUnreadEmailCount(): Promise<number> {
  try {
    const config = await getEmailConfig();
    if (!config.host || !config.user || !config.password) {
      return 0;
    }

    const client = new ImapFlow({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.password },
    });

    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      const unreadUids = await client.search({ seen: false }, { uid: true });
      return unreadUids.length;
    } finally {
      lock.release();
      await client.logout();
    }
  } catch (error) {
    console.error("Error getting unread count:", error);
    return 0;
  }
}
