import type { SupabaseClient } from "@supabase/supabase-js";
import { SIM_BANK_VERSION, buildSimulatedGluLacDiurnal } from "@empathy/domain-bioenergetics";
import type { BioenergeticTimelineEvent } from "@/api/bioenergetics/contracts";
import type { BioenergeticsDayViewModel } from "@/api/bioenergetics/contracts";
import type { BioenergeticDayMemorySlice } from "@/lib/bioenergetics/bioenergetic-day-memory-slice";
import { loadBioenergeticDayMemorySlice } from "@/lib/bioenergetics/bioenergetic-day-memory-slice";
import { buildBioenergeticDaySeries, extractMeasuredGluLacFromSlice } from "@/lib/bioenergetics/day-curves-assembler";
import { buildBioenergeticDayPresentation } from "@/lib/bioenergetics/day-presentation";
import { computeBioenergeticDayKernel } from "@/lib/bioenergetics/day-response-kernel";
import { buildBioenergeticInterpretationHints } from "@/lib/bioenergetics/interpretation-bridge";
import { num } from "@/lib/bioenergetics/bioenergetic-day-payload-parsers";

function toDateKey(value: string): string {
  return value.slice(0, 10);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function staggerSessionTs(date: string, index: number, phaseQuarterHours: number): string {
  const startMin = 7 * 60 + phaseQuarterHours * 15 + index * 75;
  const capped = Math.min(Math.max(startMin, 6 * 60), 21 * 60 + 45);
  const h = Math.floor(capped / 60);
  const m = capped % 60;
  return `${date}T${pad2(h)}:${pad2(m)}:00`;
}

function buildTimeline(date: string, slice: BioenergeticDayMemorySlice): BioenergeticTimelineEvent[] {
  const timeline: BioenergeticTimelineEvent[] = [];

  slice.planned.forEach((row, i) => {
    const dk = toDateKey(row.date);
    timeline.push({
      id: `plan-${row.id}`,
      ts: staggerSessionTs(dk, i, 0),
      type: "planned_session",
      title: row.type ?? "Sessione pianificata",
      payload: { durationMinutes: row.durationMinutes, tssTarget: row.tssTarget, kcalTarget: row.kcalTarget },
    });
  });
  slice.executed.forEach((row, i) => {
    const dk = toDateKey(row.date);
    timeline.push({
      id: `exec-${row.id}`,
      ts: staggerSessionTs(dk, i, 2),
      type: "executed_session",
      title: "Sessione eseguita",
      payload: { durationMinutes: row.durationMinutes, tss: row.tss, kcal: row.kcal, source: row.source },
    });
  });
  for (const row of slice.diaryRows) {
    const t = typeof row.entry_time === "string" && row.entry_time.trim() ? row.entry_time.slice(0, 8) : "12:00:00";
    timeline.push({
      id: `meal-${String(row.id)}`,
      ts: `${date}T${t}`,
      type: "meal",
      title: String(row.food_label ?? "Meal"),
      payload: {
        mealSlot: row.meal_slot,
        carbsG: num(row.carbs_g),
        proteinG: num(row.protein_g),
        fatG: num(row.fat_g),
        kcal: num(row.kcal),
        insulinLoad: num(row.insulin_load),
      },
    });
  }

  for (const row of slice.deviceExportRows) {
    const createdAt = typeof row.created_at === "string" ? row.created_at : null;
    const provider = typeof row.provider === "string" ? row.provider : "device";
    timeline.push({
      id: `dev-${String(row.id ?? createdAt ?? provider)}`,
      ts: createdAt ?? `${date}T12:00:00`,
      type: "device_export",
      title: `Export ${provider}`,
    });
  }

  for (const row of slice.biomarkerRows) {
    const dateTs =
      typeof row.sample_date === "string" && row.sample_date.trim()
        ? `${row.sample_date}T07:00:00`
        : typeof row.created_at === "string"
          ? row.created_at
          : `${date}T07:00:00`;
    timeline.push({
      id: `lab-${String(row.id ?? dateTs)}`,
      ts: dateTs,
      type: "lab_marker",
      title: "Panel biomarker",
    });
  }

  timeline.sort((a, b) => a.ts.localeCompare(b.ts));
  return timeline;
}

export type AssembleBioenergeticDayResult =
  | { ok: true; body: BioenergeticsDayViewModel }
  | { ok: false; status: number; error: string };

/**
 * Assembler unico per GET bioenergetics/day: memoria giorno → canali → kernel → serie → presentation.
 */
export async function assembleBioenergeticDay(
  db: SupabaseClient,
  athleteId: string,
  dateRaw: string,
): Promise<AssembleBioenergeticDayResult> {
  const date = dateRaw.trim().slice(0, 10);
  const { slice, queryError } = await loadBioenergeticDayMemorySlice(db, athleteId, date);
  if (queryError) {
    return { ok: false, status: 500, error: queryError };
  }

  const { glucoseMeasured, lactateMeasured } = extractMeasuredGluLacFromSlice(slice);
  const timeline = buildTimeline(date, slice);

  const choIntakeG = slice.diaryRows.reduce((sum, row) => sum + (num(row.carbs_g) ?? 0), 0);
  const executedLoad = slice.executed.reduce((sum, row) => sum + Math.max(0, Number(row.tss ?? 0)), 0);
  const plannedLoad = slice.planned.reduce((sum, row) => sum + Math.max(0, Number(row.tssTarget ?? 0)), 0);
  const activityLoadScore = Math.max(0, Math.min(100, executedLoad > 0 ? executedLoad : plannedLoad));
  const avgInsulinLoad = slice.diaryRows.length
    ? slice.diaryRows.reduce((sum, row) => sum + (num(row.insulin_load) ?? 0), 0) / slice.diaryRows.length
    : 0;
  const kernel = computeBioenergeticDayKernel({
    choIntakeG,
    activityLoadScore,
    cgmPresent: glucoseMeasured.length > 0,
    lactatePresent: lactateMeasured.length > 0,
    gutConstraintScore: Math.max(0, Math.min(100, avgInsulinLoad)),
  });

  const simGluLac =
    glucoseMeasured.length === 0 || lactateMeasured.length === 0
      ? buildSimulatedGluLacDiurnal(date, kernel, timeline)
      : null;
  const glucoseEstimated = glucoseMeasured.length > 0 ? null : simGluLac?.glucose ?? null;
  const lactateEstimated = lactateMeasured.length > 0 ? null : simGluLac?.lactate ?? null;

  const channels = {
    glucose: glucoseMeasured.length ? glucoseMeasured : glucoseEstimated,
    lactate: lactateMeasured.length ? lactateMeasured : lactateEstimated,
  };
  const provenance = {
    glucose: glucoseMeasured.length ? "measured" : glucoseEstimated ? "estimated" : "absent",
    lactate: lactateMeasured.length ? "measured" : lactateEstimated ? "estimated" : "absent",
  } as const;

  const series = buildBioenergeticDaySeries({ slice, provenance, channels });

  const { metricTiles, chart24h, continuousMonitoring } = buildBioenergeticDayPresentation({
    date,
    kernel,
    provenance,
    channels,
    timeline,
    biomarkerRows: slice.biomarkerRows,
  });

  const body: BioenergeticsDayViewModel = {
    athleteId,
    date,
    range: { from: `${date}T00:00:00`, to: `${date}T23:59:59` },
    timeline,
    channels,
    provenance,
    kernel,
    simBankVersion: SIM_BANK_VERSION,
    interpretationHints: buildBioenergeticInterpretationHints(kernel, {
      diaryEntryCount: slice.diaryRows.length,
      choIntakeG,
      executedTssSum: executedLoad,
      plannedTssSum: plannedLoad,
      glucoseProvenance: provenance.glucose,
      lactateProvenance: provenance.lactate,
      biomarkerPanelCount: slice.biomarkerRows.length,
      simBankVersion: SIM_BANK_VERSION,
    }),
    disclaimers: [
      "Le curve stimate sono modellazione deterministica operativa, non diagnosi clinica.",
      "Senza CGM/lab, glucosio e lattato seguono una diurna simulata (banca coefficienti v1), non misure continue.",
      "Quando presenti, i dati misurati (CGM/lab/device) hanno priorita sulle stime e sulle tile da referto.",
      "Le tile lab senza valore nel panel usano ordini di grandezza simulati dal kernel (stesso modello v1), non risultati analitici.",
      "La striscia «monitoraggio continuo» usa oggi il modello deterministico (v1) su 24 h per ogni analita valorizzata; con stream device le stesse serie saranno alimentate dai dati reali senza cambiare il layout.",
      "Colori supportivo/neutro/inibitorio: modello operativo sulla giornata, non classificazione di laboratorio.",
      "Le serie aggiuntive (FC, CHO cumulativi, potenza da trace) dipendono da trace/diario disponibili per la data.",
      "La curva «Potenza (target da piano kJ/kcal)» è un vincolo energetico deterministico da `planned_workouts`, non una prescrizione FTP.",
    ],
    metricTiles,
    chart24h,
    continuousMonitoring,
    series,
  };

  return { ok: true, body };
}
