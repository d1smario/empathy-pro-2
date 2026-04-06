import { promises as fs } from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { GENERATED_EXERCISE_IMAGE_MANIFEST } from "@/lib/training/builder/generated-image-manifest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const exerciseId = (req.nextUrl.searchParams.get("exerciseId") ?? "").trim();
  if (!exerciseId) {
    return NextResponse.json({ error: "Missing exerciseId" }, { status: 400 });
  }

  const sourceFile = GENERATED_EXERCISE_IMAGE_MANIFEST[exerciseId];
  if (!sourceFile) {
    return NextResponse.json({ error: "Generated image not found" }, { status: 404 });
  }

  try {
    const safeFileName = path.basename(sourceFile);
    const sourcePath = path.join(
      process.cwd(),
      "public",
      "assets",
      "empathy",
      "exercises",
      "generated",
      safeFileName,
    );
    const buffer = await fs.readFile(sourcePath);
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read generated image";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
