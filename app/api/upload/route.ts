import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const tempDir = path.join(process.cwd(), "temp");

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("video");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No video file found." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await mkdir(tempDir, { recursive: true });

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filename = `${Date.now()}-${safeName}`;
    const fullPath = path.join(tempDir, filename);

    await writeFile(fullPath, buffer);

    return NextResponse.json({
      message: "Video saved",
      path: `temp/${filename}`
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to save video",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { path?: string };
    const relativePath = body.path;

    if (!relativePath) {
      return NextResponse.json({ error: "File path is required." }, { status: 400 });
    }

    if (!relativePath.startsWith("temp/")) {
      return NextResponse.json({ error: "Invalid file path." }, { status: 400 });
    }

    const filename = relativePath.replace(/^temp\//, "");
    const fullPath = path.join(tempDir, filename);

    // Prevent path traversal and enforce writes only inside temp.
    if (!fullPath.startsWith(`${tempDir}${path.sep}`)) {
      return NextResponse.json({ error: "Invalid file path." }, { status: 400 });
    }

    await unlink(fullPath);

    return NextResponse.json({ message: "Video deleted" });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to delete video",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
