import { NextRequest, NextResponse } from "next/server";
import type { BioenergeticPredictorCurvesResponseV1 } from "@/api/bioenergetics/contracts";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { assembleBioenergeticDay } from "@/lib/bioenergetics/bioenergetic-day-assembler";
import {
  buildPredictorChannelsFromParse,
  buildPredictorCurvesDemoParseResult,
  compactBioenergeticDayForPredictorAi,
  parsePredictorCurvesOpenAiContent,
  requestOpenAiPredictorCurves,
} from "@/lib/bioenergetics/bioenergetic-predictor-curves-ai";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

function isoDate(raw: unknown): string | null {
  const s = String(raw ?? "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/**
 * Predittore AI: legge la stessa giornata assemblata del report e produce curve illustrative (andamento),
 * senza sostituire ingest o valori clinici. Con glucosio misurato denso quel giorno il canale glucosio è omesso.
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
    /** Solo QA: curve sintetiche fisse, non LLM. Le curve «con AI» richiedono `OPENAI_API_KEY`. */
    const demoAllowed = process.env.EMPATHY_PREDICTOR_DEMO === "1";

    const { db } = await requireAthleteReadContext(req, athleteId);
    const assembled = await assembleBioenergeticDay(db, athleteId, date, {
      applyOpenAiContinuousStrip: false,
    });
    if (!assembled.ok) {
      const out: BioenergeticPredictorCurvesResponseV1 = {
        predictorContractVersion: 1,
        athleteId,
        date,
        disclaimerIt: "—",
        noteIt: assembled.error ?? "assemble_failed",
        channels: [],
        skippedReason: "assemble_failed",
      };
      return NextResponse.json(out, { status: assembled.status, headers: NO_STORE });
    }

    const vm = assembled.body;
    const gluCh = vm.continuousMonitoring?.channels.find((c) => c.id === "glucose");
    const skipGlucosePredictor =
      vm.provenance.glucose === "measured" &&
      (gluCh?.dataPlane === "measured_stream" || (gluCh?.streamTrace?.length ?? 0) >= 48);

    if (!apiKey) {
      if (demoAllowed) {
        const parsed = buildPredictorCurvesDemoParseResult(skipGlucosePredictor);
        const channels = buildPredictorChannelsFromParse(vm, parsed);
        if (!channels.length) {
          const out: BioenergeticPredictorCurvesResponseV1 = {
            predictorContractVersion: 1,
            athleteId,
            date,
            disclaimerIt: parsed.disclaimerIt,
            noteIt: parsed.noteIt ?? "Nessun canale da patchare (giornata senza monitoraggio continuo).",
            channels: [],
            skippedReason: "empty_predictor",
          };
          return NextResponse.json(out, { status: 422, headers: NO_STORE });
        }
        const out: BioenergeticPredictorCurvesResponseV1 = {
          predictorContractVersion: 1,
          athleteId,
          date,
          disclaimerIt: parsed.disclaimerIt,
          noteIt: parsed.noteIt,
          channels,
          skippedReason: "predictor_demo_local",
        };
        return NextResponse.json(out, { headers: NO_STORE });
      }
      const out503: BioenergeticPredictorCurvesResponseV1 = {
        predictorContractVersion: 1,
        athleteId,
        date,
        disclaimerIt: "OPENAI_API_KEY non configurata sul server.",
        noteIt:
          "Imposta OPENAI_API_KEY sul server per le curve predittore generate dal modello. Solo per test UI senza OpenAI: EMPATHY_PREDICTOR_DEMO=1 (serie sintetiche, non inferenza).",
        channels: [],
        skippedReason: "no_openai",
      };
      return NextResponse.json(out503, { status: 503, headers: NO_STORE });
    }

    const model = (process.env.OPENAI_BIOENERGETIC_MODEL ?? "").trim() || "gpt-4o-mini";
    const compact = compactBioenergeticDayForPredictorAi(vm, { skipGlucosePredictor });
    const ai = await requestOpenAiPredictorCurves(compact, { apiKey, model });
    if (!ai.ok) {
      const out: BioenergeticPredictorCurvesResponseV1 = {
        predictorContractVersion: 1,
        athleteId,
        date,
        disclaimerIt: "—",
        noteIt: ai.error,
        channels: [],
        skippedReason: "bad_openai_response",
      };
      return NextResponse.json(out, { status: 502, headers: NO_STORE });
    }

    const parsed = parsePredictorCurvesOpenAiContent(ai.text);
    if (!parsed) {
      const out: BioenergeticPredictorCurvesResponseV1 = {
        predictorContractVersion: 1,
        athleteId,
        date,
        disclaimerIt: "—",
        noteIt: "Risposta JSON non interpretabile.",
        channels: [],
        skippedReason: "bad_openai_response",
      };
      return NextResponse.json(out, { status: 422, headers: NO_STORE });
    }

    const channels = buildPredictorChannelsFromParse(vm, parsed);
    if (!channels.length) {
      const out: BioenergeticPredictorCurvesResponseV1 = {
        predictorContractVersion: 1,
        athleteId,
        date,
        disclaimerIt: parsed.disclaimerIt || "—",
        noteIt: parsed.noteIt ?? "Nessun canale costruito dalla risposta.",
        channels: [],
        skippedReason: "empty_predictor",
      };
      return NextResponse.json(out, { status: 422, headers: NO_STORE });
    }

    const out: BioenergeticPredictorCurvesResponseV1 = {
      predictorContractVersion: 1,
      athleteId,
      date,
      disclaimerIt: parsed.disclaimerIt,
      noteIt: parsed.noteIt,
      channels,
    };
    return NextResponse.json(out, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "predictor_curves_failed";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
