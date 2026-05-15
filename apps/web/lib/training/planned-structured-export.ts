import { FitWriter } from "@markw65/fit-file-writer";
import type { Pro2BlockChart, Pro2BuilderBlockContract, Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import { zoneForTargetValue, zoneFromIntensityCue, zoneRelativeRange } from "@/lib/training/builder/pro2-intensity";
import { intensityLabelForContractBlock } from "@/lib/training/builder/pro2-session-notes";
import type { StructuredIntervalRow } from "@/lib/training/planned-structured-interval-csv";
import { formatStructuredIntervalLadderCsv } from "@/lib/training/planned-structured-interval-csv";

export class StructuredExportUnsupportedError extends Error {
  readonly status = 422 as const;
  constructor(message: string) {
    super(message);
    this.name = "StructuredExportUnsupportedError";
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function ftpFracFromWatts(w: number, ftpW: number): number {
  return clamp(w / Math.max(1, ftpW), 0.35, 1.55);
}

/** Scala 0.35–1.55 → uint16 come in import (`maybeScaledPercentFtp`). */
export function scaledFtpTargetU16(ftpFrac: number): number {
  const x = clamp(ftpFrac, 0.35, 1.55);
  return Math.round(x * 10000);
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function zoneLabelForBlock(block: Pro2BuilderBlockContract): string {
  return intensityLabelForContractBlock(block);
}

function wattsTripleForZoneLabel(label: string, ftpW: number): { low: number; high: number; avg: number } {
  const z = zoneFromIntensityCue(label, "Z3");
  const r = zoneRelativeRange(z);
  const low = Math.max(45, Math.round(r.min * ftpW));
  const high = Math.max(low, Math.round(r.max * ftpW));
  const avg = Math.max(45, Math.round(((r.min + r.max) / 2) * ftpW));
  return { low, high, avg };
}

function blockDurationSeconds(
  block: Pro2BuilderBlockContract,
  lengthMode: "time" | "distance",
  speedRefKmh: number,
): number {
  const ch = block.chart;
  if (lengthMode === "distance" && ch && (ch.distanceKm ?? 0) > 0) {
    return Math.max(30, Math.round((Math.max(0.1, ch.distanceKm) / Math.max(1, speedRefKmh)) * 3600));
  }
  const dm = Number(block.durationMinutes);
  if (Number.isFinite(dm) && dm > 0) return Math.max(30, Math.round(dm * 60));
  if (ch) {
    const sec = Math.max(0, ch.minutes * 60 + Math.min(59, ch.seconds));
    return Math.max(30, sec > 0 ? sec : 60);
  }
  return Math.max(60, Math.round(Math.max(0.25, Number(block.durationMinutes) || 1) * 60));
}

function chartOrDefaults(block: Pro2BuilderBlockContract): Pro2BlockChart {
  const ch = block.chart;
  if (ch) return ch;
  return {
    minutes: Math.max(0, Math.floor(block.durationMinutes)),
    seconds: 0,
    intensity: "",
    startIntensity: "",
    endIntensity: "",
    intensity2: "",
    intensity3: "",
    repeats: 1,
    workSeconds: 180,
    recoverSeconds: 90,
    step1Seconds: 120,
    step2Seconds: 90,
    step3Seconds: 60,
    pyramidSteps: 5,
    pyramidStepSeconds: 180,
    pyramidStartTarget: 100,
    pyramidEndTarget: 200,
    distanceKm: 0,
    gradePercent: 0,
    elevationMeters: 0,
    cadence: "",
    frequencyHint: "",
    loadFactor: 1,
  };
}

/**
 * Espande il contratto Builder in righe «scala intervalli» (watt + durata), allineato allo spirito di
 * `manualPlanBlocksToChartSegments` + import FIT/ZWO.
 */
export function pro2BuilderContractToStructuredIntervalRows(contract: Pro2BuilderSessionContract): StructuredIntervalRow[] {
  const ftpW = Math.max(1, contract.renderProfile?.ftpW ?? 250);
  const lengthMode = contract.renderProfile?.lengthMode ?? "time";
  const speedRef = contract.renderProfile?.speedRefKmh ?? 35;
  const blocks = contract.blocks ?? [];
  const out: StructuredIntervalRow[] = [];

  const pushSteady = (durationSec: number, label: string | undefined, zoneLabel: string) => {
    const { low, high, avg } = wattsTripleForZoneLabel(zoneLabel, ftpW);
    out.push({
      index: out.length + 1,
      durationSec: Math.max(1, Math.round(durationSec)),
      powerAvgW: avg,
      powerLowW: low,
      powerHighW: high,
      durationType: "time",
      kind: "steady",
      label: label?.slice(0, 120),
    });
  };

  for (const block of blocks) {
    const kind = (block.kind ?? "steady").toLowerCase();
    const ch = chartOrDefaults(block);
    const dur = blockDurationSeconds(block, lengthMode, speedRef);

    if (kind === "interval2") {
      const reps = Math.max(1, Math.round(ch.repeats || 1));
      const work = Math.max(10, Math.round(ch.workSeconds || 180));
      const rec = Math.max(10, Math.round(ch.recoverSeconds || 90));
      const zOn = zoneFromIntensityCue(String(ch.intensity || block.intensityCue || ""), "Z4");
      const zOff = zoneFromIntensityCue(String(ch.intensity2 || ""), "Z2");
      for (let i = 0; i < reps; i += 1) {
        pushSteady(work, `${block.label} · lavoro`, zOn);
        pushSteady(rec, `${block.label} · recupero`, zOff);
      }
      continue;
    }

    if (kind === "interval3") {
      const reps = Math.max(1, Math.round(ch.repeats || 1));
      const a = Math.max(10, Math.round(ch.step1Seconds || 120));
      const b = Math.max(10, Math.round(ch.step2Seconds || 90));
      const c = Math.max(10, Math.round(ch.step3Seconds || 60));
      const z1 = zoneFromIntensityCue(String(ch.intensity || ""), "Z4");
      const z2 = zoneFromIntensityCue(String(ch.intensity2 || ""), "Z3");
      const z3 = zoneFromIntensityCue(String(ch.intensity3 || ""), "Z2");
      for (let i = 0; i < reps; i += 1) {
        pushSteady(a, `${block.label} · A`, z1);
        pushSteady(b, `${block.label} · B`, z2);
        pushSteady(c, `${block.label} · C`, z3);
      }
      continue;
    }

    if (kind === "pyramid") {
      const steps = Math.max(1, Math.round(ch.pyramidSteps || 1));
      const stepSec = Math.max(20, Math.round(ch.pyramidStepSeconds || 60));
      const start = ch.pyramidStartTarget || 0.75 * ftpW;
      const end = ch.pyramidEndTarget || 1.05 * ftpW;
      const span = end - start;
      for (let i = 1; i <= steps; i += 1) {
        const targetW = Math.round(start + (span * i) / steps);
        const z = zoneForTargetValue(targetW, "watt", ftpW, contract.renderProfile?.hrMax ?? 190);
        const { low, high, avg } = wattsTripleForZoneLabel(z, ftpW);
        out.push({
          index: out.length + 1,
          durationSec: stepSec,
          powerAvgW: avg,
          powerLowW: low,
          powerHighW: high,
          durationType: "time",
          kind: "steady",
          label: `${block.label} ${i}/${steps}`.slice(0, 120),
        });
      }
      continue;
    }

    if (kind === "ramp") {
      const zStart = zoneFromIntensityCue(String(ch.startIntensity || ""), "Z2");
      const zEnd = zoneFromIntensityCue(String(ch.endIntensity || ch.intensity || ""), "Z4");
      const a = wattsTripleForZoneLabel(zStart, ftpW);
      const b = wattsTripleForZoneLabel(zEnd, ftpW);
      out.push({
        index: out.length + 1,
        durationSec: Math.max(1, Math.round(dur)),
        powerAvgW: Math.round((a.avg + b.avg) / 2),
        powerLowW: Math.min(a.low, b.low),
        powerHighW: Math.max(a.high, b.high),
        durationType: "time",
        kind: "ramp",
        label: block.label?.slice(0, 120),
      });
      continue;
    }

    /* steady / endurance / default */
    const z = zoneLabelForBlock(block);
    pushSteady(dur, block.label, z);
  }

  for (let i = 0; i < out.length; i += 1) {
    out[i]!.index = i + 1;
  }
  return out;
}

export function assertStructuredTrainingExportSupported(contract: Pro2BuilderSessionContract): void {
  if (contract.version !== 1) throw new StructuredExportUnsupportedError("Contratto: version !== 1.");
  if (contract.family !== "aerobic") {
    throw new StructuredExportUnsupportedError("Export strutturato: solo family «aerobic» (Zwift / Rouvy / FIT cycling).");
  }
  if (contract.renderProfile?.intensityUnit !== "watt") {
    throw new StructuredExportUnsupportedError("Export strutturato: serve intensità in watt (renderProfile.intensityUnit).");
  }
  const blocks = contract.blocks ?? [];
  if (!blocks.length) throw new StructuredExportUnsupportedError("Export strutturato: nessun blocco nel contratto.");
  for (const b of blocks) {
    if (b.gymRx || b.technicalRx || b.lifestyleRx) {
      throw new StructuredExportUnsupportedError(
        "Export strutturato: blocchi con gymRx / technicalRx / lifestyleRx non sono mappati su ZWO/FIT watt.",
      );
    }
  }
}

export function serializeStructuredIntervalRowsToZwo(input: {
  sessionName: string;
  ftpW: number;
  rows: StructuredIntervalRow[];
}): string {
  const name = xmlEscape(input.sessionName.trim().slice(0, 200) || "Empathy session");
  const ftp = Math.max(1, input.ftpW);
  const lines: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<workout_file>`,
    `  <author>Empathy Pro 2</author>`,
    `  <name>${name}</name>`,
    `  <description>Exported from Empathy Pro 2 — watt targets from Builder contract.</description>`,
    `  <sportType>bike</sportType>`,
    `  <workout>`,
  ];

  for (const r of input.rows) {
    const d = Math.max(1, Math.round(r.durationSec));
    if (r.kind === "ramp") {
      const low = ftpFracFromWatts(r.powerLowW, ftp);
      const high = ftpFracFromWatts(r.powerHighW, ftp);
      lines.push(
        `    <Ramp Duration="${d}" PowerLow="${low.toFixed(4)}" PowerHigh="${high.toFixed(4)}" FlatRoad="1"/>`,
      );
      continue;
    }
    const p = ftpFracFromWatts(r.powerAvgW, ftp);
    lines.push(`    <SteadyState Duration="${d}" Power="${p.toFixed(4)}" FlatRoad="1"/>`);
  }

  lines.push(`  </workout>`, `</workout_file>`, "");
  return lines.join("\n");
}

export function serializePro2BuilderContractToZwo(contract: Pro2BuilderSessionContract): string {
  assertStructuredTrainingExportSupported(contract);
  const rows = pro2BuilderContractToStructuredIntervalRows(contract);
  return serializeStructuredIntervalRowsToZwo({
    sessionName: contract.sessionName || "Session",
    ftpW: contract.renderProfile?.ftpW ?? 250,
    rows,
  });
}

export { formatStructuredIntervalLadderCsv };

/**
 * FIT workout prescrittivo (cycling) — `target_type` power = 4 come verificato con round-trip parser interno.
 */
export function encodeStructuredIntervalRowsToFitWorkout(input: {
  wktName: string;
  ftpW: number;
  rows: StructuredIntervalRow[];
}): Buffer {
  const ftp = Math.max(1, input.ftpW);
  const w = new FitWriter();
  const ts = w.time(new Date());
  const name = input.wktName.trim().slice(0, 20) || "Empathy";

  w.writeMessage("file_id", {
    type: 5,
    manufacturer: 255,
    product: 0,
    serial_number: 0x50455232,
    time_created: ts,
    number: 0,
    timestamp: ts,
  } as never);

  w.writeMessage("workout", {
    sport: 2,
    wkt_name: name,
    num_valid_steps: input.rows.length,
    timestamp: ts,
  } as never);

  let idx = 0;
  for (const r of input.rows) {
    const lowU = scaledFtpTargetU16(r.powerLowW / ftp);
    const highU = scaledFtpTargetU16(r.powerHighW / ftp);
    const midU = scaledFtpTargetU16(r.powerAvgW / ftp);
    w.writeMessage("workout_step", {
      wkt_step_name: (r.label ?? `Step ${idx + 1}`).trim().slice(0, 16),
      duration_type: 0,
      duration_value: Math.max(1, Math.round(r.durationSec)),
      target_type: 4,
      target_value: midU,
      custom_target_value_low: lowU,
      custom_target_value_high: highU,
      message_index: idx,
      workout_index: 0,
      timestamp: ts,
    } as never);
    idx += 1;
  }

  const dv = w.finish();
  return Buffer.from(dv.buffer);
}

export function serializePro2BuilderContractToFitWorkout(contract: Pro2BuilderSessionContract): Buffer {
  assertStructuredTrainingExportSupported(contract);
  const rows = pro2BuilderContractToStructuredIntervalRows(contract);
  return encodeStructuredIntervalRowsToFitWorkout({
    wktName: contract.sessionName || "Empathy",
    ftpW: contract.renderProfile?.ftpW ?? 250,
    rows,
  });
}

export function exportStructuredTrainingFromContract(
  contract: Pro2BuilderSessionContract,
  format: "zwo" | "fit_workout" | "interval_csv",
): { body: string | Buffer; contentType: string; fileName: string } {
  assertStructuredTrainingExportSupported(contract);
  const base = (contract.sessionName || "empathy-session").replace(/[^\w\-]+/g, "_").slice(0, 80);
  const rows = pro2BuilderContractToStructuredIntervalRows(contract);
  if (format === "interval_csv") {
    return {
      body: formatStructuredIntervalLadderCsv(rows),
      contentType: "text/csv; charset=utf-8",
      fileName: `${base}-intervals.csv`,
    };
  }
  if (format === "zwo") {
    return {
      body: serializeStructuredIntervalRowsToZwo({
        sessionName: contract.sessionName || "Session",
        ftpW: contract.renderProfile?.ftpW ?? 250,
        rows,
      }),
      contentType: "application/xml; charset=utf-8",
      fileName: `${base}.zwo`,
    };
  }
  return {
    body: encodeStructuredIntervalRowsToFitWorkout({
      wktName: contract.sessionName || "Empathy",
      ftpW: contract.renderProfile?.ftpW ?? 250,
      rows,
    }),
    contentType: "application/vnd.ant.fit",
    fileName: `${base}.fit`,
  };
}
