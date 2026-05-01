/**
 * Loop closure (giorno vs giorno precedente) — logica pura + attach DB, senza `server-only`,
 * così è testabile con `node:test` senza caricare il bundle engine completo.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(dateIso: string, days: number): string {
  const base = new Date(`${dateIso}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return toDateOnly(base);
}

function asNum(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function evoAsRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Campi minimi per confronto loop (compatibile con `ExpectedObtainedDelta` del motore). */
export type LoopClosureDeltaInput = {
  date: string;
  status: string;
  delta: Record<string, unknown>;
  readiness: Record<string, unknown>;
  adaptationHint: Record<string, unknown>;
};

export type PriorDaySnapshot = {
  date: string;
  execution_pct: number | null;
  readiness_score: number | null;
  status: string | null;
};

export function snapshotFromPersistedRow(
  date: string,
  row: { delta?: unknown; readiness?: unknown; status?: unknown },
): PriorDaySnapshot {
  const d = evoAsRecord(row.delta);
  const r = evoAsRecord(row.readiness);
  return {
    date,
    execution_pct: asNum(d.execution_pct),
    readiness_score: asNum(r.score),
    status: typeof row.status === "string" ? row.status : null,
  };
}

export function snapshotFromComputedDelta(delta: LoopClosureDeltaInput): PriorDaySnapshot {
  const d = evoAsRecord(delta.delta);
  const r = evoAsRecord(delta.readiness);
  return {
    date: delta.date,
    execution_pct: asNum(d.execution_pct),
    readiness_score: asNum(r.score),
    status: delta.status,
  };
}

export function buildLoopClosureHint(prior: PriorDaySnapshot | null, current: LoopClosureDeltaInput): Record<string, unknown> {
  if (!prior) {
    return {
      prior_date: null,
      compliance_vs_prior: "unknown",
      recovery_vs_prior: "unknown",
      summary_it: "Nessun snapshot del giorno precedente disponibile per il confronto.",
    };
  }
  const d = evoAsRecord(current.delta);
  const r = evoAsRecord(current.readiness);
  const ex = asNum(d.execution_pct);
  const readiness = asNum(r.score);
  const exP = prior.execution_pct;
  const readP = prior.readiness_score;

  const compliance_vs_prior =
    ex != null && exP != null ? (ex > exP + 5 ? "higher" : ex < exP - 5 ? "lower" : "flat") : "unknown";
  const recovery_vs_prior =
    readiness != null && readP != null
      ? readiness > readP + 3
        ? "improved"
        : readiness < readP - 3
          ? "worse"
          : "flat"
      : "unknown";

  let summary_it = `Vs ${prior.date}: readiness ${readP ?? "—"} → ${readiness ?? "—"}; aderenza TSS ${exP ?? "—"}% → ${ex ?? "—"}%.`;
  if (recovery_vs_prior === "improved" && compliance_vs_prior !== "lower") {
    summary_it += " Segnale compatibile con recupero/compliance in miglioramento.";
  } else if (recovery_vs_prior === "worse" || compliance_vs_prior === "higher") {
    summary_it += " Attenzione: aderenza o stress possono aver eroso margine recovery.";
  }

  return {
    prior_date: prior.date,
    prior_readiness_score: readP,
    current_readiness_score: readiness,
    prior_execution_pct: exP,
    current_execution_pct: ex,
    prior_status: prior.status,
    current_status: current.status,
    compliance_vs_prior,
    recovery_vs_prior,
    summary_it,
  };
}

type DbClient = SupabaseClient;

export async function attachLoopClosureHints<T extends LoopClosureDeltaInput>(input: {
  db: DbClient;
  athleteId: string;
  deltas: T[];
}): Promise<T[]> {
  if (!input.deltas.length) return input.deltas;
  const sorted = [...input.deltas].sort((a, b) => a.date.localeCompare(b.date));
  const minD = sorted[0]!.date;
  const maxD = sorted[sorted.length - 1]!.date;
  const fetchFrom = addDays(minD, -14);

  const { data, error } = await input.db
    .from("training_expected_obtained_deltas")
    .select("date, delta, readiness, status")
    .eq("athlete_id", input.athleteId)
    .gte("date", fetchFrom)
    .lte("date", maxD)
    .order("date", { ascending: true });

  if (error) throw new Error(error.message);

  const dbByDate = new Map<string, PriorDaySnapshot>();
  for (const row of data ?? []) {
    const ds = typeof (row as { date?: unknown }).date === "string" ? String((row as { date: string }).date).slice(0, 10) : "";
    if (!ds) continue;
    dbByDate.set(ds, snapshotFromPersistedRow(ds, row as { delta?: unknown; readiness?: unknown; status?: unknown }));
  }

  const computed = new Map<string, PriorDaySnapshot>();
  const out: T[] = [];

  for (const delta of sorted) {
    const prevCal = addDays(delta.date, -1);
    const prior = computed.get(prevCal) ?? dbByDate.get(prevCal) ?? null;
    const loopClosure = buildLoopClosureHint(prior, delta);
    out.push({
      ...delta,
      adaptationHint: { ...(delta.adaptationHint ?? {}), loop_closure: loopClosure },
    });
    computed.set(delta.date, snapshotFromComputedDelta(delta));
  }

  return out;
}
