import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Verify the request is from a legitimate cron service
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log(
      "Campaign execution cron job: No scheduled campaigns to execute"
    );

    return NextResponse.json({
      success: true,
      message: "No scheduled campaigns to execute (manual execution only)",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Campaign execution cron job error:", error);

    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
