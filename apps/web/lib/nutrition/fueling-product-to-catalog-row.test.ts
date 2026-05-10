import test from "node:test";
import assert from "node:assert/strict";
import { FUELING_PRODUCT_CATALOG } from "@/lib/nutrition/fueling-product-catalog";
import { fuelingProductToCatalogRow } from "@/lib/nutrition/fueling-product-to-catalog-row";

test("fueling catalog rows stay within plausibility caps", () => {
  for (const p of FUELING_PRODUCT_CATALOG) {
    const r = fuelingProductToCatalogRow(p);
    assert.ok(r.kcal_100g >= 0 && r.kcal_100g <= 900, `${p.brand} ${p.product} kcal`);
    assert.ok(r.cho_100g >= 0 && r.cho_100g <= 100);
    assert.ok(r.protein_100g >= 0 && r.protein_100g <= 100);
    assert.ok(r.fat_100g >= 0 && r.fat_100g <= 100);
    assert.ok(r.external_key.startsWith("fueling:"));
    assert.equal(r.source, "brand-site");
  }
});
