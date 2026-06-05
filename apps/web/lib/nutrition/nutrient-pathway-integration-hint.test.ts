import assert from "node:assert/strict";
import test from "node:test";
import { buildIntegrationHintItemsForSlot } from "@/lib/nutrition/nutrient-pathway-slot-registry";

test("hint integrazione: nome specifico nutriente (B12, ferro, zinco, B1, B3)", () => {
  const uncovered = [
    { nutrientId: "vitB12_mcg", displayNameIt: "Vitamina B12" },
    { nutrientId: "fe_mg", displayNameIt: "Ferro" },
    { nutrientId: "zn_mg", displayNameIt: "Zinco" },
    { nutrientId: "thiamineB1_mg", displayNameIt: "Tiamina (B1)" },
    { nutrientId: "niacinB3_mg", displayNameIt: "Niacina (B3)" },
  ];
  const items = buildIntegrationHintItemsForSlot("snack_am", uncovered, 3);
  assert.ok(items.length >= 1);
  for (const it of items) {
    assert.match(it.name, /^Integrazione suggerita:/i);
    assert.ok(!/Integrazione \(se concordata\)$/i.test(it.name));
    assert.ok(it.portionHint.length > 20, `Hint troppo corto per ${it.name}`);
  }
  const names = items.map((i) => i.name).join(" ");
  assert.match(names, /B12|Vitamina B12/i);
});
