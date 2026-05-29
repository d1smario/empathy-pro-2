/**
 * Protocollo pre-gara canonico Empathy (deterministico, tutti gli atleti).
 *
 * In giorno gara: pranzo = start gara − 3 h, pasta o riso 3 g CHO/kg,
 * grana 15–20 g, olio 15 g; il resto segue il profilo Diet (kcal/% pasti).
 *
 * Vedi `.cursor/rules/empathy_nutrition_diet_meal_plan_generative.mdc` Regola 8.
 */

import type { IntelligentMealPlanItemOut, MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";
import type { MediterraneanComposedMeal, MediterraneanDayContext } from "@/lib/nutrition/mediterranean-meal-composer";
import {
  formatMinutesToLocalHHmm,
  parseLocalTimeToMinutes,
} from "@/lib/nutrition/nutrition-meal-times-training-coherence";
import { profileWeekDayKeyFromIsoLocal } from "@/lib/nutrition/routine-week-plan-meal-times";

export type RaceDayPreRaceLunchRule = {
  hoursBeforeRace: number;
  carbsPerKgG: number;
  staple: "pasta_or_rice";
  granaPadanoG: { min: number; max: number };
  oliveOilG: number;
};

/** Protocollo classico pre-gara — identico per ogni atleta quando il calendario segnala una gara. */
export const RACE_DAY_PRE_RACE_LUNCH_PROTOCOL: RaceDayPreRaceLunchRule = {
  hoursBeforeRace: 3,
  carbsPerKgG: 3,
  staple: "pasta_or_rice",
  granaPadanoG: { min: 15, max: 20 },
  oliveOilG: 15,
};

export function getRaceDayPreRaceLunchProtocol(): RaceDayPreRaceLunchRule {
  return RACE_DAY_PRE_RACE_LUNCH_PROTOCOL;
}

export type PlannedSessionForRaceDetection = {
  duration_minutes?: unknown;
  type?: unknown;
  notes?: unknown;
  sessionName?: unknown;
  adaptiveGoal?: unknown;
};

export type RaceSessionForDay = {
  id?: string;
  label: string;
  startMinutes: number;
  raceStartLocal: string;
  durationMinutes: number;
};

export type RacePreLunchDayContext = {
  weightKg: number;
  rule: RaceDayPreRaceLunchRule;
  raceLabel: string;
  raceStartLocal: string;
  lunchTimeLocal: string;
};

const RACE_TEXT = /\b(gara|race|competition|gran fondo|granfondo|marathon|maratona|ironman|triathlon)\b/i;

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function numFromUnknown(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function nonEmptyTime(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function textBlob(...parts: unknown[]): string {
  return parts
    .map((p) => (typeof p === "string" ? p : p != null ? String(p) : ""))
    .join(" ")
    .toLowerCase();
}

export function isPlannedSessionRaceLike(input: {
  type?: unknown;
  notes?: unknown;
  sessionName?: unknown;
  adaptiveGoal?: unknown;
  durationMinutes?: number;
  routineDayMode?: string | null;
}): boolean {
  if (input.routineDayMode === "race") return true;
  const blob = textBlob(input.type, input.notes, input.sessionName, input.adaptiveGoal);
  if (RACE_TEXT.test(blob)) return true;
  const t = textBlob(input.type);
  return t === "race" || t.includes("gara");
}

export function inferRaceStartMinutesFromRoutine(
  routineConfig: Record<string, unknown> | null | undefined,
  planDate: string,
): number | null {
  if (!routineConfig) return null;
  const wd = profileWeekDayKeyFromIsoLocal(planDate);
  const weekPlan = asRecord(routineConfig.week_plan);
  const day = asRecord(weekPlan[wd]);
  const startStr =
    nonEmptyTime(day.training1_start_time) ??
    nonEmptyTime(asRecord(routineConfig.training_1).start_time) ??
    nonEmptyTime(routineConfig.training1_start_time) ??
    null;
  if (!startStr) return null;
  return parseLocalTimeToMinutes(startStr);
}

export function detectPrimaryRaceSessionForDay(input: {
  planDate: string;
  routineConfig: Record<string, unknown> | null | undefined;
  plannedSessions: PlannedSessionForRaceDetection[];
}): RaceSessionForDay | null {
  const wd = profileWeekDayKeyFromIsoLocal(input.planDate);
  const weekPlan = asRecord(input.routineConfig?.week_plan);
  const dayRoutine = asRecord(weekPlan[wd]);
  const dayMode = nonEmptyTime(dayRoutine.day_mode) ?? null;
  const startMinutes = inferRaceStartMinutesFromRoutine(input.routineConfig, input.planDate);

  const candidates = input.plannedSessions
    .map((s, idx) => {
      const durationMinutes = numFromUnknown(s.duration_minutes, 0);
      const label = String(s.sessionName ?? s.type ?? `Sessione ${idx + 1}`).trim() || `Sessione ${idx + 1}`;
      const raceLike = isPlannedSessionRaceLike({
        type: s.type,
        notes: s.notes,
        sessionName: s.sessionName,
        adaptiveGoal: s.adaptiveGoal,
        durationMinutes,
        routineDayMode: dayMode,
      });
      if (!raceLike) return null;
      const start = startMinutes ?? 7 * 60 + 30;
      return {
        label,
        startMinutes: start,
        raceStartLocal: formatMinutesToLocalHHmm(start),
        durationMinutes: Math.max(durationMinutes, 0),
      };
    })
    .filter((c): c is Omit<RaceSessionForDay, "id"> => c != null);

  if (candidates.length === 0) {
    if (dayMode !== "race" || startMinutes == null) return null;
    return {
      label: "Gara (routine)",
      startMinutes,
      raceStartLocal: formatMinutesToLocalHHmm(startMinutes),
      durationMinutes: numFromUnknown(dayRoutine.training1_duration_minutes, 0),
    };
  }

  candidates.sort((a, b) => b.durationMinutes - a.durationMinutes || b.startMinutes - a.startMinutes);
  const best = candidates[0]!;
  return { ...best };
}

export function computePreRaceLunchMinutes(raceStartMinutes: number, hoursBeforeRace: number): number {
  return Math.max(6 * 60, raceStartMinutes - Math.round(hoursBeforeRace * 60));
}

export function mapPlannedSessionsForRaceDetection(
  sessions: Array<{
    duration_minutes?: unknown;
    type?: unknown;
    notes?: unknown;
    plannedSessionName?: unknown;
    plannedAdaptationTarget?: unknown;
    builderSession?: { sessionName?: string | null; adaptationTarget?: string | null } | null;
  }>,
): PlannedSessionForRaceDetection[] {
  return sessions.map((s) => ({
    duration_minutes: s.duration_minutes,
    type: s.type,
    notes: s.notes,
    sessionName: s.plannedSessionName ?? s.builderSession?.sessionName ?? null,
    adaptiveGoal: s.plannedAdaptationTarget ?? s.builderSession?.adaptationTarget ?? null,
  }));
}

export function buildRacePreLunchDayContext(input: {
  weightKg: number | null | undefined;
  planDate: string;
  routineConfig: Record<string, unknown> | null | undefined;
  plannedSessions: PlannedSessionForRaceDetection[];
}): RacePreLunchDayContext | null {
  const rule = getRaceDayPreRaceLunchProtocol();
  const race = detectPrimaryRaceSessionForDay({
    planDate: input.planDate,
    routineConfig: input.routineConfig,
    plannedSessions: input.plannedSessions,
  });
  if (!race) return null;
  const weightKg = numFromUnknown(input.weightKg, 0);
  if (weightKg < 35) return null;
  const lunchMin = computePreRaceLunchMinutes(race.startMinutes, rule.hoursBeforeRace);
  return {
    weightKg,
    rule,
    raceLabel: race.label,
    raceStartLocal: race.raceStartLocal,
    lunchTimeLocal: formatMinutesToLocalHHmm(lunchMin),
  };
}

export function racePreLunchContextLine(ctx: RacePreLunchDayContext): string {
  const cho = Math.round(ctx.weightKg * ctx.rule.carbsPerKgG);
  return (
    `Protocollo pre-gara: pranzo ${ctx.lunchTimeLocal} (${ctx.rule.hoursBeforeRace} h prima di ${ctx.raceStartLocal} · ${ctx.raceLabel}) — ` +
    `pasta o riso ${ctx.rule.carbsPerKgG} g CHO/kg (~${cho} g), grana ${ctx.rule.granaPadanoG.min}–${ctx.rule.granaPadanoG.max} g, olio ${ctx.rule.oliveOilG} g; ` +
    `se mancano kcal rispetto al target Diet → crostata/torta CHO (no verdure voluminose pre-gara).`
  );
}

type RaceStaple = "pasta" | "riso";

const RACE_D = {
  pastaDryKcalPerG: 3.71,
  pastaDryChoPerG: 0.75,
  pastaDryProtPerG: 0.13,
  riceDryKcalPerG: 3.65,
  riceDryChoPerG: 0.8,
  riceDryProtPerG: 0.071,
  granaKcalPerG: 4.0,
  granaProtPerG: 0.33,
  granaFatPerG: 0.28,
  oilKcalPerMl: 8.84,
  oilFatPerMl: 1.0,
  crostataKcalPerG: 3.2,
  crostataChoPerG: 0.48,
  crackerKcalPerG: 4.16,
  jamKcalPerG: 2.5,
};

function clampStep(n: number, lo: number, hi: number, step = 5): number {
  const rounded = Math.round(n / step) * step;
  return Math.max(lo, Math.min(hi, rounded));
}

function item(
  name: string,
  portionHint: string,
  approxKcal: number,
  role: IntelligentMealPlanItemOut["macroRole"],
  bridge: string,
): IntelligentMealPlanItemOut {
  return {
    name,
    portionHint,
    approxKcal: Math.max(8, Math.round(approxKcal)),
    macroRole: role,
    functionalBridge: bridge.slice(0, 500),
  };
}

export function dryStapleGramsForTargetCarbs(staple: RaceStaple, targetCarbsG: number): number {
  const choPerG = staple === "pasta" ? RACE_D.pastaDryChoPerG : RACE_D.riceDryChoPerG;
  const raw = targetCarbsG / choPerG;
  return staple === "pasta" ? clampStep(raw, 50, 320) : clampStep(raw, 45, 300);
}

export function pickRacePreLunchStaple(seed: number, ctx?: MediterraneanDayContext): RaceStaple {
  const order: RaceStaple[] = [];
  const deny = ctx?.denyFragments ?? [];
  const denyText = deny.join(" ").toLowerCase();
  if (!/\bpasta\b|\bglut/i.test(denyText)) order.push("pasta");
  if (!/\briso\b|\brice/i.test(denyText)) order.push("riso");
  const pool = order.length ? order : (["riso"] as RaceStaple[]);
  return pool[Math.abs(seed) % pool.length] ?? "pasta";
}

/** Soglia minima gap kcal (rispetto target slot Diet) per aggiungere dolce CHO. */
export const RACE_PRE_RACE_KCAL_TOPUP_MIN = 60;

function denyHit(fragments: readonly string[], deny?: string[]): boolean {
  if (!deny?.length) return false;
  const blob = deny.join(" ").toLowerCase();
  return fragments.some((f) => blob.includes(f.toLowerCase()));
}

/** Riempie il gap kcal con crostata/torta CHO — mai verdure (volume/fibra pre-gara). */
export function buildRacePreRaceKcalTopUpItem(
  gapKcal: number,
  seed: number,
  denyFragments?: string[],
): IntelligentMealPlanItemOut | null {
  if (gapKcal < RACE_PRE_RACE_KCAL_TOPUP_MIN) return null;

  const glutenBlocked = denyHit(["glutine", "gluten", "frumento", "wheat"], denyFragments);
  if (!glutenBlocked) {
    const useTorta = Math.abs(seed) % 2 === 1;
    const label = useTorta ? "Torta semplice" : "Crostata di mela";
    const portionLabel = useTorta ? "torta semplice (porzione CHO pre-gara)" : "crostata di mela (porzione CHO pre-gara)";
    const g = clampStep(gapKcal / RACE_D.crostataKcalPerG, 55, 190);
    const kcal = Math.round(g * RACE_D.crostataKcalPerG);
    return item(
      label,
      `${g} g ${portionLabel}`,
      kcal,
      "cho_heavy",
      "Protocollo pre-gara: top-up kcal slot Diet con dolce CHO digeribile (no verdure voluminose).",
    );
  }

  /** Fallback senza glutine: fette + marmellata (CHO rapido, basso volume). */
  if (denyHit(["marmellat", "jam"], denyFragments)) return null;
  const jamG = clampStep(gapKcal * 0.35 / RACE_D.jamKcalPerG, 25, 55);
  const ruskG = clampStep((gapKcal - jamG * RACE_D.jamKcalPerG) / RACE_D.crackerKcalPerG, 30, 80);
  const kcal = Math.round(jamG * RACE_D.jamKcalPerG + ruskG * RACE_D.crackerKcalPerG);
  return item(
    "Fette biscottate e marmellata",
    `${ruskG} g fette biscottate + ${jamG} g marmellata (CHO pre-gara)`,
    kcal,
    "cho_heavy",
    "Protocollo pre-gara: top-up kcal senza glutine — CHO rapido, no verdure.",
  );
}

/** Composizione fissa pre-gara; gap kcal → crostata/torta CHO (no verdure). */
export function composeRacePreLunchMainMeal(
  slot: MealSlotKey,
  m: { kcal: number; carbsG: number; proteinG: number; fatG: number },
  seed: number,
  raceCtx: RacePreLunchDayContext,
  dayCtx?: MediterraneanDayContext,
): MediterraneanComposedMeal {
  const rule = raceCtx.rule;
  const targetCarbsG = Math.max(40, Math.round(raceCtx.weightKg * rule.carbsPerKgG));
  const staple = pickRacePreLunchStaple(seed, dayCtx);
  const carbG = dryStapleGramsForTargetCarbs(staple, targetCarbsG);
  const granaG = clampStep(
    rule.granaPadanoG.min + (Math.abs(seed) % (Math.max(1, rule.granaPadanoG.max - rule.granaPadanoG.min + 1))),
    rule.granaPadanoG.min,
    rule.granaPadanoG.max,
    1,
  );
  const oilG = rule.oliveOilG;
  const oilMl = Math.round(oilG / 0.92);

  const carbLine =
    staple === "pasta"
      ? `${carbG} g pasta secca (peso a crudo) — ~${targetCarbsG} g CHO (${rule.carbsPerKgG} g/kg)`
      : `${carbG} g riso (peso a crudo) — ~${targetCarbsG} g CHO (${rule.carbsPerKgG} g/kg)`;
  const carbKcal = carbG * (staple === "pasta" ? RACE_D.pastaDryKcalPerG : RACE_D.riceDryKcalPerG);

  const items: IntelligentMealPlanItemOut[] = [
    item(
      staple === "pasta" ? "Pasta" : "Riso",
      carbLine,
      carbKcal,
      "cho_heavy",
      "Protocollo pre-gara: amido complesso a densità CHO/kg (canonico piattaforma).",
    ),
    item(
      "Grana Padano",
      `${granaG} g grana grattugiato`,
      granaG * RACE_D.granaKcalPerG,
      "protein",
      "Protocollo pre-gara: grana 15–20 g.",
    ),
    item(
      "Olio extravergine d'oliva",
      `${oilG} g olio EVO (~${oilMl} ml)`,
      oilMl * RACE_D.oilKcalPerMl,
      "fat",
      "Protocollo pre-gara: olio 15 g.",
    ),
  ];

  const usedKcal = items.reduce((s, i) => s + i.approxKcal, 0);
  const gapKcal = m.kcal - usedKcal;
  const topUp = buildRacePreRaceKcalTopUpItem(gapKcal, seed, dayCtx?.denyFragments);
  if (topUp) items.push(topUp);

  const lines = items.map((i) => i.portionHint);
  const totalApproxKcal = items.reduce((s, i) => s + i.approxKcal, 0);
  return {
    items,
    lines,
    totalApproxKcal,
  };
}
