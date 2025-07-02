import { sendEmail } from "@/lib/email";
import { appRouter } from "@/server/root";
import { createTRPCFetchContext } from "@/server/trpc";
import { db } from "@/server/db";
import { NextRequest, NextResponse } from "next/server";
import {
  generateTicketConfirmationEmail,
  generateTicketRejectionEmail,
} from "@/lib/email-templates";

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
          // Search for tickets with matching emailId or messageId
          const tickets = await db.ticket.findMany({
            where: {
              OR: [
                { emailId: term },
                { messages: { some: { messageId: term } } },
                { messages: { some: { inReplyTo: term } } },
                { messages: { some: { references: { contains: term } } } },
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
              `Found existing ticket ${existingTicket.id} by threading header: ${term}`
            );
            break;
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
      ];

      for (const pattern of ticketIdPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          const potentialTicketId = match[1];

          // Try to find ticket by ID
          const ticket = await db.ticket.findUnique({
            where: { id: potentialTicketId },
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

    // Check for ticket ID in subject line (for replies to confirmation emails)
    if (!existingTicket && subject) {
      const subjectTicketIdPattern = /\[([a-zA-Z0-9]+)\]/;
      const match = subject.match(subjectTicketIdPattern);
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

        // Send confirmation email to the ticket creator
        try {
          const confirmationMessageId = `ticket-confirmation-${ticket.id}@${
            process.env.NEXTAUTH_URL?.replace(/^https?:\/\//, "") ||
            "company.com"
          }`;

          // Update ticket's messageIds array to include the confirmation message
          await db.ticket.update({
            where: { id: ticket.id },
            data: {
              lastMessageId: confirmationMessageId,
              messageIds: {
                push: confirmationMessageId,
              },
            },
          });

          const { html, text: emailText } =
            await generateTicketConfirmationEmail(
              ticket.id,
              subject || "",
              text,
              ticket.priority
            );

          await sendEmail({
            to: fromEmail,
            subject: `Ticket Received: ${subject || ""} [${ticket.id}]`,
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
            `Confirmation email sent to ${fromEmail} for ticket ${ticket.id}`
          );
        } catch (error) {
          console.error("Failed to send confirmation email:", error);
          // Don't throw error, just log it - we don't want to fail ticket creation if email fails
        }
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
