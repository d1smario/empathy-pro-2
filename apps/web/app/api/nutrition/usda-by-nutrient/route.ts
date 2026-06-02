import { NextRequest, NextResponse } from "next/server";
import { getFunctionalNutrientCatalogEntry } from "@/lib/nutrition/functional-food-recommendations";
import { catalogIdToNutrientTargetId } from "@/lib/nutrition/pathway-cofactors-to-nutrient-targets";
import { rankFoodsForNutrient } from "@/lib/nutrition/usda-nutrient-density-ranker";
import { fetchUsdaRichFoodsMerged } from "@/lib/nutrition/usda-rich-foods-search";
import type { UsdaRichFoodItemViewModel } from "@/api/nutrition/contracts";

export const runtime = "nodejs";

function parseQueriesParam(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)
    .slice(0, 8);
}

function parseCatalogIdsParam(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  return Array.from(new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))).slice(0, 3);
}

export async function GET(req: NextRequest) {
  const key = process.env.USDA_API_KEY?.trim();
  if (!key) {
    return NextResponse.json(
      { error: "USDA_API_KEY non configurata (server). Aggiungila in .env.local.", foods: [] as UsdaRichFoodItemViewModel[] },
      { status: 503 },
    );
  }

  try {
    const sp = req.nextUrl.searchParams;
    const catalogId = (sp.get("catalogId") ?? "").trim();
    const catalogIds = parseCatalogIdsParam(sp.get("catalogIds"));
    let fdcNutrientId = Number(sp.get("fdcNutrientId"));
    let minimumPer100g = Number(sp.get("min"));
    let queries = parseQueriesParam(sp.get("queries"));
    const dataTypesRaw = sp.get("dataTypes");
    let dataTypes = dataTypesRaw
      ? dataTypesRaw.split(",").map((s) => s.trim()).filter(Boolean)
      : ["Foundation", "SR Legacy"];

    if (catalogIds.length > 0) {
      const foodsByCatalog: UsdaRichFoodItemViewModel[] = [];
      let firstError: string | null = null;
      for (const id of catalogIds) {
        const entry = getFunctionalNutrientCatalogEntry(id);
        if (!entry?.usdaRichSearch) {
          firstError = firstError ?? `catalogId sconosciuto o senza mappatura USDA ricca: ${id}`;
          continue;
        }
        const spec = entry.usdaRichSearch;
        const nutrientId = catalogIdToNutrientTargetId(id);
        if (nutrientId) {
          const ranked = await rankFoodsForNutrient({
            nutrientId,
            topN: 28,
            apiKey: key,
            liveQueries: spec.queries.length ? [...spec.queries] : [],
            fdcNutrientId: Math.round(spec.fdcNutrientId),
            minimumPer100g: spec.minimumPer100g,
          });
          foodsByCatalog.push(
            ...(ranked.foods ?? []).map((r) => ({
              fdcId: r.fdcId,
              description: r.description,
              dataType: ranked.source === "cache" ? "cache" : "fdc_live",
              targetNutrientId: Math.round(spec.fdcNutrientId),
              targetAmountPer100g: r.amountPer100g,
              targetUnitName: r.unit,
              energyKcal100: r.kcalPer100g,
              proteinG100: null,
              carbsG100: null,
              fatG100: null,
            })),
          );
          continue;
        }
        const rows = await fetchUsdaRichFoodsMerged({
          apiKey: key,
          queries: spec.queries.length ? [...spec.queries] : [],
          nutrientFilter: { id: Math.round(spec.fdcNutrientId), type: "minimum", value: spec.minimumPer100g },
          dataTypes: spec.dataTypes?.length ? [...spec.dataTypes] : ["Foundation", "SR Legacy"],
          pageSizePerQuery: 22,
          resultLimit: 28,
          delayMsBetweenQueries: 130,
        });
        foodsByCatalog.push(...rows.map((r) => ({ ...r })));
      }
      return NextResponse.json({
        foods: foodsByCatalog,
        source: "usda_fdc",
        layer: "deterministic_nutrient_density",
        queriesUsed: [],
        error: firstError,
      });
    }

    if (catalogId) {
      const entry = getFunctionalNutrientCatalogEntry(catalogId);
      if (!entry?.usdaRichSearch) {
        return NextResponse.json(
          { error: "catalogId sconosciuto o senza mappatura USDA ricca.", foods: [] },
          { status: 400 },
        );
      }
      const spec = entry.usdaRichSearch;
      fdcNutrientId = spec.fdcNutrientId;
      minimumPer100g = spec.minimumPer100g;
      queries = spec.queries.length ? [...spec.queries] : [];
      if (spec.dataTypes?.length) dataTypes = [...spec.dataTypes];
    }

    if (!Number.isFinite(fdcNutrientId) || fdcNutrientId < 1 || fdcNutrientId > 9999) {
      return NextResponse.json({ error: "fdcNutrientId non valido.", foods: [] }, { status: 400 });
    }
    if (!Number.isFinite(minimumPer100g) || minimumPer100g < 0) {
      return NextResponse.json({ error: "min (minimumPer100g) non valido.", foods: [] }, { status: 400 });
    }
    if (queries.length < 1) {
      return NextResponse.json({ error: "Serve almeno una query testuale (o catalogId con queries).", foods: [] }, { status: 400 });
    }

    const nutrientId = catalogId ? catalogIdToNutrientTargetId(catalogId) : null;
    if (nutrientId) {
      const ranked = await rankFoodsForNutrient({
        nutrientId,
        topN: 28,
        apiKey: key,
        liveQueries: queries,
        fdcNutrientId: Math.round(fdcNutrientId),
        minimumPer100g,
      });
      if (ranked.foods.length > 0) {
        const foods: UsdaRichFoodItemViewModel[] = ranked.foods.map((r) => ({
          fdcId: r.fdcId,
          description: r.description,
          dataType: ranked.source === "cache" ? "cache" : "fdc_live",
          targetNutrientId: Math.round(fdcNutrientId),
          targetAmountPer100g: r.amountPer100g,
          targetUnitName: r.unit,
          energyKcal100: r.kcalPer100g,
          proteinG100: null,
          carbsG100: null,
          fatG100: null,
        }));
        return NextResponse.json({
          foods,
          source: ranked.source,
          layer: "deterministic_nutrient_density",
          nutrientFilter: { fdcNutrientId: Math.round(fdcNutrientId), minimumPer100g },
          queriesUsed: queries,
          cacheFirst: true,
        });
      }
    }

    const rows = await fetchUsdaRichFoodsMerged({
      apiKey: key,
      queries,
      nutrientFilter: { id: Math.round(fdcNutrientId), type: "minimum", value: minimumPer100g },
      dataTypes: dataTypes.length ? dataTypes : ["Foundation", "SR Legacy"],
      pageSizePerQuery: 22,
      resultLimit: 28,
      delayMsBetweenQueries: 130,
    });

    const foods: UsdaRichFoodItemViewModel[] = rows.map((r) => ({ ...r }));
    return NextResponse.json({
      foods,
      source: "usda_fdc",
      layer: "deterministic_nutrient_density",
      nutrientFilter: { fdcNutrientId: Math.round(fdcNutrientId), minimumPer100g },
      queriesUsed: queries,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Errore USDA";
    return NextResponse.json({ error: message, foods: [] as UsdaRichFoodItemViewModel[] }, { status: 500 });
  }
}
