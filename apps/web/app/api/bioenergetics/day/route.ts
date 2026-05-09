import { NextRequest, NextResponse } from "next/server";
import { executedWorkoutFromDbRow, plannedWorkoutFromDbRow, type ExecutedWorkoutDbRow, type PlannedWorkoutDbRow } from "@empathy/domain-training";
import type { BioenergeticSeriesPoint, BioenergeticTimelineEvent } from "@/api/bioenergetics/contracts";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { computeBioenergeticDayKernel } from "@/lib/bioenergetics/day-response-kernel";
import { buildBioenergeticInterpretationHints } from "@/lib/bioenergetics/interpretation-bridge";
import { firstWindowQueryError, queryPlannedExecutedWindow } from "@/lib/training/planned-executed-window-query";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toDateKey(value: string): string {
  return value.slice(0, 10);
}

function isoDateOrToday(raw: string): string {
  const date = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function glucoseFromPayload(payload: Record<string, unknown>, createdAt: string | null): BioenergeticSeriesPoint[] {
  const out: BioenergeticSeriesPoint[] = [];
  const arrayKeys = ["samples", "data", "points", "readings"];
  for (const key of arrayKeys) {
    const arr = payload[key];
    if (!Array.isArray(arr)) continue;
    for (const row of arr) {
      const rec = asRecord(row);
      if (!rec) continue;
      const value = num(rec.glucose_mmol ?? rec.glucoseMmol ?? rec.glucose ?? rec.value);
      if (value == null) continue;
      const tsRaw = typeof rec.ts === "string" ? rec.ts : typeof rec.timestamp === "string" ? rec.timestamp : createdAt;
      const ts = typeof tsRaw === "string" ? tsRaw : createdAt;
      if (!ts) continue;
      out.push({ ts, value, source: "cgm_export" });
    }
  }
  if (out.length) return out;

  const flatValue = num(payload.glucose_mmol ?? payload.glucoseMmol ?? payload.glucose ?? payload.value);
  if (flatValue != null && createdAt) {
    out.push({ ts: createdAt, value: flatValue, source: "cgm_export" });
  }
  return out;
}

function lactateFromPayload(payload: Record<string, unknown>, createdAt: string | null): BioenergeticSeriesPoint[] {
  const out: BioenergeticSeriesPoint[] = [];
  const value = num(payload.lactate_mmoll ?? payload.lactateMmolL ?? payload.lactate);
  if (value != null && createdAt) out.push({ ts: createdAt, value, source: "device_export" });
  return out;
}

export async function GET(req: NextRequest) {
  try {
    const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
    if (!athleteId) {
      return NextResponse.json({ error: "missing_athleteId" }, { status: 400, headers: NO_STORE });
    }
    const date = isoDateOrToday(req.nextUrl.searchParams.get("date") ?? "");
    const { db } = await requireAthleteReadContext(req, athleteId);

    const [windowRes, diaryRes, exportsRes, biomarkersRes] = await Promise.all([
      queryPlannedExecutedWindow(db, athleteId, date, date),
      db
        .from("food_diary_entries")
        .select("id, entry_date, entry_time, meal_slot, food_label, carbs_g, protein_g, fat_g, kcal, insulin_load")
        .eq("athlete_id", athleteId)
        .eq("entry_date", date)
        .order("entry_time", { ascending: true }),
      db
        .from("device_sync_exports")
        .select("id, provider, payload, created_at")
        .eq("athlete_id", athleteId)
        .gte("created_at", `${date}T00:00:00`)
        .lte("created_at", `${date}T23:59:59`)
        .order("created_at", { ascending: true }),
      db
        .from("biomarker_panels")
        .select("id, sample_date, values, created_at")
        .eq("athlete_id", athleteId)
        .eq("sample_date", date),
    ]);

    const windowErr = firstWindowQueryError(windowRes.planned, windowRes.executed);
    if (windowErr) return NextResponse.json({ error: windowErr }, { status: 500, headers: NO_STORE });
    if (diaryRes.error) return NextResponse.json({ error: diaryRes.error.message }, { status: 500, headers: NO_STORE });
    if (exportsRes.error) return NextResponse.json({ error: exportsRes.error.message }, { status: 500, headers: NO_STORE });
    if (biomarkersRes.error) return NextResponse.json({ error: biomarkersRes.error.message }, { status: 500, headers: NO_STORE });

    const planned = ((windowRes.planned.data ?? []) as PlannedWorkoutDbRow[]).map(plannedWorkoutFromDbRow);
    const executed = ((windowRes.executed.data ?? []) as ExecutedWorkoutDbRow[]).map(executedWorkoutFromDbRow);
    const diaryRows = (diaryRes.data ?? []) as Array<Record<string, unknown>>;
    const exportRows = (exportsRes.data ?? []) as Array<Record<string, unknown>>;
    const biomarkerRows = (biomarkersRes.data ?? []) as Array<Record<string, unknown>>;

    const timeline: BioenergeticTimelineEvent[] = [];
    for (const row of planned) {
      timeline.push({
        id: `plan-${row.id}`,
        ts: `${toDateKey(row.date)}T06:00:00`,
        type: "planned_session",
        title: row.type ?? "Sessione pianificata",
        payload: { durationMinutes: row.durationMinutes, tssTarget: row.tssTarget, kcalTarget: row.kcalTarget },
      });
    }
    for (const row of executed) {
      timeline.push({
        id: `exec-${row.id}`,
        ts: `${toDateKey(row.date)}T06:30:00`,
        type: "executed_session",
        title: "Sessione eseguita",
        payload: { durationMinutes: row.durationMinutes, tss: row.tss, kcal: row.kcal, source: row.source },
      });
    }
    for (const row of diaryRows) {
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

    const glucoseMeasured: BioenergeticSeriesPoint[] = [];
    const lactateMeasured: BioenergeticSeriesPoint[] = [];
    for (const row of exportRows) {
      const payload = asRecord(row.payload) ?? {};
      const createdAt = typeof row.created_at === "string" ? row.created_at : null;
      const provider = typeof row.provider === "string" ? row.provider : "device";
      timeline.push({
        id: `dev-${String(row.id ?? createdAt ?? provider)}`,
        ts: createdAt ?? `${date}T12:00:00`,
        type: "device_export",
        title: `Export ${provider}`,
      });
      if (provider === "cgm") glucoseMeasured.push(...glucoseFromPayload(payload, createdAt));
      lactateMeasured.push(...lactateFromPayload(payload, createdAt));
    }

    for (const row of biomarkerRows) {
      const values = asRecord(row.values) ?? {};
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
      const glucose = num(values.glucose_mmol_l ?? values.glucose_mmol ?? values.glucose);
      const lactate = num(values.lactate_mmol_l ?? values.lactate_mmoll ?? values.lactate);
      if (glucose != null) glucoseMeasured.push({ ts: dateTs, value: glucose, source: "lab_panel" });
      if (lactate != null) lactateMeasured.push({ ts: dateTs, value: lactate, source: "lab_panel" });
    }

    timeline.sort((a, b) => a.ts.localeCompare(b.ts));
    glucoseMeasured.sort((a, b) => a.ts.localeCompare(b.ts));
    lactateMeasured.sort((a, b) => a.ts.localeCompare(b.ts));

    const choIntakeG = diaryRows.reduce((sum, row) => sum + (num(row.carbs_g) ?? 0), 0);
    const executedLoad = executed.reduce((sum, row) => sum + Math.max(0, Number(row.tss ?? 0)), 0);
    const plannedLoad = planned.reduce((sum, row) => sum + Math.max(0, Number(row.tssTarget ?? 0)), 0);
    const activityLoadScore = Math.max(0, Math.min(100, executedLoad > 0 ? executedLoad : plannedLoad));
    const avgInsulinLoad = diaryRows.length
      ? diaryRows.reduce((sum, row) => sum + (num(row.insulin_load) ?? 0), 0) / diaryRows.length
      : 0;
    const kernel = computeBioenergeticDayKernel({
      choIntakeG,
      activityLoadScore,
      cgmPresent: glucoseMeasured.length > 0,
      lactatePresent: lactateMeasured.length > 0,
      gutConstraintScore: Math.max(0, Math.min(100, avgInsulinLoad)),
    });

    const glucoseEstimated =
      glucoseMeasured.length > 0
        ? null
        : [{ ts: `${date}T12:00:00`, value: Math.round((5.4 + kernel.insulinDemandScore * 0.015) * 100) / 100, source: "kernel_v1" }];
    const lactateEstimated =
      lactateMeasured.length > 0
        ? null
        : [{ ts: `${date}T12:00:00`, value: Math.round((1.1 + kernel.oxidationDriveScore * 0.01) * 100) / 100, source: "kernel_v1" }];

    return NextResponse.json(
      {
        athleteId,
        date,
        range: { from: `${date}T00:00:00`, to: `${date}T23:59:59` },
        timeline,
        channels: {
          glucose: glucoseMeasured.length ? glucoseMeasured : glucoseEstimated,
          lactate: lactateMeasured.length ? lactateMeasured : lactateEstimated,
        },
        provenance: {
          glucose: glucoseMeasured.length ? "measured" : glucoseEstimated ? "estimated" : "absent",
          lactate: lactateMeasured.length ? "measured" : lactateEstimated ? "estimated" : "absent",
        },
        kernel,
        interpretationHints: buildBioenergeticInterpretationHints(kernel),
        disclaimers: [
          "Le curve stimate sono modellazione deterministica operativa, non diagnosi clinica.",
          "Quando presenti, i dati misurati (CGM/lab/device) hanno priorita sulle stime.",
        ],
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "bioenergetics_day_failed";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
