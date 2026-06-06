import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { taxonomyMatchesFilter } from "@/lib/nutrition/v2/classify-fdc-description";
import { fdcRowToHit, queryFdcBranchPool, type FdcFoodBrowseHit } from "@/lib/nutrition/v2/fdc-branch-query";
import type { FdcFoodBrowseFilter } from "@/lib/nutrition/v2/fdc-food-taxonomy";
import { filterSummaryIt } from "@/lib/nutrition/v2/fdc-food-taxonomy";

export type { FdcFoodBrowseHit };
export { queryFdcBranchPool };

async function browseFdcFoodPoolWithClient(
  admin: SupabaseClient,
  filter: FdcFoodBrowseFilter,
): Promise<FdcFoodBrowseHit[]> {
  const limit = Math.min(80, Math.max(5, filter.limit ?? 24));
  const tagged = await queryFdcBranchPool(admin, filter);
  if (tagged.length >= Math.min(limit, 3)) return tagged;

  const { data: foods, error } = await admin
    .from("nutrition_fdc_foods")
    .select("fdc_id, description, kcal_100g, protein_100g, carbs_100g, fat_100g, fiber_100g")
    .gt("kcal_100g", 0)
    .order("description")
    .limit(120);

  if (error || !Array.isArray(foods) || foods.length === 0) return tagged;

  const ids = foods.map((r) => Math.round(Number((r as Record<string, unknown>).fdc_id))).filter((id) => id >= 1);
  const tagMap = new Map<number, Record<string, unknown>>();
  if (ids.length > 0) {
    const { data: tagRows } = await admin.from("nutrition_fdc_food_tags").select("*").in("fdc_id", ids);
    if (Array.isArray(tagRows)) {
      for (const tr of tagRows) {
        const id = Math.round(Number((tr as Record<string, unknown>).fdc_id));
        if (Number.isFinite(id)) tagMap.set(id, tr as Record<string, unknown>);
      }
    }
  }

  const hits = [...tagged];
  const seen = new Set(hits.map((h) => h.fdcId));
  for (const row of foods) {
    const r = row as Record<string, unknown>;
    const id = Math.round(Number(r.fdc_id));
    if (seen.has(id)) continue;
    const hit = fdcRowToHit(r, tagMap.get(id) ?? null);
    if (!hit) continue;
    if (!taxonomyMatchesFilter(hit.tags, filter)) continue;
    hits.push(hit);
    seen.add(id);
    if (hits.length >= limit) break;
  }

  return hits;
}

export async function browseFdcFoodPool(filter: FdcFoodBrowseFilter): Promise<FdcFoodBrowseHit[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  return browseFdcFoodPoolWithClient(admin, filter);
}

export { filterSummaryIt };
