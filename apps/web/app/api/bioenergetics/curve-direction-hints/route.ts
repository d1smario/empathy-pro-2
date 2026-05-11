import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { assembleBioenergeticDay } from "@/lib/bioenergetics/bioenergetic-day-assembler";
import {
  compactBioenergeticDayForDirectionHints,
  requestOpenAiCurveDirectionHints,
} from "@/lib/bioenergetics/bioenergetic-curve-direction-hints";
import type { BioenergeticCurveDirectionHintsResponseV1 } from "@/api/bioenergetics/contracts";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

function isoDate(raw: unknown): string | null {
  const s = String(raw ?? "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/**
 * Interpretazione AI: dove la curva «dovrebbe» salire/scendere (fasce qualitative), usando la stessa giornata
 * assemblata per il motore deterministico. Non modifica i numeri del simulatore.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as { athleteId?: string; date?: string } | null;
    const athleteId = String(body?.athleteId ?? "").trim();
    const date = isoDate(body?.date);
    if (!athleteId || !date) {
      return NextResponse.json({ error: "missing_athleteId_or_date" }, { status: 400, headers: NO_STORE });
    }

    const apiKey = (process.env.OPENAI_API_KEY ?? "").trim();
    if (!apiKey) {
      const out: BioenergeticCurveDirectionHintsResponseV1 = {
        hintsContractVersion: 1,
        athleteId,
        date,
        summaryIt: "—",
        segments: [],
        noteIt: "OPENAI_API_KEY non configurata sul server.",
        skippedReason: "no_openai",
      };
      return NextResponse.json(out, { status: 503, headers: NO_STORE });
    }

    const { db } = await requireAthleteReadContext(req, athleteId);
    const assembled = await assembleBioenergeticDay(db, athleteId, date);
    if (!assembled.ok) {
      const out: BioenergeticCurveDirectionHintsResponseV1 = {
        hintsContractVersion: 1,
        athleteId,
        date,
        summaryIt: "—",
        segments: [],
        noteIt: assembled.error ?? "assemble_failed",
        skippedReason: "assemble_failed",
      };
      return NextResponse.json(out, { status: assembled.status, headers: NO_STORE });
    }

    const model = (process.env.OPENAI_BIOENERGETIC_MODEL ?? "").trim() || "gpt-4o-mini";
    const compact = compactBioenergeticDayForDirectionHints(assembled.body);
    const out = await requestOpenAiCurveDirectionHints(compact, { apiKey, model, athleteId, date });
    return NextResponse.json(out, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "curve_direction_hints_failed";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
