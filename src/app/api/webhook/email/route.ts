import { sendEmail } from "@/lib/email";
import { appRouter } from "@/server/root";
import { createTRPCFetchContext } from "@/server/trpc";
import { db } from "@/server/db";
import { NextRequest, NextResponse } from "next/server";
import {
  generateTicketConfirmationEmail,
  generateTicketRejectionEmail,
} from "@/lib/email-templates";
import { assignTicketToUser } from "@/lib/ticket-assignment";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Extract email data from webhook payload
    const {
      from,
      subject,
      text,
      attachments,
      headers = {}, // Email headers for threading
    } = body;

    if (!from || !subject || !text) {
      return NextResponse.json(
        { error: "Missing required email fields" },
        { status: 400 }
      );
    }

    // Extract email and name from the "from" field
    const fromMatch = from.match(/(.*?)\s*<(.+?)>/);
    const fromName = fromMatch ? fromMatch[1].trim() : null;
    const fromEmail = fromMatch ? fromMatch[2] : from || "";

    // Extract threading information from headers
    const messageId = headers["message-id"] || headers["Message-ID"] || "";
    const inReplyTo = headers["in-reply-to"] || headers["In-Reply-To"] || "";
    const references = headers["references"] || headers["References"] || "";

    // Generate a unique email ID if no Message-ID is provided
    const emailId =
      messageId ||
      `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log("Email webhook received:", {
      from: fromEmail,
      subject,
      messageId,
      inReplyTo,
      references,
      emailId,
    });

    // Create tRPC context for App Router
    const ctx = await createTRPCFetchContext({
      req: request,
      resHeaders: new Headers(),
      info: {
        url: new URL("http://localhost"),
        accept: "application/jsonl",
        type: "mutation",
        isBatchCall: false,
        calls: [],
        connectionParams: {},
        signal: new AbortController().signal,
      },
    });

    // Call the create procedure
    const caller = appRouter.createCaller(ctx);

    // Check if this is a reply to an existing ticket
    let existingTicket = null;

    // First, check if this messageId already exists in any ticket
    if (messageId) {
      const existingMessage = await db.message.findFirst({
        where: { messageId: messageId },
        include: {
          ticket: {
            include: {
              assignedTo: true,
            },
          },
        },
      });

      if (existingMessage) {
        existingTicket = existingMessage.ticket;
        console.log(
          `Found existing ticket ${existingTicket.id} by messageId: ${messageId}`
        );
      }
    }

    // If no ticket found by messageId, check threading headers
    if (
      !existingTicket &&
      ((inReplyTo && inReplyTo.trim()) || (references && references.trim()))
    ) {
      // Try to find existing ticket by threading headers
      const searchTerms = [inReplyTo, references]
        .filter(Boolean)
        .map((term) => term.trim())
        .filter((term) => term.length > 0);

      for (const term of searchTerms) {
        if (term) {
          // Clean the term (remove angle brackets if present)
          const cleanTerm = term.replace(/^<|>$/g, "");

          // Search for tickets with matching emailId or messageId
          const tickets = await db.ticket.findMany({
            where: {
              OR: [
                { emailId: cleanTerm },
                { messages: { some: { messageId: cleanTerm } } },
                { messages: { some: { inReplyTo: cleanTerm } } },
                { messages: { some: { references: { contains: cleanTerm } } } },
                { lastMessageId: cleanTerm },
                { messageIds: { has: cleanTerm } },
              ],
            },
            include: {
              assignedTo: true, // Include assigned agent information
            },
            take: 1,
          });

          if (tickets.length > 0) {
            existingTicket = tickets[0];
            console.log(
              `Found existing ticket ${existingTicket.id} by threading header: ${cleanTerm}`
            );
            break;
          }
        }
      }
    }

    // Check for confirmation email Message-IDs in In-Reply-To or References
    if (
      !existingTicket &&
      ((inReplyTo && inReplyTo.trim()) || (references && references.trim()))
    ) {
      const searchTerms = [inReplyTo, references]
        .filter(Boolean)
        .map((term) => term.trim())
        .filter((term) => term.length > 0);

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
              include: {
                assignedTo: true,
              },
              take: 1,
            });

            if (tickets.length > 0) {
              existingTicket = tickets[0];
              console.log(
                `Found existing ticket ${existingTicket.id} by confirmation email timestamp: ${timestamp}`
              );
              break;
            }
          }
        }
      }
    }

    // If no ticket found by headers, check for embedded ticket ID in email body
    if (!existingTicket) {
      // Look for ticket ID patterns in the email body
      const ticketIdPatterns = [
        /Ticket ID:\s*([a-zA-Z0-9]+)/i,
        /ticket\s*#?\s*([a-zA-Z0-9]+)/i,
        /case\s*#?\s*([a-zA-Z0-9]+)/i,
        /\[([a-zA-Z0-9]+)\]/i, // Pattern like [TICKET_ID]
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
              include: {
                assignedTo: true,
              },
              take: 1,
            });

            if (tickets.length > 0) {
              existingTicket = tickets[0];
              console.log(
                `Found existing ticket ${tickets[0].id} by SD timestamp in email body: ${match[1]}`
              );
              break;
            }
          } else {
            // Regular ticket ID lookup
            const ticket = await db.ticket.findUnique({
              where: { id: match[1] },
              include: {
                assignedTo: true,
              },
            });

            if (ticket) {
              existingTicket = ticket;
              console.log(
                `Found existing ticket ${ticket.id} by embedded ticket ID in email body`
              );
              break;
            }
          }
        }
      }
    }

    // Check for ticket ID in subject line (for replies to confirmation emails)
    if (!existingTicket && subject) {
      // Check for ticket ID in brackets: [TICKET_ID]
      const subjectTicketIdPattern = /\[([a-zA-Z0-9]+)\]/;
      let match = subject.match(subjectTicketIdPattern);
      if (match && match[1]) {
        const potentialTicketId = match[1];
        const ticket = await db.ticket.findUnique({
          where: { id: potentialTicketId },
          include: {
            assignedTo: true,
          },
        });

        if (ticket) {
          existingTicket = ticket;
          console.log(
            `Found existing ticket ${ticket.id} by ticket ID in subject line: ${potentialTicketId}`
          );
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
          include: {
            assignedTo: true,
          },
          take: 1,
        });

        if (tickets.length > 0) {
          existingTicket = tickets[0];
          console.log(
            `Found existing ticket ${tickets[0].id} by SD timestamp in subject: ${match[1]}`
          );
        }
      }
    }

    // Also check for ticket confirmation message IDs
    if (!existingTicket) {
      const confirmationPattern = /ticket-confirmation-([a-zA-Z0-9]+)@/i;
      const match = messageId?.match(confirmationPattern);
      if (match && match[1]) {
        const ticketId = match[1];
        const ticket = await db.ticket.findUnique({
          where: { id: ticketId },
          include: {
            assignedTo: true,
          },
        });

        if (ticket) {
          existingTicket = ticket;
          console.log(
            `Found existing ticket ${ticket.id} by confirmation message ID`
          );
        }
      }
    }

    // Additional check: if this is a reply (has inReplyTo or references) but no ticket found,
    // try to find by the original messageId that this is replying to
    if (!existingTicket && inReplyTo) {
      // Extract the messageId from the In-Reply-To header (remove angle brackets if present)
      const originalMessageId = inReplyTo.replace(/^<|>$/g, "");

      const originalMessage = await db.message.findFirst({
        where: { messageId: originalMessageId },
        include: {
          ticket: {
            include: {
              assignedTo: true,
            },
          },
        },
      });

      if (originalMessage) {
        existingTicket = originalMessage.ticket;
        console.log(
          `Found existing ticket ${existingTicket.id} by In-Reply-To messageId: ${originalMessageId}`
        );
      }
    }

    let ticket;
    if (existingTicket) {
      // Add message to existing ticket
      await db.message.create({
        data: {
          content: text,
          ticketId: existingTicket.id,
          isFromUser: true,
          messageId: messageId || undefined,
          inReplyTo: (inReplyTo && inReplyTo.trim()) || undefined,
          references: (references && references.trim()) || undefined,
          attachments: attachments
            ? {
                create: attachments,
              }
            : undefined,
        },
      });

      // Update ticket's last replied timestamp and lastMessageId
      await db.ticket.update({
        where: { id: existingTicket.id },
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

      // Send notification email to assigned agent if ticket is assigned
      if (existingTicket.assignedTo) {
        try {
          await sendEmail({
            to: existingTicket.assignedTo.email,
            subject: `New Reply: ${existingTicket.subject || ""}`,
            text: `A new reply has been received for ticket "${
              existingTicket.subject
            }" from ${fromName || fromEmail}.

From: ${fromName || fromEmail} (${fromEmail})
Subject: ${subject}

Message:
${text}

You can view the full ticket at: ${
              process.env.NEXTAUTH_URL || "http://localhost:3000"
            }/tickets/${existingTicket.id}`,
            html: `
              <h2>New Reply Received</h2>
              <p>A new reply has been received for ticket <strong>"${
                existingTicket.subject
              }"</strong> from ${fromName || fromEmail}.</p>
              
              <div style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #007bff; margin: 15px 0;">
                <p><strong>From:</strong> ${
                  fromName || fromEmail
                } (${fromEmail})</p>
                <p><strong>Subject:</strong> ${subject}</p>
                <p><strong>Message:</strong></p>
                <div style="white-space: pre-wrap; background-color: white; padding: 10px; border-radius: 4px;">${text}</div>
              </div>
              
              <p><a href="${
                process.env.NEXTAUTH_URL || "http://localhost:3000"
              }/tickets/${
              existingTicket.id
            }" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">View Ticket</a></p>
            `,
          });
        } catch (error) {
          console.error(
            "Failed to send notification email to assigned agent:",
            error
          );
          // Don't throw error, just log it
        }
      }

      ticket = existingTicket;
    } else {
      // Check if client-only tickets is enabled and if email is from a registered client
      const clientOnlyTicketsConfig = await db.configuration.findUnique({
        where: { key: "CLIENT_ONLY_TICKETS" },
      });

      if (clientOnlyTicketsConfig?.value === "true") {
        const client = await db.client.findFirst({
          where: {
            emails: {
              has: fromEmail.toLowerCase(),
            },
          },
        });

        if (!client) {
          console.log(
            `Skipping email from ${fromEmail}: Client-only tickets enabled but email is not from a registered client`
          );

          // Send rejection email
          try {
            const { html, text } = await generateTicketRejectionEmail(
              subject || ""
            );

            await sendEmail({
              to: fromEmail,
              subject: `Ticket Request Rejected: ${subject || ""}`,
              text,
              html,
            });

            console.log(
              `Rejection email sent to ${fromEmail} for non-registered client`
            );
          } catch (error) {
            console.error("Failed to send rejection email:", error);
          }

          return NextResponse.json({
            success: false,
            message: "Email not from registered client",
          });
        }
        console.log(
          `Email from ${fromEmail} is from a registered client, proceeding with ticket creation`
        );
      }

      // Create new ticket
      try {
        // Generate confirmation email content first
        const confirmationMessageId = `ticket-confirmation-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}@${
          process.env.NEXTAUTH_URL?.replace(/^https?:\/\//, "") || "company.com"
        }`;

        const { html, text: emailText } = await generateTicketConfirmationEmail(
          `SD-${Date.now()}`, // Temporary ID for email generation
          subject || "",
          text,
          "MEDIUM" // Default priority
        );

        // Send confirmation email first - if this fails, no ticket will be created
        try {
          console.log(
            `Attempting to send confirmation email to ${fromEmail}...`
          );
          console.log(`Email subject: Ticket Received: ${subject || ""}`);
          console.log(`Email content length: ${emailText.length} characters`);

          await sendEmail({
            to: fromEmail,
            subject: `Ticket Received: ${subject || ""}`,
            text: emailText,
            html,
            headers: {
              "Message-ID": confirmationMessageId,
              ...(messageId && { "In-Reply-To": messageId }),
              References:
                messageId && references
                  ? `${references} ${messageId}`.trim()
                  : messageId || references,
            },
          });

          console.log(
            `✅ Confirmation email sent to ${fromEmail} successfully`
          );
        } catch (emailError) {
          console.error("❌ Failed to send confirmation email:", emailError);
          if (emailError instanceof Error) {
            console.error("Email error type:", emailError.constructor.name);
            console.error("Email error message:", emailError.message);
            console.error("Email error stack:", emailError.stack);
          }

          return NextResponse.json(
            {
              error: "Email configuration error",
              details:
                emailError instanceof Error
                  ? emailError.message
                  : String(emailError),
              message:
                "Cannot create ticket due to email configuration issues. Please check SMTP settings.",
            },
            { status: 500 }
          );
        }

        // Only create ticket if email was sent successfully
        ticket = await caller.ticket.create({
          subject,
          fromEmail,
          fromName: fromName || undefined,
          content: text,
          emailId,
          messageId: messageId || undefined,
          inReplyTo: (inReplyTo && inReplyTo.trim()) || undefined,
          references: (references && references.trim()) || undefined,
          attachments: attachments || [],
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
      } catch (err) {
        console.error("Ticket creation error:", err);
        console.error("Ticket creation input:", {
          subject,
          fromEmail,
          fromName,
          content: text,
          emailId,
          messageId,
          inReplyTo,
          references,
          attachments,
        });
        if (err instanceof Error && err.stack) {
          console.error("Error stack:", err.stack);
        }
        return NextResponse.json(
          {
            error: "Ticket creation failed",
            details: err instanceof Error ? err.message : String(err),
          },
          { status: 500 }
        );
      }
    }

    console.log(
      `Ticket processing result: ${
        existingTicket ? "Reply to existing ticket" : "New ticket created"
      } - Ticket ID: ${ticket.id}`
    );

    return NextResponse.json({
      success: true,
      ticketId: ticket.id,
      isReply: !!existingTicket,
    });
  } catch (error) {
    console.error("Webhook error:", error);
    if (error instanceof Error && error.stack) {
      console.error("Error stack:", error.stack);
    }
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
