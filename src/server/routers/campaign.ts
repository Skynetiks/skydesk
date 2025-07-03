import { z } from "zod";
import { createTRPCRouter, protectedProcedure, adminProcedure } from "../trpc";
import { generateEmailTemplate } from "@/lib/email-templates";
import { sendEmail } from "@/lib/email";

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
        delaySeconds: z.number().min(0).max(3600).default(10),
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
        delaySeconds: z.number().min(0).max(3600).optional(),
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

  // Execute campaign (send emails)
  execute: adminProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id } = input;

      console.log(`Starting campaign execution for campaign ${id}`);

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
        return { sent: 0, failed: 0, message: "No pending recipients" };
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

      let sentCount = 0;
      let failedCount = 0;

      try {
        // Get company branding for email template
        const branding = await ctx.db.configuration.findMany({
          where: {
            key: {
              in: [
                "COMPANY_NAME",
                "COMPANY_LOGO",
                "COMPANY_WEBSITE",
                "COMPANY_PHONE",
                "COMPANY_EMAIL",
                "COMPANY_ADDRESS",
              ],
            },
          },
        });

        // Check email configuration
        const emailConfig = await ctx.db.configuration.findMany({
          where: {
            key: {
              in: ["EMAIL_HOST", "EMAIL_USER", "EMAIL_PASS", "SUPPORT_EMAIL"],
            },
          },
        });

        console.log(
          "Email configuration found:",
          emailConfig.map((c) => ({
            key: c.key,
            hasValue: !!c.value,
            value: c.key === "EMAIL_PASS" ? "[HIDDEN]" : c.value,
          }))
        );

        // Check if email configuration is properly set
        const emailHost = emailConfig.find(
          (c) => c.key === "EMAIL_HOST"
        )?.value;
        const emailUser = emailConfig.find(
          (c) => c.key === "EMAIL_USER"
        )?.value;
        const emailPass = emailConfig.find(
          (c) => c.key === "EMAIL_PASS"
        )?.value;

        if (!emailHost || emailHost === "smtp.gmail.com") {
          console.log(
            "Warning: Email host is default value, may not be configured"
          );
        }
        if (!emailUser || emailUser === "your-email@gmail.com") {
          console.log(
            "Warning: Email user is default value, may not be configured"
          );
        }
        if (!emailPass || emailPass === "your-app-password") {
          console.log(
            "Warning: Email password is default value, may not be configured"
          );
        }

        if (!emailHost) {
          throw new Error("Email host not configured");
        }
        if (!emailUser) {
          throw new Error("Email user not configured");
        }
        if (!emailPass) {
          throw new Error("Email password not configured");
        }

        const brandingData = {
          companyName:
            branding.find((b) => b.key === "COMPANY_NAME")?.value ||
            "Support Team",
          companyLogo: branding.find((b) => b.key === "COMPANY_LOGO")?.value,
          companyWebsite: branding.find((b) => b.key === "COMPANY_WEBSITE")
            ?.value,
          companyPhone: branding.find((b) => b.key === "COMPANY_PHONE")?.value,
          companyEmail: branding.find((b) => b.key === "COMPANY_EMAIL")?.value,
          companyAddress: branding.find((b) => b.key === "COMPANY_ADDRESS")
            ?.value,
        };

        console.log("Branding data:", brandingData);

        // Send emails to recipients with concurrency and delay
        const recipientsToProcess = campaign.recipients;

        console.log(
          `Processing ${recipientsToProcess.length} recipients with concurrency ${campaign.concurrency} and delay ${campaign.delaySeconds}s`
        );

        // Process recipients in batches based on concurrency
        for (
          let i = 0;
          i < recipientsToProcess.length;
          i += campaign.concurrency
        ) {
          const batch = recipientsToProcess.slice(i, i + campaign.concurrency);
          console.log(
            `Processing batch ${Math.floor(i / campaign.concurrency) + 1}: ${
              batch.length
            } recipients`
          );

          // Send emails in parallel for this batch
          const batchPromises = batch.map(async (recipient) => {
            try {
              console.log(
                `Sending email to ${recipient.email} for campaign ${id}`
              );

              // Generate email content
              const html = generateEmailTemplate(
                campaign.body,
                brandingData,
                campaign.subject
              );

              console.log(`Generated email template for ${recipient.email}`);

              // Send email
              await sendEmail({
                to: recipient.email,
                subject: campaign.subject,
                html,
                text: campaign.body, // Plain text version
              });

              console.log(`Email sent successfully to ${recipient.email}`);

              // Update recipient status
              await ctx.db.campaignRecipient.update({
                where: { id: recipient.id },
                data: {
                  status: "SENT",
                  sentAt: new Date(),
                },
              });

              console.log(
                `Updated recipient status to SENT for ${recipient.email}`
              );

              return { success: true, recipient };
            } catch (error) {
              console.error(
                `Failed to send email to ${recipient.email}:`,
                error
              );

              // Update recipient status
              await ctx.db.campaignRecipient.update({
                where: { id: recipient.id },
                data: {
                  status: "FAILED",
                  failedAt: new Date(),
                  errorMessage:
                    error instanceof Error ? error.message : "Unknown error",
                },
              });

              return { success: false, recipient };
            }
          });

          // Wait for all emails in this batch to complete
          const batchResults = await Promise.all(batchPromises);

          // Count successes and failures
          batchResults.forEach((result) => {
            if (result.success) {
              sentCount++;
            } else {
              failedCount++;
            }
          });

          console.log(
            `Batch completed: ${sentCount} sent, ${failedCount} failed`
          );

          // Add delay between batches (except for the last batch)
          if (
            i + campaign.concurrency < recipientsToProcess.length &&
            campaign.delaySeconds > 0
          ) {
            console.log(
              `Waiting ${campaign.delaySeconds} seconds before next batch`
            );
            await new Promise((resolve) =>
              setTimeout(resolve, campaign.delaySeconds * 1000)
            );
          }
        }

        // Update execution record
        await ctx.db.campaignExecution.update({
          where: { id: execution.id },
          data: {
            status: "COMPLETED",
            emailsSent: sentCount,
            emailsFailed: failedCount,
          },
        });

        // Update campaign stats
        await ctx.db.campaign.update({
          where: { id },
          data: {
            sentCount: { increment: sentCount },
            failedCount: { increment: failedCount },
            lastExecuted: new Date(),
          },
        });

        // Check if all recipients have been processed (no more PENDING recipients)
        const remainingPendingRecipients = await ctx.db.campaignRecipient.count(
          {
            where: {
              campaignId: id,
              status: "PENDING",
            },
          }
        );

        console.log(
          `Remaining pending recipients: ${remainingPendingRecipients}`
        );

        // If no pending recipients remain, mark campaign as COMPLETED
        if (remainingPendingRecipients === 0) {
          console.log(
            "All recipients processed, marking campaign as COMPLETED"
          );
          await ctx.db.campaign.update({
            where: { id },
            data: {
              status: "COMPLETED",
            },
          });
        }

        console.log(
          `Campaign execution completed: ${sentCount} sent, ${failedCount} failed`
        );
        return { sent: sentCount, failed: failedCount };
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
});
