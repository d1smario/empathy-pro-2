import { NextRequest, NextResponse } from "next/server";
import { resolveAthleteMemory } from "@/lib/memory/athlete-memory-resolver";
import { persistRealityDeviceExport } from "@/lib/reality/provider-adapters";
import { buildCoverageQualityNote } from "@/lib/reality/coverage-quality";
import { buildNutritionDeviceCanonicalPreview, buildNutritionDeviceCoverage } from "@/lib/reality/nutrition-device-signals";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      athlete_id?: string;
      provider?: string;
      external_ref?: string;
      payload?: Record<string, unknown>;
    };
    if (!body.athlete_id || !body.provider || !body.payload) {
      return NextResponse.json({ error: "Missing export payload fields" }, { status: 400 });
    }
    const coverage = buildNutritionDeviceCoverage(body.payload);
    const quality = buildCoverageQualityNote({
      coveragePct: coverage.coveragePct,
      completeLabel: "Nutrition export completo.",
      partialLabel: "Nutrition export parziale.",
      lowCoverageLabel: "Nutrition export a bassa copertura.",
      missingChannels: coverage.missingChannels,
      recommendedInputs: coverage.recommendedInputs,
      fallbackRecommendedInputs: ["calories_kcal", "carbohydrates_g", "hydration_ml"],
    });
    const { ingestion } = await persistRealityDeviceExport({
      athleteId: body.athlete_id,
      provider: body.provider,
      domain: "nutrition",
      sourceKind: "api_sync",
      externalRef: body.external_ref ?? null,
      payload: body.payload,
      canonicalPreview: buildNutritionDeviceCanonicalPreview(body.payload),
      channelCoverage: coverage.channelCoverage,
      missingChannels: coverage.missingChannels,
      recommendedInputs: coverage.recommendedInputs,
      qualityStatus: quality.status,
      qualityNote: quality.note,
      rawRefs: {
        payload_size: JSON.stringify(body.payload).length,
        input_uncertainty_pct: coverage.inputUncertaintyPct,
      },
    });
    return NextResponse.json({
      status: "ok",
      ingestion,
      athleteMemory: await resolveAthleteMemory(body.athlete_id),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Nutrition device export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

