import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { sendEmail } from "@/lib/email";
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
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().nullish(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { limit, cursor, status, priority, assignedToId } = input;

      // Users can only see their assigned tickets, admins can see all
      const whereClause: {
        status?: TicketStatus;
        priority?: Priority;
        assignedToId?: string;
      } = {
        status: status as TicketStatus | undefined,
        priority: priority as Priority | undefined,
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

      const ticket = await ctx.db.ticket.create({
        data: {
          subject: input.subject,
          fromEmail: input.fromEmail,
          fromName: input.fromName,
          emailId: input.emailId,
          createdById: systemUser.id,
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

      // Send confirmation email to the ticket creator
      try {
        const confirmationMessageId = `ticket-confirmation-${ticket.id}@${
          process.env.NEXTAUTH_URL?.replace(/^https?:\/\//, "") || "company.com"
        }`;

        await sendEmail({
          to: input.fromEmail,
          subject: `Ticket Received: ${input.subject} [${ticket.id}]`,
          text: `Thank you for contacting us. We have received your ticket and opened a case for you.

Ticket Details:
- Ticket ID: ${ticket.id}
- Subject: ${input.subject}
- Status: Open
- Priority: Medium

Your original message:
${input.content}

You can reply to this email thread to add more information to your ticket. Our support team will review your request and get back to you as soon as possible.

If you need to provide additional information or have any questions, please reply to this email.

Best regards,
Support Team

---
Ticket ID: ${ticket.id}
This email thread is linked to your support ticket.`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background-color: #f8f9fa; padding: 20px; border-left: 4px solid #007bff;">
                <h2 style="color: #007bff; margin: 0 0 15px 0;">Ticket Received</h2>
                <p style="margin: 0 0 20px 0; color: #333;">Thank you for contacting us. We have received your ticket and opened a case for you.</p>
              </div>
              
              <div style="background-color: #ffffff; padding: 20px; border: 1px solid #e9ecef; margin: 20px 0;">
                <h3 style="color: #333; margin: 0 0 15px 0;">Ticket Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e9ecef; font-weight: bold; color: #333;">Ticket ID:</td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e9ecef; color: #666;">${ticket.id}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e9ecef; font-weight: bold; color: #333;">Subject:</td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e9ecef; color: #666;">${input.subject}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e9ecef; font-weight: bold; color: #333;">Status:</td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #e9ecef; color: #28a745;">Open</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #333;">Priority:</td>
                    <td style="padding: 8px 0; color: #ffc107;">Medium</td>
                  </tr>
                </table>
              </div>
              
              <div style="background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;">
                <h4 style="margin: 0 0 10px 0; color: #856404;">Your Original Message:</h4>
                <div style="white-space: pre-wrap; background-color: white; padding: 15px; border-radius: 4px; color: #333;">${input.content}</div>
              </div>
              
              <div style="background-color: #d1ecf1; padding: 15px; border-left: 4px solid #17a2b8; margin: 20px 0;">
                <p style="margin: 0; color: #0c5460;">
                  <strong>Important:</strong> You can reply to this email thread to add more information to your ticket. 
                  Our support team will review your request and get back to you as soon as possible.
                </p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <p style="color: #666; margin: 0;">Best regards,<br>Support Team</p>
              </div>
              
              <hr style="border: none; border-top: 1px solid #e9ecef; margin: 30px 0;">
              <div style="text-align: center; color: #999; font-size: 12px;">
                <p style="margin: 0;"><strong>Ticket ID:</strong> ${ticket.id}</p>
                <p style="margin: 5px 0 0 0;">This email thread is linked to your support ticket.</p>
              </div>
            </div>
          `,
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
          `Confirmation email sent to ${input.fromEmail} for ticket ${ticket.id}`
        );
      } catch (error) {
        console.error("Failed to send confirmation email:", error);
        // Don't throw error, just log it - we don't want to fail ticket creation if email fails
      }

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
            orderBy: { createdAt: "asc" }, // Get messages in chronological order
            where: { isFromUser: false }, // Get system messages (confirmation emails)
            take: 1, // Get the first system message (confirmation email)
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

      // Find the confirmation email (first system message) to reply to
      const confirmationMessage = ticket.messages[0];

      // Generate threading information
      const messageId = `<reply-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}@${process.env.NEXTAUTH_URL || "ticketsystem.com"}>`;

      // Use the confirmation message's messageId as In-Reply-To, fallback to ticket emailId
      const inReplyTo = confirmationMessage?.messageId || ticket.emailId;

      // Build references chain: include the confirmation message's references if it exists, then add the confirmation message's messageId
      const references = confirmationMessage?.references
        ? `${confirmationMessage.references} ${
            confirmationMessage.messageId || ticket.emailId
          }`
        : confirmationMessage?.messageId || ticket.emailId;

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

      // Update ticket's last replied timestamp
      await ctx.db.ticket.update({
        where: { id: input.ticketId },
        data: {
          lastReplied: new Date(),
        },
      });

      // Send email reply to the user
      try {
        await sendEmail({
          to: ticket.fromEmail,
          subject: `Re: Ticket Received: ${ticket.subject} [${ticket.id}]`,
          text: `${input.content}

---
Ticket ID: ${ticket.id}
This email thread is linked to your support ticket.`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background-color: #ffffff; padding: 20px; border: 1px solid #e9ecef; margin: 20px 0;">
                ${input.content.replace(/\n/g, "<br>")}
              </div>
              
              <hr style="border: none; border-top: 1px solid #e9ecef; margin: 30px 0;">
              <div style="text-align: center; color: #999; font-size: 12px;">
                <p style="margin: 0;"><strong>Ticket ID:</strong> ${
                  ticket.id
                }</p>
                <p style="margin: 5px 0 0 0;">This email thread is linked to your support ticket.</p>
              </div>
            </div>
          `,
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

  // Get ticket statistics (admin only)
  getStats: protectedProcedure.query(async ({ ctx }) => {
    // Only admins can view statistics
    if (ctx.session.user.role !== "ADMIN") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only admins can view statistics",
      });
    }

    const [
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      closedTickets,
    ] = await Promise.all([
      ctx.db.ticket.count(),
      ctx.db.ticket.count({ where: { status: "OPEN" } }),
      ctx.db.ticket.count({ where: { status: "IN_PROGRESS" } }),
      ctx.db.ticket.count({ where: { status: "RESOLVED" } }),
      ctx.db.ticket.count({ where: { status: "CLOSED" } }),
    ]);

    return {
      total: totalTickets,
      open: openTickets,
      inProgress: inProgressTickets,
      resolved: resolvedTickets,
      closed: closedTickets,
    };
  }),
});
