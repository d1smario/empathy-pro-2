import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyFdcFoodRow,
  foodMatchesDietProfile,
  taxonomyMatchesFilter,
} from "@/lib/nutrition/v2/classify-fdc-description";

test("classify: pasta cooked → primo_carb + mediterranean + cho_complex", () => {
  const t = classifyFdcFoodRow({
    description: "Pasta, cooked, spaghetti",
    kcalPer100g: 158,
    proteinG: 5.8,
    carbsG: 30,
    fatG: 0.9,
  });
  assert.ok(t.mealCourse.includes("primo_carb"));
  assert.ok(t.foodFamily.includes("pasta_riso"));
  assert.ok(t.dietProfile.includes("mediterranean"));
  assert.ok(t.slotFit.includes("main_meal"));
});

test("classify: spinach → vegan + folate_dense + low histamine path", () => {
  const t = classifyFdcFoodRow({
    description: "Spinach, raw",
    kcalPer100g: 23,
    proteinG: 2.9,
    carbsG: 3.6,
    fatG: 0.4,
    fiberG: 2.2,
  });
  assert.ok(t.foodFamily.includes("verdura"));
  assert.ok(t.dietProfile.includes("vegan"));
  assert.ok(t.nutrientDensity.includes("folate_dense"));
  assert.ok(t.aminoProfile.includes("histamine_low"));
});

test("diet filter: vegan esclude chicken", () => {
  const chicken = classifyFdcFoodRow({
    description: "Chicken breast, roasted",
    kcalPer100g: 165,
    proteinG: 31,
    carbsG: 0,
    fatG: 3.6,
  });
  assert.ok(chicken.dietExclude.includes("animal"));
  assert.ok(!foodMatchesDietProfile(chicken, "vegan"));
  assert.ok(foodMatchesDietProfile(chicken, "omnivore"));
});

test("pasta: gluten in diet_exclude, vegan ok, celiac no", () => {
  const pasta = classifyFdcFoodRow({
    description: "Pasta, cooked, spaghetti",
    kcalPer100g: 158,
    proteinG: 5.8,
    carbsG: 30,
    fatG: 0.9,
  });
  assert.ok(pasta.dietExclude.includes("gluten"));
  assert.ok(foodMatchesDietProfile(pasta, "vegan"));
  assert.ok(!foodMatchesDietProfile(pasta, "celiac"));
  assert.ok(foodMatchesDietProfile(pasta, "mediterranean") || foodMatchesDietProfile(pasta, "omnivore"));
});

test("low_histamine esclude histamine_rich", () => {
  const aged = classifyFdcFoodRow({
    description: "Cheese, parmesan, aged",
    kcalPer100g: 392,
    proteinG: 35,
    carbsG: 3,
    fatG: 28,
  });
  assert.ok(
    !taxonomyMatchesFilter(aged, {
      dietProfile: "low_histamine",
      slotFit: "main_meal",
      excludeAminoProfile: ["histamine_rich"],
    }),
  );
});

test("whey → leucine_rich + preparato_polvere", () => {
  const t = classifyFdcFoodRow({
    description: "Whey protein powder",
    kcalPer100g: 380,
    proteinG: 78,
    carbsG: 8,
    fatG: 4,
  });
  assert.ok(t.mealCourse.includes("preparato_polvere"));
  assert.ok(t.aminoProfile.includes("leucine_rich"));
});
