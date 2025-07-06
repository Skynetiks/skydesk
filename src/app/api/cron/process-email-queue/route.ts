import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { generateEmailTemplate } from "@/lib/email-templates";
import { sendEmail } from "@/lib/email";

export async function GET(request: NextRequest) {
  try {
    // Verify the request is from a legitimate cron service
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Starting email queue processing...");

    // Get all campaigns with queued recipients
    const campaignsWithQueuedEmails = await db.campaign.findMany({
      where: {
        status: "ACTIVE",
        recipients: {
          some: {
            status: "QUEUED",
          },
        },
      },
      include: {
        recipients: {
          where: {
            status: "QUEUED",
          },
          include: {
            client: {
              select: {
                name: true,
                companyName: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc", // Process oldest first
          },
        },
      },
    });

    if (campaignsWithQueuedEmails.length === 0) {
      console.log("No campaigns with queued emails found");
      return NextResponse.json({
        success: true,
        message: "No queued emails to process",
        processed: 0,
        timestamp: new Date().toISOString(),
      });
    }

    console.log(
      `Found ${campaignsWithQueuedEmails.length} campaigns with queued emails`
    );

    let totalProcessed = 0;
    let totalSent = 0;
    let totalFailed = 0;

    // Process each campaign
    for (const campaign of campaignsWithQueuedEmails) {
      console.log(`Processing campaign: ${campaign.name} (${campaign.id})`);
      console.log(`Queued recipients: ${campaign.recipients.length}`);

      // Get company branding for email template
      const branding = await db.configuration.findMany({
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
      const emailConfig = await db.configuration.findMany({
        where: {
          key: {
            in: ["EMAIL_HOST", "EMAIL_USER", "EMAIL_PASS", "SENDER_EMAIL"],
          },
        },
      });

      // Validate email configuration
      const emailHost = emailConfig.find((c) => c.key === "EMAIL_HOST")?.value;
      const emailUser = emailConfig.find((c) => c.key === "EMAIL_USER")?.value;
      const emailPass = emailConfig.find((c) => c.key === "EMAIL_PASS")?.value;

      if (!emailHost || !emailUser || !emailPass) {
        console.error("Email configuration incomplete, skipping campaign");
        continue;
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

      // Process recipients in batches based on campaign concurrency setting
      const recipientsToProcess = campaign.recipients;
      const batchSize = Math.min(campaign.concurrency, 50); // Use concurrency as batch size, cap at 50 per cron run

      console.log(
        `Processing ${Math.min(
          recipientsToProcess.length,
          batchSize
        )} recipients with concurrency ${batchSize}`
      );

      // Take only the first batch for this cron run
      const batch = recipientsToProcess.slice(0, batchSize);

      // Send emails in parallel for this batch
      const batchPromises = batch.map(async (recipient) => {
        try {
          console.log(
            `Sending email to ${recipient.email} for campaign ${campaign.id}`
          );

          // Generate email content
          const html = generateEmailTemplate(
            campaign.body,
            brandingData,
            campaign.subject
          );

          // Send email
          await sendEmail({
            to: recipient.email,
            subject: campaign.subject,
            html,
            text: campaign.body, // Plain text version
          });

          console.log(`Email sent successfully to ${recipient.email}`);

          // Update recipient status
          await db.campaignRecipient.update({
            where: { id: recipient.id },
            data: {
              status: "SENT",
              sentAt: new Date(),
            },
          });

          return { success: true, recipient };
        } catch (error) {
          console.error(`Failed to send email to ${recipient.email}:`, error);

          // Update recipient status
          await db.campaignRecipient.update({
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
      let campaignSent = 0;
      let campaignFailed = 0;

      batchResults.forEach((result) => {
        if (result.success) {
          campaignSent++;
          totalSent++;
        } else {
          campaignFailed++;
          totalFailed++;
        }
      });

      totalProcessed += batch.length;

      console.log(
        `Campaign ${campaign.name}: Batch completed - ${campaignSent} sent, ${campaignFailed} failed`
      );

      // Update campaign stats
      await db.campaign.update({
        where: { id: campaign.id },
        data: {
          sentCount: { increment: campaignSent },
          failedCount: { increment: campaignFailed },
          lastExecuted: new Date(),
        },
      });

      // Check if all recipients have been processed (no more QUEUED recipients)
      const remainingQueuedRecipients = await db.campaignRecipient.count({
        where: {
          campaignId: campaign.id,
          status: "QUEUED",
        },
      });

      console.log(
        `Campaign ${campaign.name}: Remaining queued recipients: ${remainingQueuedRecipients}`
      );

      // If no queued recipients remain, mark campaign as COMPLETED
      if (remainingQueuedRecipients === 0) {
        console.log(
          `Campaign ${campaign.name}: All recipients processed, marking as COMPLETED`
        );
        await db.campaign.update({
          where: { id: campaign.id },
          data: {
            status: "COMPLETED",
          },
        });
      }
    }

    console.log(
      `Email queue processing completed: ${totalProcessed} processed, ${totalSent} sent, ${totalFailed} failed`
    );

    return NextResponse.json({
      success: true,
      message: "Email queue processed successfully",
      processed: totalProcessed,
      sent: totalSent,
      failed: totalFailed,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Email queue processing error:", error);

    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
