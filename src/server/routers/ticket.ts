import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/server/trpc";
import { TRPCError } from "@trpc/server";
import { sendEmail } from "@/lib/email";
import {
  generateTicketConfirmationEmail,
  generateTicketRejectionEmail,
  generateTicketReplyEmail,
} from "@/lib/email-templates";
import bcrypt from "bcryptjs";
import { TicketStatus, Priority } from "@prisma/client";

export const ticketRouter = createTRPCRouter({
  // Get all tickets (with filtering)
  getAll: protectedProcedure
    .input(
      z.object({
        status: z
          .enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"])
          .optional(),
        priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
        assignedToId: z.string().optional(),
        clientId: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().nullish(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { limit, cursor, status, priority, assignedToId, clientId } = input;

      // Users can only see their assigned tickets, admins can see all
      const whereClause: {
        status?: TicketStatus;
        priority?: Priority;
        assignedToId?: string;
        clientId?: string;
      } = {
        status: status as TicketStatus | undefined,
        priority: priority as Priority | undefined,
        clientId: clientId,
      };

      if (ctx.session.user.role !== "ADMIN") {
        whereClause.assignedToId = ctx.session.user.id;
      } else if (assignedToId) {
        whereClause.assignedToId = assignedToId;
      }

      const items = await ctx.db.ticket.findMany({
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: {
          createdAt: "desc",
        },
        where: whereClause,
        include: {
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          client: {
            select: {
              id: true,
              name: true,
              companyName: true,
              emails: true,
            },
          },
          messages: {
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
          },
          attachments: {
            take: 5, // Show first 5 attachments
          },
          _count: {
            select: {
              messages: true,
              attachments: true,
            },
          },
        },
      });

      let nextCursor: typeof cursor | undefined = undefined;
      if (items.length > limit) {
        const nextItem = items.pop();
        nextCursor = nextItem!.id;
      }

      return {
        items,
        nextCursor,
      };
    }),

  // Get a single ticket with messages
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const ticket = await ctx.db.ticket.findUnique({
        where: { id: input.id },
        include: {
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          client: {
            select: {
              id: true,
              name: true,
              companyName: true,
              emails: true,
            },
          },
          messages: {
            orderBy: {
              createdAt: "asc",
            },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
              attachments: true,
            },
          },
          attachments: true,
        },
      });

      if (!ticket) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ticket not found",
        });
      }

      // Users can only access their assigned tickets, admins can access all
      if (
        ctx.session.user.role !== "ADMIN" &&
        ticket.assignedToId !== ctx.session.user.id
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only access tickets assigned to you",
        });
      }

      return ticket;
    }),

  // Get tickets by client ID
  getByClientId: protectedProcedure
    .input(
      z.object({
        clientId: z.string().cuid(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().nullish(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { limit, cursor, clientId } = input;

      const items = await ctx.db.ticket.findMany({
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: {
          createdAt: "desc",
        },
        where: {
          clientId: clientId,
        },
        include: {
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          messages: {
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
          },
          attachments: {
            take: 5,
          },
          _count: {
            select: {
              messages: true,
              attachments: true,
            },
          },
        },
      });

      let nextCursor: typeof cursor | undefined = undefined;
      if (items.length > limit) {
        const nextItem = items.pop();
        nextCursor = nextItem!.id;
      }

      return {
        items,
        nextCursor,
      };
    }),

  // Create a new ticket (from email webhook)
  create: publicProcedure
    .input(
      z.object({
        subject: z.string(),
        fromEmail: z.string().email(),
        fromName: z.string().optional(),
        content: z.string(),
        emailId: z.string(),
        messageId: z.string().optional(), // Email Message-ID
        inReplyTo: z.string().optional(), // In-Reply-To header
        references: z.string().optional(), // References header
        attachments: z
          .array(
            z.object({
              filename: z.string(),
              originalName: z.string(),
              mimeType: z.string(),
              size: z.number(),
              url: z.string(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Create a default user for system operations
      let systemUser = await ctx.db.user.findFirst({
        where: { email: "system@company.com" },
      });

      if (!systemUser) {
        systemUser = await ctx.db.user.create({
          data: {
            email: "system@company.com",
            name: "System",
            password: await bcrypt.hash("system_password_123", 10),
            role: "ADMIN",
          },
        });
      }

      // Check if client-only tickets is enabled and if email is from a registered client
      const clientOnlyTicketsConfig = await ctx.db.configuration.findUnique({
        where: { key: "CLIENT_ONLY_TICKETS" },
      });

      let clientId: string | undefined = undefined;

      if (clientOnlyTicketsConfig?.value === "true") {
        // Normalize the incoming email
        const normalizedEmail = input.fromEmail.toLowerCase().trim();

        // Debug: Log the email we're looking for
        console.log(`Looking for client with email: ${normalizedEmail}`);

        // Get all clients and check their emails manually for better debugging
        const allClients = await ctx.db.client.findMany({
          select: {
            id: true,
            name: true,
            emails: true,
          },
        });

        console.log(`Found ${allClients.length} clients in database`);
        console.log(`Looking for email: "${normalizedEmail}"`);

        allClients.forEach((client) => {
          console.log(
            `Client: ${client.name}, Emails: [${client.emails
              .map((e) => `"${e}"`)
              .join(", ")}]`
          );

          // Check each email individually
          client.emails.forEach((email) => {
            const normalizedStoredEmail = email.toLowerCase().trim();
            const matches = normalizedStoredEmail === normalizedEmail;
            console.log(
              `  Comparing "${normalizedStoredEmail}" with "${normalizedEmail}" = ${matches}`
            );
          });
        });

        // Find client by checking if any of their emails match
        const client = allClients.find((client) =>
          client.emails.some((email) => {
            const normalizedStoredEmail = email.toLowerCase().trim();
            return normalizedStoredEmail === normalizedEmail;
          })
        );

        // Debug: Log if client was found
        if (client) {
          console.log(
            `Found client: ${client.name} with emails: ${client.emails.join(
              ", "
            )}`
          );
        } else {
          console.log(`No client found for email: ${normalizedEmail}`);
        }

        if (!client) {
          // Send rejection email before throwing error
          try {
            const { html, text } = await generateTicketRejectionEmail(
              input.subject
            );

            await sendEmail({
              to: input.fromEmail,
              subject: `Ticket Request Rejected: ${input.subject}`,
              text,
              html,
            });

            console.log(
              `Rejection email sent to ${input.fromEmail} for non-registered client`
            );
          } catch (error) {
            console.error("Failed to send rejection email:", error);
          }

          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "Email not from registered client. Client-only tickets are enabled.",
          });
        } else {
          clientId = client.id;
        }
      } else {
        // Even if client-only tickets is disabled, try to find and map the client
        const normalizedEmail = input.fromEmail.toLowerCase().trim();

        console.log(
          `Client-only tickets disabled, looking for client with email: ${normalizedEmail}`
        );

        // Get all clients and check their emails manually
        const allClients = await ctx.db.client.findMany({
          select: {
            id: true,
            name: true,
            emails: true,
          },
        });

        // Find client by checking if any of their emails match
        const client = allClients.find((client) =>
          client.emails.some(
            (email) => email.toLowerCase().trim() === normalizedEmail
          )
        );

        if (client) {
          console.log(
            `Found client for mapping: ${
              client.name
            } with emails: ${client.emails.join(", ")}`
          );
          clientId = client.id;
        } else {
          console.log(
            `No client found for mapping with email: ${normalizedEmail}`
          );
        }
      }

      console.log(`Creating ticket with clientId: ${clientId || "null"}`);

      // Generate confirmation email content first
      const confirmationMessageId = `ticket-confirmation-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}@${
        process.env.NEXTAUTH_URL?.replace(/^https?:\/\//, "") || "company.com"
      }`;

      const { html, text } = await generateTicketConfirmationEmail(
        `temp-${Date.now()}`, // Temporary ID for email generation
        input.subject,
        input.content,
        "MEDIUM" // Default priority
      );

      // Send confirmation email first - if this fails, no ticket will be created
      try {
        await sendEmail({
          to: input.fromEmail,
          subject: `Ticket Received: ${input.subject}`,
          text,
          html,
          headers: {
            "Message-ID": confirmationMessageId,
            ...(input.messageId && { "In-Reply-To": input.messageId }),
            ...(input.messageId &&
              input.references && {
                References: `${input.messageId} ${input.references}`.trim(),
              }),
            ...(input.references &&
              !input.messageId && { References: input.references }),
          },
        });

        console.log(
          `Confirmation email sent to ${input.fromEmail} successfully`
        );
      } catch (emailError) {
        console.error("Failed to send confirmation email:", emailError);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Cannot create ticket due to email configuration issues. Please check SMTP settings.",
          cause: emailError,
        });
      }

      // Create the ticket only if email was sent successfully
      const ticket = await ctx.db.ticket.create({
        data: {
          subject: input.subject,
          fromEmail: input.fromEmail,
          fromName: input.fromName,
          emailId: input.emailId,
          createdById: systemUser.id,
          clientId: clientId,
          lastMessageId: input.messageId || undefined,
          messageIds: input.messageId ? [input.messageId] : [],
          messages: {
            create: {
              content: input.content,
              isFromUser: true,
              messageId: input.messageId,
              inReplyTo: input.inReplyTo,
              references: input.references,
              attachments: input.attachments
                ? {
                    create: input.attachments,
                  }
                : undefined,
            },
          },
          attachments: input.attachments
            ? {
                create: input.attachments,
              }
            : undefined,
        },
        include: {
          messages: true,
          attachments: true,
        },
      });

      // Update ticket with the actual confirmation message ID
      await ctx.db.ticket.update({
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

      return ticket;
    }),

  // Assign ticket to a user (admin only)
  assign: protectedProcedure
    .input(
      z.object({
        ticketId: z.string(),
        userId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Only admins can assign tickets
      if (ctx.session.user.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can assign tickets",
        });
      }

      // Get ticket with messages and assigned user info
      const ticket = await ctx.db.ticket.findUnique({
        where: { id: input.ticketId },
        include: {
          assignedTo: true,
          messages: {
            where: { isFromUser: true },
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!ticket) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ticket not found",
        });
      }

      // Get the user being assigned
      const assignedUser = await ctx.db.user.findUnique({
        where: { id: input.userId },
      });

      if (!assignedUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      // Update the ticket
      const updatedTicket = await ctx.db.ticket.update({
        where: { id: input.ticketId },
        data: {
          assignedToId: input.userId,
          status: "IN_PROGRESS",
        },
        include: {
          assignedTo: true,
        },
      });

      // Send notification email to the newly assigned agent
      try {
        const latestUserMessage = ticket.messages[0];
        const messagePreview = latestUserMessage
          ? latestUserMessage.content.substring(0, 200) +
            (latestUserMessage.content.length > 200 ? "..." : "")
          : "No messages yet";

        await sendEmail({
          to: assignedUser.email,
          subject: `Ticket Assigned: ${ticket.subject}`,
          text: `You have been assigned a new ticket "${ticket.subject}" from ${
            ticket.fromName || ticket.fromEmail
          }.

Ticket Details:
- Subject: ${ticket.subject}
- From: ${ticket.fromName || ticket.fromEmail} (${ticket.fromEmail})
- Priority: ${ticket.priority}
- Status: ${ticket.status}
- Created: ${ticket.createdAt.toLocaleDateString()}

Latest message from user:
${messagePreview}

You can view the full ticket at: ${
            process.env.NEXTAUTH_URL || "http://localhost:3000"
          }/tickets/${ticket.id}`,
          html: `
            <h2>Ticket Assigned</h2>
            <p>You have been assigned a new ticket <strong>"${
              ticket.subject
            }"</strong> from ${ticket.fromName || ticket.fromEmail}.</p>
            
            <div style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #28a745; margin: 15px 0;">
              <h3>Ticket Details</h3>
              <p><strong>Subject:</strong> ${ticket.subject}</p>
              <p><strong>From:</strong> ${
                ticket.fromName || ticket.fromEmail
              } (${ticket.fromEmail})</p>
              <p><strong>Priority:</strong> <span style="color: ${
                ticket.priority === "URGENT"
                  ? "#dc3545"
                  : ticket.priority === "HIGH"
                  ? "#fd7e14"
                  : ticket.priority === "MEDIUM"
                  ? "#ffc107"
                  : "#28a745"
              }">${ticket.priority}</span></p>
              <p><strong>Status:</strong> ${ticket.status.replace("_", " ")}</p>
              <p><strong>Created:</strong> ${ticket.createdAt.toLocaleDateString()}</p>
            </div>
            
            ${
              latestUserMessage
                ? `
            <div style="background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 15px 0;">
              <h4>Latest Message from User:</h4>
              <div style="white-space: pre-wrap; background-color: white; padding: 10px; border-radius: 4px;">${messagePreview}</div>
            </div>
            `
                : ""
            }
            
            <p><a href="${
              process.env.NEXTAUTH_URL || "http://localhost:3000"
            }/tickets/${
            ticket.id
          }" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">View Ticket</a></p>
          `,
        });
      } catch (error) {
        console.error("Failed to send assignment notification email:", error);
        // Don't throw error, just log it
      }

      return updatedTicket;
    }),

  // Update ticket status (users can update status of their assigned tickets)
  updateStatus: protectedProcedure
    .input(
      z.object({
        ticketId: z.string(),
        status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const ticket = await ctx.db.ticket.findUnique({
        where: { id: input.ticketId },
      });

      if (!ticket) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ticket not found",
        });
      }

      // Users can only update status of their assigned tickets, admins can update any
      if (
        ctx.session.user.role !== "ADMIN" &&
        ticket.assignedToId !== ctx.session.user.id
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only update status of tickets assigned to you",
        });
      }

      const updatedTicket = await ctx.db.ticket.update({
        where: { id: input.ticketId },
        data: {
          status: input.status,
        },
      });

      return updatedTicket;
    }),

  // Update ticket priority (admin only)
  updatePriority: protectedProcedure
    .input(
      z.object({
        ticketId: z.string(),
        priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Only admins can update priority
      if (ctx.session.user.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can update ticket priority",
        });
      }

      const ticket = await ctx.db.ticket.update({
        where: { id: input.ticketId },
        data: {
          priority: input.priority,
        },
      });

      return ticket;
    }),

  // Add a reply to a ticket
  reply: protectedProcedure
    .input(
      z.object({
        ticketId: z.string(),
        content: z.string(),
        attachments: z
          .array(
            z.object({
              filename: z.string(),
              originalName: z.string(),
              mimeType: z.string(),
              size: z.number(),
              url: z.string(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const ticket = await ctx.db.ticket.findUnique({
        where: { id: input.ticketId },
        include: {
          assignedTo: true,
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            where: { messageId: { not: null } },
          },
        },
      });

      if (!ticket) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ticket not found",
        });
      }

      // Users can only reply to their assigned tickets, admins can reply to any
      if (
        ctx.session.user.role !== "ADMIN" &&
        ticket.assignedToId !== ctx.session.user.id
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only reply to tickets assigned to you",
        });
      }

      // Get the last message to build proper threading
      const lastMessage = ticket.messages[0];

      // Generate threading information
      const messageId = `<reply-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}@${process.env.NEXTAUTH_URL || "ticketsystem.com"}>`;

      // Use the last message's messageId as In-Reply-To, fallback to ticket emailId
      const inReplyTo = lastMessage?.messageId || ticket.emailId;

      // Build proper references chain using the complete messageIds array
      let references = ticket.emailId; // Start with the original email ID

      if (ticket.messageIds && ticket.messageIds.length > 0) {
        // Use the complete messageIds array to build the full References chain
        references = `${ticket.emailId} ${ticket.messageIds.join(" ")}`;
      } else if (lastMessage?.references) {
        // Fallback: If the last message has references, use them and add the last message's messageId
        references = `${lastMessage.references} ${lastMessage.messageId}`;
      } else if (lastMessage?.messageId) {
        // Fallback: If no references but has messageId, start the chain
        references = `${ticket.emailId} ${lastMessage.messageId}`;
      }

      // Create the message
      const message = await ctx.db.message.create({
        data: {
          content: input.content,
          ticketId: input.ticketId,
          userId: ctx.session.user.id,
          isFromUser: false,
          messageId,
          inReplyTo,
          references,
          attachments: input.attachments
            ? {
                create: input.attachments,
              }
            : undefined,
        },
      });

      // Update ticket's last replied timestamp, lastMessageId, and add to messageIds array
      await ctx.db.ticket.update({
        where: { id: input.ticketId },
        data: {
          lastReplied: new Date(),
          lastMessageId: messageId,
          messageIds: {
            push: messageId,
          },
        },
      });

      // Send email reply to the user
      try {
        const { html, text } = await generateTicketReplyEmail(
          ticket.id,
          input.content
        );

        await sendEmail({
          to: ticket.fromEmail,
          subject: `Re: ${ticket.subject} [${ticket.id}]`,
          text,
          html,
          headers: {
            "Message-ID": messageId,
            "In-Reply-To": inReplyTo,
            References: references,
          },
        });
      } catch (error) {
        console.error("Failed to send email:", error);
        // Don't throw error, just log it
      }

      return message;
    }),

  // Get ticket statistics
  getStats: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.session.user.role === "ADMIN") {
      // Admins see all ticket statistics
      const [
        totalTickets,
        openTickets,
        inProgressTickets,
        resolvedTickets,
        closedTickets,
        unassignedTickets,
      ] = await Promise.all([
        ctx.db.ticket.count(),
        ctx.db.ticket.count({ where: { status: "OPEN" } }),
        ctx.db.ticket.count({ where: { status: "IN_PROGRESS" } }),
        ctx.db.ticket.count({ where: { status: "RESOLVED" } }),
        ctx.db.ticket.count({ where: { status: "CLOSED" } }),
        ctx.db.ticket.count({ where: { assignedToId: null } }),
      ]);

      return {
        total: totalTickets,
        open: openTickets,
        inProgress: inProgressTickets,
        resolved: resolvedTickets,
        closed: closedTickets,
        unassigned: unassignedTickets,
      };
    } else {
      // Non-admin users see only their assigned ticket statistics
      const [
        totalTickets,
        openTickets,
        inProgressTickets,
        resolvedTickets,
        closedTickets,
      ] = await Promise.all([
        ctx.db.ticket.count({ where: { assignedToId: ctx.session.user.id } }),
        ctx.db.ticket.count({
          where: {
            status: "OPEN",
            assignedToId: ctx.session.user.id,
          },
        }),
        ctx.db.ticket.count({
          where: {
            status: "IN_PROGRESS",
            assignedToId: ctx.session.user.id,
          },
        }),
        ctx.db.ticket.count({
          where: {
            status: "RESOLVED",
            assignedToId: ctx.session.user.id,
          },
        }),
        ctx.db.ticket.count({
          where: {
            status: "CLOSED",
            assignedToId: ctx.session.user.id,
          },
        }),
      ]);

      return {
        total: totalTickets,
        open: openTickets,
        inProgress: inProgressTickets,
        resolved: resolvedTickets,
        closed: closedTickets,
        unassigned: 0, // Non-admin users don't have unassigned tickets
      };
    }
  }),

  // Bulk update ticket status
  bulkUpdateStatus: protectedProcedure
    .input(
      z.object({
        ticketIds: z.array(z.string()),
        status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { ticketIds, status } = input;

      // Get all tickets to check permissions
      const tickets = await ctx.db.ticket.findMany({
        where: { id: { in: ticketIds } },
        select: { id: true, assignedToId: true },
      });

      if (tickets.length !== ticketIds.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Some tickets were not found",
        });
      }

      // Check permissions - users can only update their assigned tickets, admins can update any
      if (ctx.session.user.role !== "ADMIN") {
        const unauthorizedTickets = tickets.filter(
          (ticket) => ticket.assignedToId !== ctx.session.user.id
        );
        if (unauthorizedTickets.length > 0) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You can only update status of tickets assigned to you",
          });
        }
      }

      // Update all tickets
      const result = await ctx.db.ticket.updateMany({
        where: { id: { in: ticketIds } },
        data: { status },
      });

      return {
        success: true,
        updatedCount: result.count,
      };
    }),

  // Bulk assign tickets
  bulkAssign: protectedProcedure
    .input(
      z.object({
        ticketIds: z.array(z.string()),
        userId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { ticketIds, userId } = input;

      // Only admins can assign tickets
      if (ctx.session.user.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can assign tickets",
        });
      }

      // Verify the user exists
      const user = await ctx.db.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      // Get tickets to send notifications
      const tickets = await ctx.db.ticket.findMany({
        where: { id: { in: ticketIds } },
        select: { id: true, subject: true, fromEmail: true },
      });

      if (tickets.length !== ticketIds.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Some tickets were not found",
        });
      }

      // Update all tickets
      const result = await ctx.db.ticket.updateMany({
        where: { id: { in: ticketIds } },
        data: { assignedToId: userId },
      });

      // Send notification email to the assigned user
      try {
        await sendEmail({
          to: user.email,
          subject: `Bulk Ticket Assignment: ${tickets.length} tickets assigned`,
          text: `You have been assigned ${tickets.length} new tickets:

${tickets.map((ticket) => `- ${ticket.subject} (ID: ${ticket.id})`).join("\n")}

Please review and respond to these tickets as soon as possible.`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Bulk Ticket Assignment</h2>
              <p>You have been assigned <strong>${
                tickets.length
              }</strong> new tickets:</p>
              
              <ul style="list-style-type: none; padding: 0;">
                ${tickets
                  .map(
                    (ticket) => `
                  <li style="padding: 10px; margin: 5px 0; background-color: #f8f9fa; border-left: 4px solid #007bff;">
                    <strong>${ticket.subject}</strong><br>
                    <small style="color: #666;">ID: ${ticket.id}</small>
                  </li>
                `
                  )
                  .join("")}
              </ul>
              
              <p>Please review and respond to these tickets as soon as possible.</p>
            </div>
          `,
        });
      } catch (error) {
        console.error(
          "Failed to send bulk assignment notification email:",
          error
        );
        // Don't throw error, just log it
      }

      return {
        success: true,
        updatedCount: result.count,
        assignedTo: user,
      };
    }),
});
