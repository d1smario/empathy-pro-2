import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";

export const runtime = "nodejs";

const MAX_B64_CHARS = 6_500_000;

export type FoodPhotoEstimateBody = {
  label_it: string;
  portion_g_estimate: number | null;
  kcal_estimate: number | null;
  carbs_g: number | null;
  protein_g: number | null;
  fat_g: number | null;
  fdc_search_hint: string | null;
  notes_it: string | null;
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function parseVisionPayload(raw: string): FoodPhotoEstimateBody | null {
  const t = raw.trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const o = JSON.parse(t.slice(start, end + 1)) as Record<string, unknown>;
    const num = (v: unknown): number | null => {
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (typeof v === "string" && v.trim() !== "") {
        const n = Number(v.replace(",", "."));
        return Number.isFinite(n) ? n : null;
      }
      return null;
    };
    const label = String(o.label_it ?? o.label ?? "").trim().slice(0, 220);
    if (!label) return null;
    const portion = num(o.portion_g_estimate ?? o.portion_g);
    const kcal = num(o.kcal_estimate ?? o.kcal);
    return {
      label_it: label,
      portion_g_estimate: portion != null ? clamp(Math.round(portion), 10, 2000) : null,
      kcal_estimate: kcal != null ? clamp(kcal, 0, 8000) : null,
      carbs_g: (() => {
        const x = num(o.carbs_g);
        return x != null ? clamp(x, 0, 2000) : null;
      })(),
      protein_g: (() => {
        const x = num(o.protein_g);
        return x != null ? clamp(x, 0, 500) : null;
      })(),
      fat_g: (() => {
        const x = num(o.fat_g);
        return x != null ? clamp(x, 0, 500) : null;
      })(),
      fdc_search_hint: o.fdc_search_hint != null ? String(o.fdc_search_hint).trim().slice(0, 120) : null,
      notes_it: o.notes_it != null ? String(o.notes_it).trim().slice(0, 400) : null,
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as {
      athleteId?: string;
      imageBase64?: string;
      mimeType?: string;
    } | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Body JSON non valido" }, { status: 400 });
    }
    const athleteId = String(body.athleteId ?? "").trim();
    if (!athleteId) {
      return NextResponse.json({ error: "Missing athleteId" }, { status: 400 });
    }
    await requireAthleteReadContext(req, athleteId);

    const b64 = String(body.imageBase64 ?? "").replace(/\s/g, "");
    if (!b64 || b64.length > MAX_B64_CHARS) {
      return NextResponse.json({ error: "Immagine mancante o troppo grande." }, { status: 400 });
    }
    const mime = String(body.mimeType ?? "image/jpeg").trim() || "image/jpeg";
    if (!/^image\/(jpeg|jpg|png|webp)$/i.test(mime)) {
      return NextResponse.json({ error: "Usa JPEG, PNG o WebP." }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY non configurata: stima da foto non disponibile sul server." },
        { status: 503 },
      );
    }

    const model = process.env.OPENAI_VISION_MODEL?.trim() || "gpt-4o-mini";

    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0.25,
          max_tokens: 500,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "Analizza foto di cibo. Rispondi SOLO un oggetto JSON con chiavi: label_it (italiano, breve), portion_g_estimate (numero grammi porzione stimata o null), kcal_estimate, carbs_g, protein_g, fat_g (macro per quella porzione stimata; null se incerto), fdc_search_hint (stringa breve in italiano o inglese per ricerca alimenti), notes_it (una frase: stima visiva, non laboratorio).",
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Stima il piatto, la porzione in grammi e le kcal/macronutrienti per quella porzione.",
                },
                {
                  type: "image_url",
                  image_url: { url: `data:${mime};base64,${b64}`, detail: "low" },
                },
              ],
            },
          ],
        }),
      });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Network error" }, { status: 502 });
    }

    if (!response.ok) {
      const t = await response.text().catch(() => "");
      return NextResponse.json({ error: `OpenAI HTTP ${response.status}: ${t.slice(0, 160)}` }, { status: 502 });
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = payload.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return NextResponse.json({ error: "Risposta vision vuota." }, { status: 422 });
    }

    const estimate = parseVisionPayload(text);
    if (!estimate) {
      return NextResponse.json({ error: "JSON vision non interpretabile." }, { status: 422 });
    }

    return NextResponse.json({ estimate });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "food-photo-estimate error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
