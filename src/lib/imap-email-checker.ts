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
    // Check for ticket ID in brackets: [TICKET_ID]
    const subjectTicketIdPattern = /\[([a-zA-Z0-9]+)\]/;
    let match = subject.match(subjectTicketIdPattern);
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

    // Check for SD- timestamp format in subject: Re: Ticket Received: [SD-1234567890]
    const sdTicketPattern = /SD-(\d+)/i;
    match = subject.match(sdTicketPattern);
    if (match && match[1]) {
      const timestamp = parseInt(match[1]);
      const timeRange = 5 * 60 * 1000; // 5 minutes in milliseconds

      const tickets = await db.ticket.findMany({
        where: {
          createdAt: {
            gte: new Date(timestamp - timeRange),
            lte: new Date(timestamp + timeRange),
          },
        },
        include: { assignedTo: true },
        take: 1,
      });

      if (tickets.length > 0) {
        console.log(
          `Found existing ticket ${tickets[0].id} by SD timestamp in subject: ${match[1]}`
        );
        return tickets[0] as TicketWithAssignedTo;
      }
    }
  }

  // Check threading headers
  if (inReplyTo || references) {
    const searchTerms = [inReplyTo, references].filter(Boolean);

    for (const term of searchTerms) {
      if (term) {
        // Clean the term (remove angle brackets if present)
        const cleanTerm = term.replace(/^<|>$/g, "");

        const tickets = await db.ticket.findMany({
          where: {
            OR: [
              { emailId: cleanTerm },
              { messages: { some: { messageId: cleanTerm } } },
              { messages: { some: { inReplyTo: cleanTerm } } },
              { lastMessageId: cleanTerm },
              { messageIds: { has: cleanTerm } },
            ],
          },
          include: { assignedTo: true },
          take: 1,
        });

        if (tickets.length > 0) {
          console.log(
            `Found existing ticket ${tickets[0].id} by threading header: ${cleanTerm}`
          );
          return tickets[0] as TicketWithAssignedTo;
        }
      }
    }
  }

  // Check for confirmation email Message-IDs in In-Reply-To or References
  if (inReplyTo || references) {
    const searchTerms = [inReplyTo, references].filter(Boolean);

    for (const term of searchTerms) {
      if (term) {
        const cleanTerm = term.replace(/^<|>$/g, "");

        // Look for confirmation email pattern: ticket-confirmation-*
        const confirmationPattern = /ticket-confirmation-([a-zA-Z0-9]+)@/i;
        const match = cleanTerm.match(confirmationPattern);

        if (match && match[1]) {
          // Extract the timestamp from the confirmation Message-ID
          const timestamp = match[1];

          // Find tickets created around that time (within 5 minutes)
          const ticketTime = parseInt(timestamp);
          const timeRange = 5 * 60 * 1000; // 5 minutes in milliseconds

          const tickets = await db.ticket.findMany({
            where: {
              createdAt: {
                gte: new Date(ticketTime - timeRange),
                lte: new Date(ticketTime + timeRange),
              },
            },
            include: { assignedTo: true },
            take: 1,
          });

          if (tickets.length > 0) {
            console.log(
              `Found existing ticket ${tickets[0].id} by confirmation email timestamp: ${timestamp}`
            );
            return tickets[0] as TicketWithAssignedTo;
          }
        }
      }
    }
  }

  // Check for embedded ticket ID in email body
  const ticketIdPatterns = [
    /Ticket ID:\s*([a-zA-Z0-9]+)/i,
    /ticket\s*#?\s*([a-zA-Z0-9]+)/i,
    /case\s*#?\s*([a-zA-Z0-9]+)/i,
    /SD-(\d+)/i, // Check for SD- timestamp format
  ];

  for (const pattern of ticketIdPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      // If it's an SD- timestamp pattern, find by creation time
      if (pattern.source.includes("SD-")) {
        const timestamp = parseInt(match[1]);
        const timeRange = 5 * 60 * 1000; // 5 minutes in milliseconds

        const tickets = await db.ticket.findMany({
          where: {
            createdAt: {
              gte: new Date(timestamp - timeRange),
              lte: new Date(timestamp + timeRange),
            },
          },
          include: { assignedTo: true },
          take: 1,
        });

        if (tickets.length > 0) {
          console.log(
            `Found existing ticket ${tickets[0].id} by SD timestamp in email body: ${match[1]}`
          );
          return tickets[0] as TicketWithAssignedTo;
        }
      } else {
        // Regular ticket ID lookup
        const ticket = await db.ticket.findUnique({
          where: { id: match[1] },
          include: { assignedTo: true },
        });

        if (ticket) {
          console.log(
            `Found existing ticket ${ticket.id} by embedded ticket ID`
          );
          return ticket as TicketWithAssignedTo;
        }
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
    `SD-${Date.now()}`, // Temporary ID for email generation
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

// Add new function to track last processed timestamp
async function getLastProcessedTimestamp(): Promise<Date> {
  const config = await db.configuration.findUnique({
    where: { key: "LAST_EMAIL_PROCESSED_TIMESTAMP" },
  });

  if (config?.value) {
    return new Date(config.value);
  }

  // Default to 24 hours ago if no timestamp found
  const defaultTime = new Date();
  defaultTime.setHours(defaultTime.getHours() - 24);
  return defaultTime;
}

async function updateLastProcessedTimestamp(timestamp: Date): Promise<void> {
  await db.configuration.upsert({
    where: { key: "LAST_EMAIL_PROCESSED_TIMESTAMP" },
    update: { value: timestamp.toISOString() },
    create: {
      key: "LAST_EMAIL_PROCESSED_TIMESTAMP",
      value: timestamp.toISOString(),
      description: "Timestamp of last processed email",
      updatedBy: await getSystemUserId(),
    },
  });
}

// Simplified function to get all emails since last check
async function getAllEmailsSinceLastCheck(
  client: ImapFlow,
  lastProcessedTime: Date
): Promise<number[]> {
  console.log(`Getting all emails since: ${lastProcessedTime.toISOString()}`);

  // Get all emails since last processed time
  const sinceDate = lastProcessedTime.toISOString().split("T")[0]; // YYYY-MM-DD format
  const allUids = await client.search(
    {
      since: sinceDate,
    },
    { uid: true }
  );

  console.log(`Found ${allUids.length} emails since ${sinceDate}`);
  return allUids;
}

// Simplified function to check if email has been processed
async function isEmailProcessed(messageId: string | null): Promise<boolean> {
  if (!messageId) return false;

  // Check if this Message-ID exists in any message or ticket
  const existingMessage = await db.message.findFirst({
    where: { messageId: messageId },
  });

  if (existingMessage) {
    console.log(`Email with Message-ID ${messageId} already processed`);
    return true;
  }

  // Also check tickets for this Message-ID
  const existingTicket = await db.ticket.findFirst({
    where: {
      OR: [{ lastMessageId: messageId }, { messageIds: { has: messageId } }],
    },
  });

  if (existingTicket) {
    console.log(
      `Email with Message-ID ${messageId} already processed in ticket ${existingTicket.id}`
    );
    return true;
  }

  return false;
}

// Main function to check for new emails
export async function checkForNewEmails(): Promise<void> {
  console.log("Starting simplified email check...");

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
    console.log("Got mailbox lock");

    try {
      // Get last processed timestamp
      const lastProcessedTime = await getLastProcessedTimestamp();
      console.log(
        `Last processed email timestamp: ${lastProcessedTime.toISOString()}`
      );

      // Check mailbox status first
      const mailboxStatus = await client.status("INBOX", {
        messages: true,
        unseen: true,
        uidNext: true,
        uidValidity: true,
      });
      console.log("Mailbox status:", mailboxStatus);

      // Get all emails since last check
      const allUids = await getAllEmailsSinceLastCheck(
        client,
        lastProcessedTime
      );
      console.log(`Found ${allUids.length} emails to check`);

      if (allUids.length === 0) {
        console.log("No new emails found");
        return;
      }

      // Sort UIDs to process them in order (newest first typically)
      allUids.sort((a, b) => b - a);
      console.log("Processing UIDs in order:", allUids);

      // Process each email
      let processedCount = 0;
      const BATCH_SIZE = 5; // Process 5 emails at a time
      let lastProcessedTimestamp = lastProcessedTime;

      for (const uid of allUids.slice(0, BATCH_SIZE)) {
        try {
          console.log(`Processing email UID: ${uid}`);

          // Fetch the email
          const messages = await client.fetch(
            [uid],
            {
              source: true,
              envelope: true,
              uid: true,
              internalDate: true,
            },
            { uid: true }
          );

          let messageFound = false;

          for await (const message of messages) {
            messageFound = true;

            // Parse the email
            if (!message.source) {
              console.warn(
                `Message UID: ${message.uid} has no source, skipping`
              );
              continue;
            }

            const parsed = await simpleParser(message.source);
            const messageId = parsed.messageId;

            console.log("--- Parsed Email ---");
            console.log("From:", parsed.from?.text || "");
            console.log("Subject:", parsed.subject || "");
            console.log("Message-ID:", messageId || "");
            console.log("In-Reply-To:", parsed.inReplyTo || "");
            console.log("References:", parsed.references || "");
            console.log("Date:", parsed.date);
            console.log("--------------------");

            // Check if this email has already been processed
            if (await isEmailProcessed(messageId || null)) {
              console.log(
                `Skipping already processed email UID: ${message.uid}`
              );
              continue;
            }

            // Update last processed timestamp
            const emailDate = message.internalDate || parsed.date || new Date();
            if (emailDate > lastProcessedTimestamp) {
              lastProcessedTimestamp = emailDate;
            }

            // Process the email
            console.log(`Processing new email UID: ${message.uid}...`);
            await processEmail({
              from: parsed.from?.text || "",
              subject: parsed.subject || "",
              text: parsed.text || "",
              html: parsed.html || undefined,
              messageId: messageId || null,
              inReplyTo: parsed.inReplyTo || null,
              references: Array.isArray(parsed.references)
                ? parsed.references.join(" ")
                : parsed.references || null,
            });

            processedCount++;
            console.log(`Successfully processed email UID: ${message.uid}`);
          }

          if (!messageFound) {
            console.warn(`No message found for UID: ${uid}`);
          }
        } catch (error) {
          console.error(`Error processing email UID ${uid}:`, error);
        }
      }

      // Update the last processed timestamp
      await updateLastProcessedTimestamp(lastProcessedTimestamp);
      console.log(
        `Updated last processed timestamp to: ${lastProcessedTimestamp.toISOString()}`
      );

      console.log(
        `Email check completed. Processed ${processedCount} new emails.`
      );
    } finally {
      if (lock) {
        await lock.release();
        console.log("Released mailbox lock");
      }
    }
  } catch (error) {
    console.error("Error in checkForNewEmails:", error);
    throw error;
  } finally {
    if (client) {
      await client.logout();
      console.log("Logged out from IMAP server");
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
