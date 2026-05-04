import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import type { MultisportCpCurveSuggestionInput } from "@/lib/engines/multisport-cp-curve-suggestion";
import { computeMultisportCpCurveSuggestion } from "@/lib/engines/multisport-cp-curve-suggestion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * POST: suggerisce gli 8 punti curva CP (W equivalenti) + VO₂ deterministico per label.
 * Non salva: incolla nel modulo Physiology come per i dati manuali odierni.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<MultisportCpCurveSuggestionInput> & { athleteId?: string };
    const athleteId = (body.athleteId ?? "").trim();
    if (!athleteId) {
      return NextResponse.json({ error: "Missing athleteId" }, { status: 400 });
    }
    await requireAthleteReadContext(req, athleteId);

    if (!body.sport || typeof body.bodyMassKg !== "number" || !body.mode) {
      return NextResponse.json({ error: "Missing sport, bodyMassKg or mode" }, { status: 400 });
    }

    const input: MultisportCpCurveSuggestionInput = {
      sport: body.sport,
      bodyMassKg: body.bodyMassKg,
      mode: body.mode,
      efficiency: body.efficiency,
      gradeFraction: body.gradeFraction,
      powerAnchors: body.powerAnchors,
      raceAnchors: body.raceAnchors,
      referenceWatts: body.referenceWatts,
      phenotype: body.phenotype,
    };

    const suggestion = computeMultisportCpCurveSuggestion(input);
    return NextResponse.json(suggestion, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" },
    });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Multisport CP curve suggestion failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
