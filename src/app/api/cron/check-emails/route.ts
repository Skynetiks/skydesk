import { checkForNewEmails } from "@/lib/imap-email-checker";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Verify the request is from a legitimate cron service
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Cron job triggered: Checking for new emails");

    // Add timeout to prevent hanging - increased to 90 seconds for batch processing
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error("Email check timeout after 90 seconds")),
        90000
      );
    });

    // Check for new emails with timeout
    await Promise.race([checkForNewEmails(), timeoutPromise]);

    return NextResponse.json({
      success: true,
      message: "Email check completed successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Cron job error:", error);

    // Log more detailed error information
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }

    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
