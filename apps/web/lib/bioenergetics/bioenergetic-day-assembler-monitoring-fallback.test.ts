import assert from "node:assert/strict";
import { test } from "node:test";
import type { BioenergeticDayMemorySlice } from "@/lib/bioenergetics/bioenergetic-day-memory-slice";
import { EMPTY_NUTRITION_PLAN_DAY } from "@/lib/bioenergetics/nutrition-plan-day-empty";
import { buildBioenergeticDayViewModelFromSlice } from "@/lib/bioenergetics/bioenergetic-day-assembler";
import { applyBioenergeticOpenAiGenerativeOverlay } from "@/lib/bioenergetics/bioenergetic-openai-generative-day";
import type { LoadBioenergeticEvidenceLinksResult } from "@/lib/bioenergetics/load-bioenergetic-evidence-links";

const SKIPPED_EVIDENCE = {
  ok: false as const,
  links: [],
  error: "skipped_generative_product_path",
} satisfies LoadBioenergeticEvidenceLinksResult;

function emptySlice(athleteId: string, date: string): BioenergeticDayMemorySlice {
  return {
    athleteId,
    date,
    planned: [],
    executed: [],
    diaryRows: [],
    biomarkerRows: [],
    deviceExportRows: [],
    timeSeriesSamplesRows: [],
    nutritionPlan: EMPTY_NUTRITION_PLAN_DAY,
  };
}

test("senza OPENAI_API_KEY la striscia deterministica plan-reality ha almeno tre canali", async () => {
  const prev = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const date = "2026-05-10";
    const athleteId = "test-athlete";
    const slice = emptySlice(athleteId, date);

    const deterministicVm = buildBioenergeticDayViewModelFromSlice({
      athleteId,
      date,
      slice,
      evidenceLinks: SKIPPED_EVIDENCE,
      omitMonitoringStrip: false,
    });
    assert.ok((deterministicVm.continuousMonitoring?.channels?.length ?? 0) >= 3);

    const overlaid = await applyBioenergeticOpenAiGenerativeOverlay(
      buildBioenergeticDayViewModelFromSlice({
        athleteId,
        date,
        slice,
        evidenceLinks: SKIPPED_EVIDENCE,
        omitMonitoringStrip: true,
      }),
      slice,
    );
    assert.equal(overlaid.continuousMonitoring?.channels?.length ?? 0, 0);

    const detStrip = deterministicVm.continuousMonitoring;
    const merged =
      !(overlaid.continuousMonitoring?.channels?.length ?? 0) && (detStrip?.channels?.length ?? 0)
        ? { ...overlaid, continuousMonitoring: detStrip }
        : overlaid;
    assert.ok((merged.continuousMonitoring?.channels?.length ?? 0) >= 3);
    assert.equal(merged.continuousMonitoring?.layer, "model_continuous_v1");
  } finally {
    if (prev !== undefined) process.env.OPENAI_API_KEY = prev;
    else delete process.env.OPENAI_API_KEY;
  }
});
