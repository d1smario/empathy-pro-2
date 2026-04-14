import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import {
  bucketLines,
  extractMicroNutrientsPer100g,
  scaleAndMergeMicros,
  type FdcMicroBucket,
  type MicroTotalLine,
} from "@/lib/nutrition/fdc-micronutrient-extract";
import { fetchFdcFoodNutrientsRaw } from "@/lib/nutrition/usda-fdc-food-detail";

export const runtime = "nodejs";

type OutLine = { name: string; total: number; unit: string };

function roundDisplay(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (Math.abs(n) >= 100) return Math.round(n * 10) / 10;
  if (Math.abs(n) >= 1) return Math.round(n * 100) / 100;
  return Math.round(n * 1000) / 1000;
}

function toOut(lines: MicroTotalLine[], max: number): OutLine[] {
  return lines.slice(0, max).map((L) => ({
    name: L.name,
    total: roundDisplay(L.total),
    unit: L.unit,
  }));
}

export async function GET(req: NextRequest) {
  try {
    const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
    const date = (req.nextUrl.searchParams.get("date") ?? "").trim();
    if (!athleteId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Serve athleteId e date (YYYY-MM-DD)" }, { status: 400 });
    }
    const { db } = await requireAthleteReadContext(req, athleteId);
    const { data, error } = await db
      .from("food_diary_entries")
      .select("fdc_id, quantity_g, provenance")
      .eq("athlete_id", athleteId)
      .eq("entry_date", date);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data ?? []) as Array<{ fdc_id: number | null; quantity_g: number; provenance: string }>;
    const fdcRows = rows.filter((r) => r.provenance === "usda_fdc" && r.fdc_id != null && Number(r.quantity_g) > 0);
    const nonFdcCount = rows.length - fdcRows.length;

    const apiKey = process.env.USDA_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({
        date,
        ok: false,
        reason: "no_usda_key",
        messageIt:
          "Micronutrienti da USDA non disponibili senza USDA_API_KEY sul server. I macro nel diario restano validi.",
        vitamins: [] as OutLine[],
        minerals: [] as OutLine[],
        aminoAcids: [] as OutLine[],
        fattyAcids: [] as OutLine[],
        fdcEntryCount: fdcRows.length,
        nonFdcEntryCount: nonFdcCount,
      });
    }

    const acc = new Map<number, MicroTotalLine>();
    const cache = new Map<number, ReturnType<typeof extractMicroNutrientsPer100g>>();

    for (const r of fdcRows) {
      const id = Math.round(Number(r.fdc_id));
      const q = Number(r.quantity_g);
      if (!Number.isFinite(id) || id < 1 || !Number.isFinite(q) || q <= 0) continue;
      let per100 = cache.get(id);
      if (!per100) {
        const raw = await fetchFdcFoodNutrientsRaw(apiKey, id);
        if ("error" in raw) {
          continue;
        }
        per100 = extractMicroNutrientsPer100g(raw.foodNutrients);
        cache.set(id, per100);
      }
      scaleAndMergeMicros(per100, q, acc);
    }

    const grouped = bucketLines(acc.values());
    const caps: Record<FdcMicroBucket, number> = {
      vitamins: 14,
      minerals: 12,
      aminoAcids: 22,
      fattyAcids: 10,
    };

    const payload = {
      date,
      ok: true,
      vitamins: toOut(grouped.vitamins, caps.vitamins),
      minerals: toOut(grouped.minerals, caps.minerals),
      aminoAcids: toOut(grouped.aminoAcids, caps.aminoAcids),
      fattyAcids: toOut(grouped.fattyAcids, caps.fattyAcids),
      fdcEntryCount: fdcRows.length,
      nonFdcEntryCount: nonFdcCount,
      messageIt:
        nonFdcCount > 0
          ? `Stima da ${fdcRows.length} voci USDA del giorno. Le altre ${nonFdcCount} voci (manuale/Open Food Facts) non includono micronutrienti automatici.`
          : `Stima aggregata da ${fdcRows.length} voci USDA per la data selezionata.`,
    };

    return NextResponse.json(payload);
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Micronutrients rollup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
