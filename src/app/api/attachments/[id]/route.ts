import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const attachment = await db.attachment.findUnique({
      where: { id },
    });

    if (!attachment) {
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 }
      );
    }

    // Handle base64 data URLs
    if (attachment.url.startsWith("data:")) {
      const [, base64Data] = attachment.url.split(",");
      const fileBuffer = Buffer.from(base64Data, "base64");

      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": attachment.mimeType,
          "Content-Disposition": `attachment; filename="${attachment.originalName}"`,
          "Content-Length": attachment.size.toString(),
        },
      });
    } else {
      // Handle regular URLs (fallback for existing attachments)
      return NextResponse.json(
        { error: "Invalid attachment format" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error serving attachment:", error);
    return NextResponse.json(
      { error: "Failed to serve attachment" },
      { status: 500 }
    );
  }
}
