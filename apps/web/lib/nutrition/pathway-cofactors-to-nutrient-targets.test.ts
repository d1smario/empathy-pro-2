import assert from "node:assert/strict";
import test from "node:test";
import { pathwayCofactorsToNutrientTargets } from "./pathway-cofactors-to-nutrient-targets";

test("selenium: matcha selenio (suffix italiano)", () => {
  const ts = pathwayCofactorsToNutrientTargets(["Micronutrienti selenio/zinco"]);
  assert.ok(ts.some((x) => x.nutrientId === "se_mcg"));
  assert.ok(ts.some((x) => x.nutrientId === "zn_mg"));
});

test("noise Na/K: non crea falsi Potassio/Sodio su substrato elettroliti", () => {
  const ts = pathwayCofactorsToNutrientTargets([
    "Elettroliti Na/K compatibili con assorbimento intestinale",
  ]);
  assert.equal(ts.some((x) => x.nutrientId === "k_mg"), false);
  assert.equal(ts.some((x) => x.nutrientId === "na_mg"), false);
});

test("blocco Na/K ignorato: Vit C / Se / Zn restano inclusi con Mg+B prima", () => {
  const ts = pathwayCofactorsToNutrientTargets([
    "Magnesio (chinasi)",
    "Vitamine B1/B3 (utilizzo CHO)",
    "Vitamina C da alimenti",
    "Micronutrienti selenio/zinco",
    "Elettroliti Na/K compatibili con assorbimento intestinale",
  ]);
  assert.ok(ts.some((x) => x.nutrientId === "vitC_mg"));
  assert.ok(ts.some((x) => x.nutrientId === "se_mcg"));
  assert.ok(ts.some((x) => x.nutrientId === "zn_mg"));
  assert.equal(ts.some((x) => x.nutrientId === "k_mg"), false);
  assert.equal(ts.some((x) => x.nutrientId === "na_mg"), false);
});
