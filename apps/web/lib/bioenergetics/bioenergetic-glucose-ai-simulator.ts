import "server-only";
import { SIM_DIURNAL_GLUCOSE_V1 } from "@empathy/domain-bioenergetics";
import type { BioenergeticDayKernelOutput, BioenergeticMonitoringStreamPoint, BioenergeticTimelineEvent } from "@/api/bioenergetics/contracts";

export type BioenergeticGlucoseAiSimResultV1 =
  | {
      ok: true;
      aiTrace: BioenergeticMonitoringStreamPoint[];
      noteIt: string | null;
    }
  | {
      ok: false;
      skippedReason: "no_openai" | "no_sim_curve" | "bad_openai_response" | "network";
      noteIt: string;
    };

function clampGlucoseMmol(v: number): number {
  return Math.max(SIM_DIURNAL_GLUCOSE_V1.clampLo, Math.min(SIM_DIURNAL_GLUCOSE_V1.clampHi, v));
}

/** Payload minimi per il simulatore AI (solo interpretazione; non persiste). */
export function compactTimelineForAiGlucoseSim(timeline: BioenergeticTimelineEvent[]): unknown[] {
  const out: unknown[] = [];
  for (const e of timeline) {
    if (e.type === "meal") {
      const p = e.payload ?? {};
      out.push({
        ts: e.ts,
        type: "meal",
        title: e.title,
        carbsG: typeof p.carbsG === "number" ? p.carbsG : null,
        kcal: typeof p.kcal === "number" ? p.kcal : null,
        glycemicIndex: typeof p.glycemicIndex === "number" ? p.glycemicIndex : null,
      });
    }
    if (e.type === "planned_session" || e.type === "executed_session") {
      const p = e.payload ?? {};
      out.push({
        ts: e.ts,
        type: e.type,
        durationMinutes: typeof p.durationMinutes === "number" ? p.durationMinutes : null,
        tss: typeof p.tss === "number" ? p.tss : null,
        tssTarget: typeof p.tssTarget === "number" ? p.tssTarget : null,
      });
    }
  }
  return out;
}

function parseOpenAiJsonArray(text: string): number[] | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const v = (raw as { v?: unknown }).v;
  if (!Array.isArray(v)) return null;
  const nums: number[] = [];
  for (const x of v) {
    const n = typeof x === "number" ? x : Number(x);
    if (!Number.isFinite(n)) return null;
    nums.push(n);
  }
  return nums.length ? nums : null;
}

function resampleValuesToLen(values: number[], targetLen: number): number[] {
  if (values.length === targetLen) return values;
  if (values.length === 0 || targetLen <= 0) return [];
  if (values.length === 1) return Array.from({ length: targetLen }, () => values[0]!);
  const out: number[] = [];
  for (let i = 0; i < targetLen; i += 1) {
    const pos = (i / (targetLen - 1)) * (values.length - 1);
    const j0 = Math.floor(pos);
    const j1 = Math.min(values.length - 1, j0 + 1);
    const t = pos - j0;
    out.push(values[j0]! * (1 - t) + values[j1]! * t);
  }
  return out;
}

/**
 * Curva glucosio «interpretazione simulatore» via LLM: stessi timestamp del deterministico,
 * **non** sostituisce misure né il motore deterministico EMPATHY.
 */
export async function runBioenergeticGlucoseAiSimulator(input: {
  date: string;
  kernel: BioenergeticDayKernelOutput;
  timeline: BioenergeticTimelineEvent[];
  deterministicGlucose: { ts: string; value: number }[];
  apiKey: string;
  model: string;
}): Promise<BioenergeticGlucoseAiSimResultV1> {
  const { date, kernel, timeline, deterministicGlucose, apiKey, model } = input;
  const expectedTs = deterministicGlucose.map((p) => p.ts);
  if (expectedTs.length < 72) {
    return {
      ok: false,
      skippedReason: "no_sim_curve",
      noteIt: "Serve la serie deterministica 10 min (≥72 punti) per allineare il confronto.",
    };
  }

  const events = compactTimelineForAiGlucoseSim(timeline);
  const kernelBrief = {
    glucoseHandlingScore: kernel.glucoseHandlingScore,
    insulinDemandScore: kernel.insulinDemandScore,
    oxidationDriveScore: kernel.oxidationDriveScore,
    anabolicSuppressionScore: kernel.anabolicSuppressionScore,
    pathwayState: kernel.pathwayState,
  };

  const userPayload = {
    date,
    kernel: kernelBrief,
    events,
    instruction:
      "Genera un profilo plausibile di glucosio ematico (mmol/L) per la giornata, coerente con pasti (CHO, IG) e sedute. Non è diagnosi. Rispetta allenamento con lieve modulazione (utilizzo muscolare).",
    outputLength: expectedTs.length,
    valueBoundsMmol: { lo: SIM_DIURNAL_GLUCOSE_V1.clampLo, hi: SIM_DIURNAL_GLUCOSE_V1.clampHi },
  };

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        max_tokens: 8000,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Sei un motore di simulazione operativa per confronti interni prodotto. Rispondi SOLO con JSON: {\"v\": number[]} — array di glucosio mmol/L, lunghezza esattamente uguale a outputLength del messaggio utente. Nessun testo fuori JSON.",
          },
          {
            role: "user",
            content: JSON.stringify(userPayload),
          },
        ],
      }),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return {
        ok: false,
        skippedReason: "bad_openai_response",
        noteIt: `OpenAI HTTP ${res.status}: ${t.slice(0, 120)}`,
      };
    }

    const payload = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = payload.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return { ok: false, skippedReason: "bad_openai_response", noteIt: "Risposta vuota dal modello." };
    }

    let values = parseOpenAiJsonArray(text);
    if (!values) {
      return { ok: false, skippedReason: "bad_openai_response", noteIt: "JSON curva AI non interpretabile." };
    }
    if (values.length !== expectedTs.length) {
      values = resampleValuesToLen(values, expectedTs.length);
    }
    if (values.length !== expectedTs.length) {
      return { ok: false, skippedReason: "bad_openai_response", noteIt: "Lunghezza serie AI dopo resampling non valida." };
    }

    const aiTrace: BioenergeticMonitoringStreamPoint[] = expectedTs.map((observedAt, i) => ({
      observedAt,
      value: Math.round(clampGlucoseMmol(values[i]!) * 1000) / 1000,
    }));

    return {
      ok: true,
      aiTrace,
      noteIt:
        "Curva da modello linguistico (solo simulatore confronto). Non è CGM, non sostituisce il motore deterministico né dati clinici.",
    };
  } catch (e) {
    return {
      ok: false,
      skippedReason: "network",
      noteIt: e instanceof Error ? e.message : "Errore di rete verso OpenAI.",
    };
  }
}
