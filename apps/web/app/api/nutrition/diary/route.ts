import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext, requireAthleteWriteContext } from "@/lib/auth/athlete-read-context";
import type { FoodDiaryEntryViewModel, FoodDiaryListViewModel } from "@/api/nutrition/contracts";
import { fetchFdcFoodPer100gMacros, scaleMacrosFromPer100g } from "@/lib/nutrition/usda-fdc-food-detail";

export const runtime = "nodejs";

function rowToVm(r: Record<string, unknown>): FoodDiaryEntryViewModel {
  return {
    id: String(r.id),
    athleteId: String(r.athlete_id),
    entryDate: String(r.entry_date),
    entryTime: r.entry_time != null ? String(r.entry_time).slice(0, 8) : null,
    mealSlot: r.meal_slot as FoodDiaryEntryViewModel["mealSlot"],
    provenance: r.provenance as FoodDiaryEntryViewModel["provenance"],
    fdcId: r.fdc_id != null ? Number(r.fdc_id) : null,
    foodLabel: String(r.food_label),
    quantityG: Number(r.quantity_g),
    kcal: Number(r.kcal),
    carbsG: Number(r.carbs_g),
    proteinG: Number(r.protein_g),
    fatG: Number(r.fat_g),
    sodiumMg: r.sodium_mg != null ? Number(r.sodium_mg) : null,
    referenceSourceTag: r.reference_source_tag != null ? String(r.reference_source_tag) : null,
    notes: r.notes != null ? String(r.notes) : null,
    supplements: r.supplements != null ? String(r.supplements) : null,
    createdAt: String(r.created_at),
  };
}

export async function GET(req: NextRequest) {
  try {
    const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
    const from = (req.nextUrl.searchParams.get("from") ?? "").trim();
    const to = (req.nextUrl.searchParams.get("to") ?? "").trim();
    if (!athleteId || !from || !to) {
      return NextResponse.json({ error: "Serve athleteId, from, to (YYYY-MM-DD)" }, { status: 400 });
    }
    const { db } = await requireAthleteReadContext(req, athleteId);
    const { data, error } = await db
      .from("food_diary_entries")
      .select("*")
      .eq("athlete_id", athleteId)
      .gte("entry_date", from)
      .lte("entry_date", to)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      if (error.message?.includes("does not exist") || error.code === "42P01") {
        return NextResponse.json(
          {
            error:
              "Tabella food_diary_entries non presente: applica la migrazione 021_food_diary_entries.sql su Supabase.",
            athleteId,
            from,
            to,
            entries: [],
            dayTotals: [],
          } satisfies FoodDiaryListViewModel & { error: string },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data ?? []) as Record<string, unknown>[];
    const entries = rows.map(rowToVm);

    const byDay = new Map<string, { kcal: number; carbsG: number; proteinG: number; fatG: number; n: number }>();
    for (const e of entries) {
      const cur = byDay.get(e.entryDate) ?? { kcal: 0, carbsG: 0, proteinG: 0, fatG: 0, n: 0 };
      cur.kcal += e.kcal;
      cur.carbsG += e.carbsG;
      cur.proteinG += e.proteinG;
      cur.fatG += e.fatG;
      cur.n += 1;
      byDay.set(e.entryDate, cur);
    }
    const dayTotals = Array.from(byDay.entries())
      .map(([date, t]) => ({
        date,
        kcal: Math.round(t.kcal * 100) / 100,
        carbsG: Math.round(t.carbsG * 100) / 100,
        proteinG: Math.round(t.proteinG * 100) / 100,
        fatG: Math.round(t.fatG * 100) / 100,
        entryCount: t.n,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    const payload: FoodDiaryListViewModel = { athleteId, from, to, entries, dayTotals };
    return NextResponse.json(payload);
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Food diary GET failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      athleteId?: string;
      entryDate?: string;
      entryTime?: string | null;
      mealSlot?: string;
      mode?: string;
      fdcId?: number;
      quantityG?: number;
      foodLabel?: string;
      notes?: string | null;
      supplements?: string | null;
      kcalPer100g?: number;
      carbsPer100g?: number;
      proteinPer100g?: number;
      fatPer100g?: number;
      sodiumMgPer100g?: number | null;
      referenceSourceTag?: string;
    };

    const athleteId = (body.athleteId ?? "").trim();
    const entryDate = (body.entryDate ?? "").trim();
    const quantityG = Number(body.quantityG);
    const mealSlotRaw = (body.mealSlot ?? "other").trim().toLowerCase();
    const mealSlot = ["breakfast", "lunch", "dinner", "snack", "other"].includes(mealSlotRaw)
      ? mealSlotRaw
      : "other";

    if (!athleteId || !entryDate) {
      return NextResponse.json({ error: "athleteId e entryDate obbligatori" }, { status: 400 });
    }
    if (!Number.isFinite(quantityG) || quantityG <= 0 || quantityG > 50000) {
      return NextResponse.json({ error: "quantityG deve essere tra 0 e 50000 g" }, { status: 400 });
    }

    const { db } = await requireAthleteWriteContext(req, athleteId);

    const apiKey = process.env.USDA_API_KEY?.trim();
    const mode = (body.mode ?? "usda_fdc").trim();

    let insert: Record<string, unknown>;

    if (mode === "usda_fdc") {
      const fdcId = Number(body.fdcId);
      if (!apiKey) {
        return NextResponse.json(
          { error: "USDA_API_KEY non configurata: impossibile risolvere FDC lato server." },
          { status: 503 },
        );
      }
      if (!Number.isFinite(fdcId) || fdcId < 1) {
        return NextResponse.json({ error: "fdcId non valido" }, { status: 400 });
      }
      const detail = await fetchFdcFoodPer100gMacros(apiKey, Math.round(fdcId));
      if ("error" in detail) {
        return NextResponse.json({ error: detail.error }, { status: 502 });
      }
      const scaled = scaleMacrosFromPer100g(detail, quantityG);
      insert = {
        athlete_id: athleteId,
        entry_date: entryDate,
        entry_time: body.entryTime?.trim() || null,
        meal_slot: mealSlot,
        provenance: "usda_fdc",
        fdc_id: Math.round(fdcId),
        food_label: detail.description.slice(0, 500),
        quantity_g: quantityG,
        kcal: scaled.kcal,
        carbs_g: scaled.carbsG,
        protein_g: scaled.proteinG,
        fat_g: scaled.fatG,
        sodium_mg: scaled.sodiumMg,
        micronutrients: {},
        reference_source_tag: null,
        notes: body.notes?.trim() || null,
        supplements: body.supplements?.trim() || null,
        user_confirmed: true,
      };
    } else if (mode === "scaled_reference") {
      const label = (body.foodLabel ?? "").trim();
      if (label.length < 1) {
        return NextResponse.json({ error: "foodLabel obbligatorio per scaled_reference" }, { status: 400 });
      }
      const k100 = Number(body.kcalPer100g);
      const c100 = Number(body.carbsPer100g);
      const p100 = Number(body.proteinPer100g);
      const f100 = Number(body.fatPer100g);
      if (![k100, c100, p100, f100].every((x) => Number.isFinite(x) && x >= 0)) {
        return NextResponse.json({ error: "Valori per 100g non validi" }, { status: 400 });
      }
      const na100 = body.sodiumMgPer100g != null ? Number(body.sodiumMgPer100g) : null;
      const scaled = scaleMacrosFromPer100g(
        {
          kcalPer100g: k100,
          carbsPer100g: c100,
          proteinPer100g: p100,
          fatPer100g: f100,
          sodiumMgPer100g: na100 != null && Number.isFinite(na100) ? na100 : null,
        },
        quantityG,
      );
      insert = {
        athlete_id: athleteId,
        entry_date: entryDate,
        entry_time: body.entryTime?.trim() || null,
        meal_slot: mealSlot,
        provenance: "scaled_reference",
        fdc_id: null,
        food_label: label.slice(0, 500),
        quantity_g: quantityG,
        kcal: scaled.kcal,
        carbs_g: scaled.carbsG,
        protein_g: scaled.proteinG,
        fat_g: scaled.fatG,
        sodium_mg: scaled.sodiumMg,
        micronutrients: {},
        reference_source_tag: (body.referenceSourceTag ?? "lookup").slice(0, 120),
        notes: body.notes?.trim() || null,
        supplements: body.supplements?.trim() || null,
        user_confirmed: true,
      };
    } else {
      return NextResponse.json({ error: "mode deve essere usda_fdc o scaled_reference" }, { status: 400 });
    }

    const { data, error } = await db.from("food_diary_entries").insert(insert).select("*").single();

    if (error) {
      if (error.message?.includes("does not exist") || error.code === "42P01") {
        return NextResponse.json(
          { error: "Tabella food_diary_entries assente — applica migrazione 021." },
          { status: 503 },
        );
      }
      if (error.code === "42501" || error.message?.toLowerCase().includes("row-level security")) {
        return NextResponse.json(
          {
            error:
              "Salvataggio bloccato dai permessi sul database. Verifica di essere loggato come utente collegato a questo atleta in Profilo, oppure che il coach abbia il collegamento attivo.",
          },
          { status: 403 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ entry: rowToVm(data as Record<string, unknown>) });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Food diary POST failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
    const id = (req.nextUrl.searchParams.get("id") ?? "").trim();
    if (!athleteId || !id) {
      return NextResponse.json({ error: "Serve athleteId e id" }, { status: 400 });
    }
    const { db } = await requireAthleteWriteContext(req, athleteId);
    const { data, error } = await db
      .from("food_diary_entries")
      .delete()
      .eq("id", id)
      .eq("athlete_id", athleteId)
      .select("id");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data?.length) {
      return NextResponse.json({ error: "Voce non trovata" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Food diary DELETE failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
