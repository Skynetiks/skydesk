import { z } from "zod";
import { createTRPCRouter, protectedProcedure, adminProcedure } from "../trpc";

export const campaignRouter = createTRPCRouter({
  // Get all campaigns
  getAll: protectedProcedure
    .input(
      z.object({
        status: z
          .enum(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"])
          .optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { limit, cursor, status } = input;

      const campaigns = await ctx.db.campaign.findMany({
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        where: status ? { status } : undefined,
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              recipients: true,
              executions: true,
            },
          },
        },
      });

      let nextCursor: typeof cursor | undefined = undefined;
      if (campaigns.length > limit) {
        const nextItem = campaigns.pop();
        nextCursor = nextItem!.id;
      }

      return {
        items: campaigns,
        nextCursor,
      };
    }),

  // Get campaign by ID
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const campaign = await ctx.db.campaign.findUnique({
        where: { id: input.id },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          recipients: {
            include: {
              client: {
                select: {
                  id: true,
                  name: true,
                  companyName: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
          },
          executions: {
            orderBy: { executionTime: "desc" },
          },
        },
      });

      if (!campaign) {
        throw new Error("Campaign not found");
      }

      return campaign;
    }),

  // Create new campaign
  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1, "Campaign name is required"),
        subject: z.string().min(1, "Subject is required"),
        body: z.string().min(1, "Email body is required"),
        concurrency: z.number().min(1).max(50).default(5),

        clientIds: z.array(z.string()).optional(), // Client IDs to include in campaign
        additionalEmails: z.array(z.string().email()).optional(), // Additional email addresses
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { clientIds, additionalEmails, ...campaignData } = input;

      // Create campaign
      const campaign = await ctx.db.campaign.create({
        data: {
          ...campaignData,
          createdById: ctx.session.user.id,
        },
      });

      // Add recipients from clients
      const recipients: Array<{
        email: string;
        name?: string;
        clientId?: string;
      }> = [];

      console.log("Creating campaign with clientIds:", clientIds);
      console.log("Additional emails:", additionalEmails);

      if (clientIds && clientIds.length > 0) {
        const clients = await ctx.db.client.findMany({
          where: {
            id: { in: clientIds },
            // Allow both active and inactive clients - user choice
          },
          select: { id: true, name: true, emails: true },
        });

        console.log(
          "Found clients:",
          clients.map((c) => ({
            id: c.id,
            name: c.name,
            emailCount: c.emails.length,
          }))
        );

        for (const client of clients) {
          console.log(
            `Processing client ${client.name} with ${client.emails.length} emails:`,
            client.emails
          );
          for (const email of client.emails) {
            recipients.push({
              email,
              name: client.name,
              clientId: client.id,
            });
          }
        }
      }

      // Add additional emails
      if (additionalEmails) {
        console.log("Adding additional emails:", additionalEmails);
        for (const email of additionalEmails) {
          recipients.push({ email });
        }
      }

      console.log("Total recipients to create:", recipients.length);
      console.log("Recipients:", recipients);

      // Create recipients
      if (recipients.length > 0) {
        await ctx.db.campaignRecipient.createMany({
          data: recipients.map((recipient) => ({
            ...recipient,
            campaignId: campaign.id,
          })),
        });

        // Update campaign with recipient count
        await ctx.db.campaign.update({
          where: { id: campaign.id },
          data: { totalRecipients: recipients.length },
        });

        console.log(
          `Created ${recipients.length} recipients for campaign ${campaign.id}`
        );
      } else {
        console.log("No recipients to create for campaign");
      }

      return campaign;
    }),

  // Update campaign
  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        subject: z.string().min(1).optional(),
        body: z.string().min(1).optional(),
        status: z
          .enum(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"])
          .optional(),
        concurrency: z.number().min(1).max(50).optional(),

        clientIds: z.array(z.string()).optional(),
        additionalEmails: z.array(z.string().email()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, clientIds, additionalEmails, ...updateData } = input;

      // Check if campaign is in DRAFT status (only DRAFT campaigns can be edited)
      const existingCampaign = await ctx.db.campaign.findUnique({
        where: { id },
      });

      if (!existingCampaign) {
        throw new Error("Campaign not found");
      }

      if (existingCampaign.status !== "DRAFT") {
        throw new Error("Only campaigns in DRAFT status can be edited");
      }

      // Update campaign basic info
      const campaign = await ctx.db.campaign.update({
        where: { id },
        data: updateData,
      });

      // Update recipients if provided
      if (clientIds !== undefined || additionalEmails !== undefined) {
        // Delete existing recipients
        await ctx.db.campaignRecipient.deleteMany({
          where: { campaignId: id },
        });

        // Add new recipients
        const recipients: Array<{
          email: string;
          name?: string;
          clientId?: string;
        }> = [];

        if (clientIds && clientIds.length > 0) {
          const clients = await ctx.db.client.findMany({
            where: { id: { in: clientIds } },
            select: { id: true, name: true, emails: true },
          });

          for (const client of clients) {
            for (const email of client.emails) {
              recipients.push({
                email,
                name: client.name,
                clientId: client.id,
              });
            }
          }
        }

        if (additionalEmails) {
          for (const email of additionalEmails) {
            recipients.push({ email });
          }
        }

        // Create new recipients
        if (recipients.length > 0) {
          await ctx.db.campaignRecipient.createMany({
            data: recipients.map((recipient) => ({
              ...recipient,
              campaignId: id,
            })),
          });
        }

        // Update campaign with new recipient count
        await ctx.db.campaign.update({
          where: { id },
          data: { totalRecipients: recipients.length },
        });
      }

      return campaign;
    }),

  // Update campaign status
  updateStatus: adminProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, status } = input;

      const campaign = await ctx.db.campaign.update({
        where: { id },
        data: { status },
      });

      return campaign;
    }),

  // Delete campaign
  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id } = input;

      // Check if campaign exists
      const campaign = await ctx.db.campaign.findUnique({
        where: { id },
      });

      if (!campaign) {
        throw new Error("Campaign not found");
      }

      // Only allow deletion of campaigns that are not currently running (not ACTIVE)
      if (campaign.status === "ACTIVE") {
        throw new Error(
          "Cannot delete a campaign that is currently running. Please pause or stop it first."
        );
      }

      // Delete the campaign (this will cascade delete recipients and executions)
      await ctx.db.campaign.delete({
        where: { id },
      });

      return { success: true };
    }),

  // Execute campaign (queue emails for sending)
  execute: adminProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id } = input;

      console.log(`Starting campaign execution for campaign ${id}`);

      // Check if any campaign is currently running
      const runningExecution = await ctx.db.campaignExecution.findFirst({
        where: {
          status: "RUNNING",
        },
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (runningExecution) {
        if (runningExecution.campaignId !== id) {
          throw new Error(
            `Cannot start campaign execution. Campaign "${runningExecution.campaign.name}" is currently running. Only one campaign can be executed at a time.`
          );
        } else {
          throw new Error(
            "This campaign is already running. Please wait for it to complete before starting another execution."
          );
        }
      }

      // Get campaign with pending recipients
      const campaign = await ctx.db.campaign.findUnique({
        where: { id },
        include: {
          recipients: {
            where: { status: "PENDING" },
            include: {
              client: {
                select: {
                  name: true,
                  companyName: true,
                },
              },
            },
          },
        },
      });

      if (!campaign) {
        throw new Error("Campaign not found");
      }

      if (campaign.status !== "ACTIVE") {
        throw new Error("Campaign is not active");
      }

      if (campaign.recipients.length === 0) {
        console.log(`Campaign ${id}: No pending recipients found`);
        return { queued: 0, message: "No pending recipients" };
      }

      console.log(
        `Campaign ${id}: Found ${campaign.recipients.length} pending recipients`
      );

      // Create execution record
      const execution = await ctx.db.campaignExecution.create({
        data: {
          campaignId: id,
          status: "RUNNING",
        },
      });

      try {
        // Mark all pending recipients as QUEUED
        const updateResult = await ctx.db.campaignRecipient.updateMany({
          where: {
            campaignId: id,
            status: "PENDING",
          },
          data: {
            status: "QUEUED",
          },
        });

        console.log(
          `Campaign ${id}: Queued ${updateResult.count} recipients for sending`
        );

        // Update execution record
        await ctx.db.campaignExecution.update({
          where: { id: execution.id },
          data: {
            status: "COMPLETED",
            emailsSent: 0,
            emailsFailed: 0,
          },
        });

        // Update campaign stats
        await ctx.db.campaign.update({
          where: { id },
          data: {
            lastExecuted: new Date(),
          },
        });

        console.log(
          `Campaign ${id}: Successfully queued ${updateResult.count} emails for processing`
        );
        return {
          queued: updateResult.count,
          message: "Emails queued successfully",
        };
      } catch (error) {
        console.error("Campaign execution failed:", error);

        // Update execution record with error
        await ctx.db.campaignExecution.update({
          where: { id: execution.id },
          data: {
            status: "FAILED",
            errorMessage:
              error instanceof Error ? error.message : "Unknown error",
          },
        });

        throw error;
      }
    }),

  // Get campaign statistics
  getStats: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const campaign = await ctx.db.campaign.findUnique({
        where: { id: input.id },
        include: {
          recipients: true,
          executions: {
            orderBy: { executionTime: "desc" },
            take: 10,
          },
        },
      });

      if (!campaign) {
        throw new Error("Campaign not found");
      }

      const stats = {
        total: campaign.recipients.length,
        sent: campaign.recipients.filter((r) => r.status === "SENT").length,
        failed: campaign.recipients.filter((r) => r.status === "FAILED").length,
        pending: campaign.recipients.filter((r) => r.status === "PENDING")
          .length,
        queued: campaign.recipients.filter((r) => r.status === "QUEUED").length,
        bounced: campaign.recipients.filter((r) => r.status === "BOUNCED")
          .length,
        successRate:
          campaign.recipients.length > 0
            ? (campaign.recipients.filter((r) => r.status === "SENT").length /
                campaign.recipients.length) *
              100
            : 0,
        recentExecutions: campaign.executions,
      };

      return stats;
    }),

  // Check if any campaign is currently running
  getRunningCampaign: protectedProcedure.query(async ({ ctx }) => {
    const runningExecution = await ctx.db.campaignExecution.findFirst({
      where: {
        status: "RUNNING",
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    return runningExecution;
  }),

  // Check if a specific campaign is currently running
  isCampaignRunning: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const runningExecution = await ctx.db.campaignExecution.findFirst({
        where: {
          campaignId: input.id,
          status: "RUNNING",
        },
      });

      return !!runningExecution;
    }),
});
