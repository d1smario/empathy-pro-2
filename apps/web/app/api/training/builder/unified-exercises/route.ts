import { NextRequest, NextResponse } from "next/server";
import { resolveExerciseMediaUrl } from "@/lib/training/builder/exercise-media";
import { loadUnifiedExerciseCatalog } from "@/lib/training/exercise-library/catalog-loader";
import { describeBlock1Taxonomy } from "@/lib/training/exercise-library/block1-taxonomy";
import { filterByBlock1MusclePreset, selectExercises } from "@/lib/training/exercise-library/selector";
import type { Block1MusclePreset } from "@/lib/training/exercise-library/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sportTag = (req.nextUrl.searchParams.get("sportTag") ?? "gym").trim().toLowerCase();
    const muscle = (req.nextUrl.searchParams.get("muscle") ?? "").trim().toLowerCase() as Block1MusclePreset;
    const limitParam = Number(req.nextUrl.searchParams.get("limit") ?? 220);
    const limit = Math.max(1, Math.min(400, Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 220));

    const catalog = loadUnifiedExerciseCatalog();
    let rows = selectExercises(catalog, { sportTag, limit: 800 });
    rows = filterByBlock1MusclePreset(rows, muscle);

    const sliced = rows.slice(0, limit);
    return NextResponse.json({
      rows: sliced.map((ex) => {
        const taxonomy = describeBlock1Taxonomy(ex);
        return {
          id: ex.id,
          name: ex.name,
          muscleGroup: ex.muscleGroups.join(", "),
          catalogCategory: taxonomy.catalogCategory,
          primaryDistrict: taxonomy.primaryDistrict,
          secondaryDistricts: taxonomy.secondaryDistricts,
          bodyRegion: taxonomy.bodyRegion,
          exerciseKind: taxonomy.exerciseKind,
          equipmentClass: taxonomy.equipmentClass,
          equipment: ex.equipment.join(", "),
          difficulty: ex.difficulty,
          instructions: undefined as string | undefined,
          mediaUrl: resolveExerciseMediaUrl(ex),
          source: "unified_catalog" as const,
          movementPattern: ex.movementPattern,
          sportTags: ex.sportTags,
        };
      }),
      source: "unified_catalog",
      sportTag,
      muscle,
      count: rows.length,
      returnedCount: sliced.length,
      totalCount: rows.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unified exercises failed";
    return NextResponse.json({ rows: [], source: "unified_catalog", error: msg }, { status: 500 });
  }
}
