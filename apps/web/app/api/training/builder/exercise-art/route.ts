import { NextRequest, NextResponse } from "next/server";
import { loadUnifiedExerciseCatalog } from "@/lib/training/exercise-library/catalog-loader";
import { renderExerciseArtSvg } from "@/lib/training/builder/exercise-art";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const catalogExerciseId = (req.nextUrl.searchParams.get("catalogExerciseId") ?? "").trim();
  if (!catalogExerciseId) {
    return NextResponse.json({ error: "Missing catalogExerciseId" }, { status: 400 });
  }

  const catalog = loadUnifiedExerciseCatalog();
  const record = catalog.exercises.find((x) => x.id === catalogExerciseId);
  if (!record) {
    return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
  }

  const svg = renderExerciseArtSvg(record);
  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
