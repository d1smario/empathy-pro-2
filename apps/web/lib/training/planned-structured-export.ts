import { FitWriter } from "@markw65/fit-file-writer";
import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import {
  expandContractToLadderSteps,
  ladderStepsToStructuredIntervalRows,
} from "@/lib/training/builder/pro2-structured-interval-ladder";
import { formatZwoTextEventXml } from "@/lib/training/builder/zwo-step-text-events";
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

/** Espande il contratto Builder in righe scala intervalli (tabella TP, ZWO/FIT). */
export function pro2BuilderContractToStructuredIntervalRows(contract: Pro2BuilderSessionContract): StructuredIntervalRow[] {
  return ladderStepsToStructuredIntervalRows(expandContractToLadderSteps(contract));
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
    const events = r.textEvents?.length ? formatZwoTextEventXml(r.textEvents, "      ") : [];
    if (r.kind === "ramp") {
      const low = ftpFracFromWatts(r.powerLowW, ftp);
      const high = ftpFracFromWatts(r.powerHighW, ftp);
      if (events.length) {
        lines.push(`    <Ramp Duration="${d}" PowerLow="${low.toFixed(4)}" PowerHigh="${high.toFixed(4)}" FlatRoad="1">`);
        lines.push(...events);
        lines.push(`    </Ramp>`);
      } else {
        lines.push(
          `    <Ramp Duration="${d}" PowerLow="${low.toFixed(4)}" PowerHigh="${high.toFixed(4)}" FlatRoad="1"/>`,
        );
      }
      continue;
    }
    const p = ftpFracFromWatts(r.powerAvgW, ftp);
    if (events.length) {
      lines.push(`    <SteadyState Duration="${d}" Power="${p.toFixed(4)}" FlatRoad="1">`);
      lines.push(...events);
      lines.push(`    </SteadyState>`);
    } else {
      lines.push(`    <SteadyState Duration="${d}" Power="${p.toFixed(4)}" FlatRoad="1"/>`);
    }
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
