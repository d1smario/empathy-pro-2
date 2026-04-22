import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Pro2BuilderBlockContract, Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import { intensityToRelativeLoad } from "@/lib/training/builder/pro2-intensity";
import { estimateTssFromWattBlocks } from "@/lib/training/builder/tss-estimate";
import { normalizeImportedTraceSummary } from "@/lib/training/import-normalizer";
import { parseTrainingFile } from "@/lib/training/import-parser";
import type { StructuredIntervalRow } from "@/lib/training/planned-structured-import";

function buildCompanionExternalId(input: { athleteId: string; date: string; fileChecksumSha1: string }): string {
  const digest = createHash("sha1")
    .update(`${input.athleteId}|structured_companion|${input.fileChecksumSha1}|${input.date}`)
    .digest("hex")
    .slice(0, 20);
  return `imp:structured_companion:${input.date}:${digest}`;
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function powerSeriesLength(trace: Record<string, unknown>): number {
  const p = trace.power_series_w ?? trace.power_stream_w ?? trace.power_series;
  return Array.isArray(p) ? p.length : 0;
}

function zoneMidWatts(intensity: string, ftpW: number): number {
  const rel = intensityToRelativeLoad(intensity || "Z3");
  return Math.round(Math.max(45, rel * Math.max(1, ftpW)));
}

function blockMidWatts(block: Pro2BuilderBlockContract, ftpW: number): number {
  const ch = block.chart;
  if (!ch) return Math.round(0.75 * ftpW);
  if (block.kind === "ramp") {
    const a = zoneMidWatts(String(ch.startIntensity || ch.intensity || "Z2"), ftpW);
    const b = zoneMidWatts(String(ch.endIntensity || ch.intensity || "Z4"), ftpW);
    return Math.round((a + b) / 2);
  }
  return zoneMidWatts(String(ch.intensity || "Z3"), ftpW);
}

/**
 * Serie potenza campionata (2–5 s) da contratto Builder, per Analyzer / calorie / TSS coerenti col grafico a blocchi.
 */
function buildSyntheticPowerSeriesFromContract(contract: Pro2BuilderSessionContract): number[] {
  const ftpW = contract.renderProfile?.ftpW ?? 250;
  const blocks = contract.blocks ?? [];
  const series: number[] = [];
  const totalSec = Math.max(60, contract.summary.durationSec || 1);
  const targetPoints = Math.min(4000, Math.max(400, Math.floor(totalSec / 3)));
  const stepSec = Math.max(2, Math.floor(totalSec / targetPoints));

  for (const b of blocks) {
    const ch = b.chart;
    if (!ch) continue;
    const sec = Math.max(1, Math.round(ch.minutes * 60 + ch.seconds));
    const w = blockMidWatts(b, ftpW);
    for (let t = 0; t < sec; t += stepSec) {
      series.push(w);
    }
  }
  if (series.length < 8 && blocks.length) {
    const w = blockMidWatts(blocks[0]!, ftpW);
    const n = Math.min(120, Math.ceil(totalSec / stepSec));
    for (let i = 0; i < n; i += 1) series.push(w);
  }
  return series;
}

function buildSyntheticPowerSeriesFromIntervalLadder(rows: StructuredIntervalRow[]): number[] {
  const totalSec = Math.max(60, rows.reduce((s, r) => s + r.durationSec, 0));
  const targetPoints = Math.min(4000, Math.max(400, Math.floor(totalSec / 3)));
  const stepSec = Math.max(2, Math.floor(totalSec / targetPoints));
  const series: number[] = [];
  for (const r of rows) {
    const d = Math.max(1, r.durationSec);
    if (r.kind === "ramp" && Math.abs(r.powerHighW - r.powerLowW) > 3) {
      for (let t = 0; t < d; t += stepSec) {
        const u = d <= 1 ? 0 : t / Math.max(1, d - 1);
        series.push(Math.round(r.powerLowW + (r.powerHighW - r.powerLowW) * u));
      }
    } else {
      const w = r.powerAvgW;
      for (let t = 0; t < d; t += stepSec) {
        series.push(w);
      }
    }
  }
  if (series.length < 8 && rows.length) {
    const w = rows[0]!.powerAvgW;
    const n = Math.min(120, Math.ceil(totalSec / stepSec));
    for (let i = 0; i < n; i += 1) series.push(w);
  }
  return series;
}

function buildSyntheticExecutedPayload(input: {
  contract: Pro2BuilderSessionContract;
  intervalLadder?: StructuredIntervalRow[] | null;
  intervalLadderCsv?: string | null;
  fileName: string;
  fileChecksumSha1: string;
  date: string;
  plannedWorkoutId: string;
}): {
  durationMinutes: number;
  tss: number;
  kcal: number | null;
  kj: number | null;
  traceSummary: Record<string, unknown>;
} {
  const ftpW = input.contract.renderProfile?.ftpW ?? 250;
  const ladder = input.intervalLadder?.length ? input.intervalLadder : null;
  const s = input.contract.summary;

  if (ladder) {
    const totalSec = ladder.reduce((acc, r) => acc + r.durationSec, 0);
    const totalJ = ladder.reduce((acc, r) => {
      const avgW = (r.powerLowW + r.powerHighW) / 2;
      return acc + r.durationSec * avgW;
    }, 0);
    const durationMinutes = Math.max(1, Math.round(totalSec / 60));
    const avgPowerW = totalSec > 0 ? Math.round(totalJ / totalSec) : 0;
    const tss = estimateTssFromWattBlocks(
      ladder.map((r) => ({
        durationSeconds: r.durationSec,
        powerLowW: r.powerLowW,
        powerHighW: r.powerHighW,
      })),
      ftpW,
    );
    const kj = Math.round(totalJ / 1000);
    const kcal = Math.round(Math.max(0, tss) * 9.3);
    const power = buildSyntheticPowerSeriesFromIntervalLadder(ladder);
    const traceSummary: Record<string, unknown> = {
      source_format: "structured_companion_synthetic",
      parser_engine: "pro2_structured_companion_interval_ladder",
      parser_version: "1",
      power_series_w: power,
      power_avg_w: avgPowerW,
      trackpoint_count: power.length,
      fit_record_messages: power.length,
      channels_available: {
        power: true,
        hr: false,
        speed: false,
        cadence: false,
        altitude: false,
        temperature: false,
      },
      structured_companion: true,
      companion_for_planned_workout_id: input.plannedWorkoutId,
      imported_file_name: input.fileName,
      import_file_checksum_sha1: input.fileChecksumSha1,
      session_day_key: input.date,
      structured_interval_ladder: ladder,
      ...(input.intervalLadderCsv
        ? { structured_interval_ladder_csv: input.intervalLadderCsv.slice(0, 120_000) }
        : {}),
    };
    return {
      durationMinutes,
      tss: Math.max(0, tss),
      kcal,
      kj,
      traceSummary,
    };
  }

  const power = buildSyntheticPowerSeriesFromContract(input.contract);
  const durationMinutes = Math.max(1, Math.round(s.durationSec / 60));
  const traceSummary: Record<string, unknown> = {
    source_format: "structured_companion_synthetic",
    parser_engine: "pro2_structured_companion_synthetic",
    parser_version: "1",
    power_series_w: power,
    power_avg_w: s.avgPowerW,
    trackpoint_count: power.length,
    fit_record_messages: power.length,
    channels_available: {
      power: true,
      hr: false,
      speed: false,
      cadence: false,
      altitude: false,
      temperature: false,
    },
    structured_companion: true,
    companion_for_planned_workout_id: input.plannedWorkoutId,
    imported_file_name: input.fileName,
    import_file_checksum_sha1: input.fileChecksumSha1,
    session_day_key: input.date,
  };
  return {
    durationMinutes,
    tss: Math.max(0, Math.round(s.tss)),
    kcal: s.kcal != null && Number.isFinite(s.kcal) ? Math.round(s.kcal) : null,
    kj: s.kj != null && Number.isFinite(s.kj) ? Math.round(s.kj) : null,
    traceSummary,
  };
}

export type StructuredCompanionResult =
  | { status: "ok"; executedId: string; mode: "parsed_fit" | "synthetic_contract" | "synthetic_interval_ladder" }
  | { status: "skipped"; reason: string }
  | { status: "error"; message: string };

/**
 * Dopo import Builder (ZWO/ERG/MRC/FIT workout), crea un `executed_workouts` «companion»:
 * - se il buffer è FIT e `parseTrainingFile` produce abbastanza serie potenza → traccia reale;
 * - altrimenti → serie sintetica dalla scala intervalli (durata/watt per riga, stile TrainingPeaks) se disponibile, altrimenti dal contratto Builder.
 */
export async function upsertStructuredCompanionExecuted(
  db: SupabaseClient,
  input: {
    athleteId: string;
    date: string;
    fileName: string;
    mimeType: string;
    fileBuffer: Buffer;
    fileChecksumSha1: string;
    plannedWorkoutId: string;
    contract: Pro2BuilderSessionContract;
    structuredFormat: "zwo" | "erg" | "mrc" | "fit_workout";
    intervalLadder?: StructuredIntervalRow[] | null;
    intervalLadderCsv?: string | null;
  },
): Promise<StructuredCompanionResult> {
  const externalId = buildCompanionExternalId({
    athleteId: input.athleteId,
    date: input.date.slice(0, 10),
    fileChecksumSha1: input.fileChecksumSha1,
  });

  let mode: "parsed_fit" | "synthetic_contract" | "synthetic_interval_ladder" = "synthetic_contract";
  let durationMinutes = Math.max(1, Math.round(input.contract.summary.durationSec / 60));
  let tss = Math.max(0, Math.round(input.contract.summary.tss));
  let kcal: number | null =
    input.contract.summary.kcal != null && Number.isFinite(input.contract.summary.kcal)
      ? Math.round(input.contract.summary.kcal)
      : null;
  let kj: number | null =
    input.contract.summary.kj != null && Number.isFinite(input.contract.summary.kj)
      ? Math.round(input.contract.summary.kj)
      : null;
  let traceSummary: Record<string, unknown>;

  const tryFit =
    input.structuredFormat === "fit_workout" &&
    (input.fileName.toLowerCase().endsWith(".fit") || input.mimeType.toLowerCase().includes("fit"));

  if (tryFit) {
    try {
      const parsed = await parseTrainingFile({
        fileName: input.fileName,
        mimeType: input.mimeType || "application/octet-stream",
        buffer: input.fileBuffer,
      });
      const normalized = normalizeImportedTraceSummary({
        parsed,
        fileName: input.fileName,
        deviceHint: "trainingpeaks",
      });
      const tr = normalized.traceSummary as Record<string, unknown>;
      const pLen = powerSeriesLength(tr);
      const recN = asNumber(tr.fit_record_messages) ?? 0;
      if (pLen >= 24 || recN >= 24) {
        mode = "parsed_fit";
        durationMinutes = Math.max(
          durationMinutes,
          Math.max(1, Math.round(parsed.durationMinutes || 0)),
        );
        tss = Math.max(tss, Math.max(0, Math.round(parsed.tss || 0)));
        if (parsed.kcal != null && Number.isFinite(parsed.kcal)) kcal = Math.round(parsed.kcal);
        if (parsed.kj != null && Number.isFinite(parsed.kj)) kj = Math.round(parsed.kj);
        traceSummary = {
          ...tr,
          session_day_key: input.date.slice(0, 10),
          imported_file_name: input.fileName,
          imported_mime_type: input.mimeType || null,
          import_file_checksum_sha1: input.fileChecksumSha1,
          structured_companion: true,
          companion_for_planned_workout_id: input.plannedWorkoutId,
          companion_parse_mode: "parsed_fit",
        };
      } else {
        const syn = buildSyntheticExecutedPayload({
          contract: input.contract,
          intervalLadder: input.intervalLadder,
          intervalLadderCsv: input.intervalLadderCsv,
          fileName: input.fileName,
          fileChecksumSha1: input.fileChecksumSha1,
          date: input.date.slice(0, 10),
          plannedWorkoutId: input.plannedWorkoutId,
        });
        traceSummary = syn.traceSummary;
        durationMinutes = syn.durationMinutes;
        tss = syn.tss;
        kcal = syn.kcal;
        kj = syn.kj;
        if (syn.traceSummary.parser_engine === "pro2_structured_companion_interval_ladder") {
          mode = "synthetic_interval_ladder";
        }
      }
    } catch {
      const syn = buildSyntheticExecutedPayload({
        contract: input.contract,
        intervalLadder: input.intervalLadder,
        intervalLadderCsv: input.intervalLadderCsv,
        fileName: input.fileName,
        fileChecksumSha1: input.fileChecksumSha1,
        date: input.date.slice(0, 10),
        plannedWorkoutId: input.plannedWorkoutId,
      });
      traceSummary = syn.traceSummary;
      durationMinutes = syn.durationMinutes;
      tss = syn.tss;
      kcal = syn.kcal;
      kj = syn.kj;
      if (syn.traceSummary.parser_engine === "pro2_structured_companion_interval_ladder") {
        mode = "synthetic_interval_ladder";
      }
    }
  } else {
    const syn = buildSyntheticExecutedPayload({
      contract: input.contract,
      intervalLadder: input.intervalLadder,
      intervalLadderCsv: input.intervalLadderCsv,
      fileName: input.fileName,
      fileChecksumSha1: input.fileChecksumSha1,
      date: input.date.slice(0, 10),
      plannedWorkoutId: input.plannedWorkoutId,
    });
    traceSummary = syn.traceSummary;
    durationMinutes = syn.durationMinutes;
    tss = syn.tss;
    kcal = syn.kcal;
    kj = syn.kj;
    if (syn.traceSummary.parser_engine === "pro2_structured_companion_interval_ladder") {
      mode = "synthetic_interval_ladder";
    }
  }

  const sourceTag = `structured_plan_companion:${input.structuredFormat}:${mode}`;

  const payload: Record<string, unknown> = {
    athlete_id: input.athleteId,
    date: input.date.slice(0, 10),
    duration_minutes: durationMinutes,
    tss,
    kcal,
    kj,
    trace_summary: traceSummary,
    subjective_notes:
      "Traccia companion generata dall’import strutturato (stesso file / contratto Builder): Analyzer e moduli downstream usano durata e TSS coerenti con la seduta pianificata.",
    source: sourceTag,
    planned_workout_id: input.plannedWorkoutId,
    external_id: externalId,
  };

  const existing = await db
    .from("executed_workouts")
    .select("id")
    .eq("athlete_id", input.athleteId)
    .eq("external_id", externalId)
    .limit(1)
    .maybeSingle();

  if (existing.error) {
    return { status: "error", message: existing.error.message };
  }

  if (existing.data?.id) {
    const up = await db
      .from("executed_workouts")
      .update(payload)
      .eq("id", existing.data.id)
      .eq("athlete_id", input.athleteId)
      .select("id")
      .single();
    if (up.error) return { status: "error", message: up.error.message };
    return { status: "ok", executedId: String(up.data?.id ?? existing.data.id), mode };
  }

  const ins = await db.from("executed_workouts").insert(payload).select("id").single();
  if (ins.error) return { status: "error", message: ins.error.message };
  return { status: "ok", executedId: String(ins.data?.id ?? ""), mode };
}
