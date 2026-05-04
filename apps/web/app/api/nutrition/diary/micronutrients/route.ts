import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import {
  bucketLines,
  scaleAndMergeMicros,
  type FdcMicroPer100g,
  type MicroRollupBucket,
  type MicroTotalLine,
} from "@/lib/nutrition/fdc-micronutrient-extract";
import { getOrImportFdcFood } from "@/lib/nutrition/fdc-food-cache";

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

function microRows(
  raw: unknown,
  key: "vitamins" | "minerals" | "aminoAcids" | "fattyAcids" | "otherNutrients",
): FdcMicroPer100g[] {
  if (!raw || typeof raw !== "object") return [];
  const list = (raw as Record<string, unknown>)[key];
  if (!Array.isArray(list)) return [];
  return list
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const nutrientId = Number(r.nutrientId);
      const name = typeof r.name === "string" ? r.name : "";
      const amountPer100g = Number(r.amountPer100g);
      const unit = typeof r.unit === "string" ? r.unit : "—";
      if (!Number.isFinite(nutrientId) || nutrientId <= 0 || !name || !Number.isFinite(amountPer100g)) return null;
      return { nutrientId: Math.round(nutrientId), name, amountPer100g, unit };
    })
    .filter((row): row is FdcMicroPer100g => Boolean(row));
}

function mergeAlreadyScaled(rows: FdcMicroPer100g[], bucket: MicroRollupBucket, acc: Map<number, MicroTotalLine>): void {
  for (const row of rows) {
    const prev = acc.get(row.nutrientId);
    if (!prev) {
      acc.set(row.nutrientId, {
        nutrientId: row.nutrientId,
        name: row.name,
        unit: row.unit,
        total: row.amountPer100g,
        bucket,
      });
    } else if (prev.unit === row.unit) {
      prev.total += row.amountPer100g;
    }
  }
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
      .select("fdc_id, quantity_g, provenance, micronutrients")
      .eq("athlete_id", athleteId)
      .eq("entry_date", date);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data ?? []) as Array<{
      fdc_id: number | null;
      quantity_g: number;
      provenance: string;
      micronutrients: unknown;
    }>;
    const fdcRows = rows.filter((r) => r.provenance === "usda_fdc" && r.fdc_id != null && Number(r.quantity_g) > 0);
    const nonFdcCount = rows.length - fdcRows.length;

    const acc = new Map<number, MicroTotalLine>();
    const cache = new Map<number, Awaited<ReturnType<typeof getOrImportFdcFood>>>();
    let importedFallbackCount = 0;

    for (const r of fdcRows) {
      const id = Math.round(Number(r.fdc_id));
      const q = Number(r.quantity_g);
      if (!Number.isFinite(id) || id < 1 || !Number.isFinite(q) || q <= 0) continue;

      const snapshot = r.micronutrients;
      const vitamins = microRows(snapshot, "vitamins");
      const minerals = microRows(snapshot, "minerals");
      const aminoAcids = microRows(snapshot, "aminoAcids");
      const fattyAcids = microRows(snapshot, "fattyAcids");
      if (vitamins.length || minerals.length || aminoAcids.length || fattyAcids.length) {
        mergeAlreadyScaled(vitamins, "vitamins", acc);
        mergeAlreadyScaled(minerals, "minerals", acc);
        mergeAlreadyScaled(aminoAcids, "aminoAcids", acc);
        mergeAlreadyScaled(fattyAcids, "fattyAcids", acc);
        continue;
      }

      let food = cache.get(id);
      if (!food) {
        food = await getOrImportFdcFood(id);
        cache.set(id, food);
        importedFallbackCount += "error" in food ? 0 : 1;
      }
      if ("error" in food) continue;
      scaleAndMergeMicros(food.vitamins, q, acc);
      scaleAndMergeMicros(food.minerals, q, acc);
      scaleAndMergeMicros(food.aminoAcids, q, acc);
      scaleAndMergeMicros(food.fattyAcids, q, acc);
      scaleAndMergeMicros(food.otherNutrients, q, acc, "other");
    }

    const grouped = bucketLines(acc.values());
    const caps: Record<MicroRollupBucket, number> = {
      vitamins: 14,
      minerals: 12,
      aminoAcids: 22,
      fattyAcids: 10,
      other: 28,
    };

    const payload = {
      date,
      ok: true,
      vitamins: toOut(grouped.vitamins, caps.vitamins),
      minerals: toOut(grouped.minerals, caps.minerals),
      aminoAcids: toOut(grouped.aminoAcids, caps.aminoAcids),
      fattyAcids: toOut(grouped.fattyAcids, caps.fattyAcids),
      otherNutrients: toOut(grouped.other, caps.other),
      fdcEntryCount: fdcRows.length,
      nonFdcEntryCount: nonFdcCount,
      importedFallbackCount,
      messageIt:
        nonFdcCount > 0
          ? `Stima da ${fdcRows.length} voci USDA cache del giorno. Le altre ${nonFdcCount} voci (manuale/prodotto) non includono micronutrienti automatici.`
          : `Stima aggregata da ${fdcRows.length} voci USDA cache per la data selezionata.`,
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
