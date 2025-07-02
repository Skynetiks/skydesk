import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Only image files are allowed" },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size must be less than 5MB" },
        { status: 400 }
      );
    }

    // Validate image dimensions
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Get image dimensions
    const dimensions = await getImageDimensions(buffer, file.name);

    if (!dimensions) {
      return NextResponse.json(
        { error: "Unable to read image dimensions" },
        { status: 400 }
      );
    }

    // Validate dimensions (recommended: 200x200 to 500x500)
    // For SVG files, we use default dimensions, so skip strict validation
    const isSvg = file.name.toLowerCase().endsWith(".svg");
    const aspectRatio = dimensions.width / dimensions.height;

    if (!isSvg) {
      if (dimensions.width < 100 || dimensions.height < 100) {
        return NextResponse.json(
          { error: "Image dimensions must be at least 100x100 pixels" },
          { status: 400 }
        );
      }

      if (dimensions.width > 1000 || dimensions.height > 1000) {
        return NextResponse.json(
          { error: "Image dimensions must not exceed 1000x1000 pixels" },
          { status: 400 }
        );
      }

      // Validate aspect ratio (should be roughly square for logos)
      if (aspectRatio < 0.5 || aspectRatio > 2) {
        return NextResponse.json(
          {
            error:
              "Logo should have a roughly square aspect ratio (0.5 to 2.0)",
          },
          { status: 400 }
        );
      }
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), "public", "uploads");
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const extension = file.name.split(".").pop();
    const filename = `logo-${timestamp}.${extension}`;
    const filepath = join(uploadsDir, filename);

    // Write file
    await writeFile(filepath, buffer);

    // Return the public URL
    const url = `/uploads/${filename}`;

    return NextResponse.json({
      url,
      filename,
      dimensions: {
        width: dimensions.width,
        height: dimensions.height,
        aspectRatio: aspectRatio.toFixed(2),
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

async function getImageDimensions(
  buffer: Buffer,
  filename: string
): Promise<{ width: number; height: number } | null> {
  try {
    console.log(
      `Attempting to detect dimensions for: ${filename} (${buffer.length} bytes)`
    );
    // Simple dimension detection for common formats
    // This is a basic implementation - in production you might want to use a library like 'sharp'

    // Check for PNG
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      console.log(`PNG detected: ${width}x${height}`);
      return { width, height };
    }

    // Check for JPEG
    if (buffer[0] === 0xff && buffer[1] === 0xd8) {
      let offset = 2;
      while (offset < buffer.length - 2) {
        if (buffer[offset] === 0xff && buffer[offset + 1] === 0xc0) {
          const height = buffer.readUInt16BE(offset + 5);
          const width = buffer.readUInt16BE(offset + 7);
          console.log(`JPEG detected: ${width}x${height}`);
          return { width, height };
        }
        offset += 2 + buffer.readUInt16BE(offset + 2);
      }
      console.log("JPEG format detected but could not find dimensions");
    }

    // Check for GIF
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
      const width = buffer.readUInt16LE(6);
      const height = buffer.readUInt16LE(8);
      console.log(`GIF detected: ${width}x${height}`);
      return { width, height };
    }

    // Check for WebP
    if (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    ) {
      const width = buffer.readUInt16LE(26) + 1;
      const height = buffer.readUInt16LE(28) + 1;
      console.log(`WebP detected: ${width}x${height}`);
      return { width, height };
    }

    // For SVG and other formats, return default dimensions
    // This allows SVG uploads but with a warning
    if (filename.toLowerCase().endsWith(".svg")) {
      console.log("SVG file detected, using default dimensions");
      return { width: 200, height: 200 };
    }

    // For other formats we couldn't detect, log and use defaults
    console.log(
      `Could not detect dimensions for file: ${filename}, using defaults`
    );
    return { width: 200, height: 200 };
  } catch (error) {
    console.error("Error reading image dimensions:", error);
    console.log(`Using default dimensions for file: ${filename}`);
    return { width: 200, height: 200 }; // Default fallback
  }
}
