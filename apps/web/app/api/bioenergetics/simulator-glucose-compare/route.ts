import { NextRequest, NextResponse } from "next/server";
import type { BioenergeticGlucoseSimulatorCompareResponseV1 } from "@/api/bioenergetics/contracts";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { assembleBioenergeticDay } from "@/lib/bioenergetics/bioenergetic-day-assembler";
import { runBioenergeticGlucoseAiSimulator } from "@/lib/bioenergetics/bioenergetic-glucose-ai-simulator";
import { SIM_DIURNAL_SUBHOURLY_SOURCE_PREFIX } from "@empathy/domain-bioenergetics";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

function isRecord(x: unknown): x is Record<string, unknown> {
  return Boolean(x) && typeof x === "object" && !Array.isArray(x);
}

/** POST body: `{ athleteId, date? }` — curva interpretazione AI allineata al sim deterministico 10 min. */
export async function POST(req: NextRequest) {
  try {
    const bodyRaw = await req.json().catch(() => null);
    if (!isRecord(bodyRaw)) {
      return NextResponse.json({ error: "Body JSON non valido" }, { status: 400, headers: NO_STORE });
    }
    const athleteId = String(bodyRaw.athleteId ?? "").trim();
    if (!athleteId) {
      return NextResponse.json({ error: "missing_athleteId" }, { status: 400, headers: NO_STORE });
    }
    const date = String(bodyRaw.date ?? "")
      .trim()
      .slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "invalid_date" }, { status: 400, headers: NO_STORE });
    }

    const { db } = await requireAthleteReadContext(req, athleteId);
    const assembled = await assembleBioenergeticDay(db, athleteId, date);
    if (!assembled.ok) {
      return NextResponse.json({ error: assembled.error }, { status: assembled.status, headers: NO_STORE });
    }
    const day = assembled.body;

    if (day.provenance.glucose === "measured") {
      const out: BioenergeticGlucoseSimulatorCompareResponseV1 = {
        compareContractVersion: 1,
        athleteId,
        date,
        aiTrace: [],
        noteIt: "Confronto simulatore disattivato: è presente glucosio misurato (CGM/lab) per questa data.",
        skippedReason: "measured_glucose_day",
      };
      return NextResponse.json(out, { status: 200, headers: NO_STORE });
    }

    const glu = day.channels.glucose;
    const det =
      glu?.filter(
        (p) =>
          typeof p.source === "string" &&
          p.source.startsWith(SIM_DIURNAL_SUBHOURLY_SOURCE_PREFIX) &&
          typeof p.ts === "string" &&
          Number.isFinite(p.value),
      ) ?? [];
    if (det.length < 72) {
      const out: BioenergeticGlucoseSimulatorCompareResponseV1 = {
        compareContractVersion: 1,
        athleteId,
        date,
        aiTrace: [],
        noteIt: "Serie deterministica 10 min non disponibile per il confronto.",
        skippedReason: "no_sim_curve",
      };
      return NextResponse.json(out, { status: 200, headers: NO_STORE });
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      const out: BioenergeticGlucoseSimulatorCompareResponseV1 = {
        compareContractVersion: 1,
        athleteId,
        date,
        aiTrace: [],
        noteIt: "OPENAI_API_KEY non configurata: curva AI simulatore non generabile sul server.",
        skippedReason: "no_openai",
      };
      return NextResponse.json(out, { status: 200, headers: NO_STORE });
    }

    const model = (process.env.OPENAI_VISION_MODEL ?? "gpt-4o-mini").trim();

    const sim = await runBioenergeticGlucoseAiSimulator({
      date,
      kernel: day.kernel,
      timeline: day.timeline,
      deterministicGlucose: det.map((p) => ({ ts: p.ts, value: p.value })),
      apiKey,
      model,
    });

    if (!sim.ok) {
      const out: BioenergeticGlucoseSimulatorCompareResponseV1 = {
        compareContractVersion: 1,
        athleteId,
        date,
        aiTrace: [],
        noteIt: sim.noteIt,
        skippedReason: sim.skippedReason,
      };
      return NextResponse.json(out, { status: 200, headers: NO_STORE });
    }

    const out: BioenergeticGlucoseSimulatorCompareResponseV1 = {
      compareContractVersion: 1,
      athleteId,
      date,
      aiTrace: sim.aiTrace,
      noteIt: sim.noteIt,
    };
    return NextResponse.json(out, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "simulator_glucose_compare_failed";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
