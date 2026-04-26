/**
 * Profili nutrizionali di riferimento (valori educativi / USDA-inspired arrotondati per 100 g porzione edibile).
 * Usati per stimare micro/macro/aminoacidi/frazioni lipidiche quando si scala per kcal dell’item nel piano.
 */

export type CanonicalFoodKey = string;

/** Tutti i valori sono per 100 g (o 100 ml per liquidi densi tipo latte), salvo note. */
export type CanonicalFoodNutrients = {
  kcalPer100g: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  saturatedFatG: number;
  monoFatG: number;
  polyFatG: number;
  omega3G: number;
  vitA_mcg_RAE: number;
  vitC_mg: number;
  vitD_mcg: number;
  vitE_mg: number;
  vitK_mcg: number;
  thiamineB1_mg: number;
  riboflavinB2_mg: number;
  niacinB3_mg: number;
  vitB6_mg: number;
  folate_mcg: number;
  vitB12_mcg: number;
  ca_mg: number;
  fe_mg: number;
  mg_mg: number;
  p_mg: number;
  k_mg: number;
  na_mg: number;
  zn_mg: number;
  se_mcg: number;
  /** EAA in g per 100 g alimento (stime da profilo proteico medio). */
  eaa_leu: number;
  eaa_lys: number;
  eaa_met: number;
  eaa_phe: number;
  eaa_thr: number;
  eaa_trp: number;
  eaa_ile: number;
  eaa_val: number;
  eaa_his: number;
};

export type ScaledMealItemNutrients = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  saturatedFatG: number;
  monoFatG: number;
  polyFatG: number;
  omega3G: number;
  vitA_mcg_RAE: number;
  vitC_mg: number;
  vitD_mcg: number;
  vitE_mg: number;
  vitK_mcg: number;
  thiamineB1_mg: number;
  riboflavinB2_mg: number;
  niacinB3_mg: number;
  vitB6_mg: number;
  folate_mcg: number;
  vitB12_mcg: number;
  ca_mg: number;
  fe_mg: number;
  mg_mg: number;
  p_mg: number;
  k_mg: number;
  na_mg: number;
  zn_mg: number;
  se_mcg: number;
  eaa_leu: number;
  eaa_lys: number;
  eaa_met: number;
  eaa_phe: number;
  eaa_thr: number;
  eaa_trp: number;
  eaa_ile: number;
  eaa_val: number;
  eaa_his: number;
};

const Z: CanonicalFoodNutrients = {
  kcalPer100g: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  fiberG: 0,
  saturatedFatG: 0,
  monoFatG: 0,
  polyFatG: 0,
  omega3G: 0,
  vitA_mcg_RAE: 0,
  vitC_mg: 0,
  vitD_mcg: 0,
  vitE_mg: 0,
  vitK_mcg: 0,
  thiamineB1_mg: 0,
  riboflavinB2_mg: 0,
  niacinB3_mg: 0,
  vitB6_mg: 0,
  folate_mcg: 0,
  vitB12_mcg: 0,
  ca_mg: 0,
  fe_mg: 0,
  mg_mg: 0,
  p_mg: 0,
  k_mg: 0,
  na_mg: 0,
  zn_mg: 0,
  se_mcg: 0,
  eaa_leu: 0,
  eaa_lys: 0,
  eaa_met: 0,
  eaa_phe: 0,
  eaa_thr: 0,
  eaa_trp: 0,
  eaa_ile: 0,
  eaa_val: 0,
  eaa_his: 0,
};

function row(p: Partial<CanonicalFoodNutrients> & Pick<CanonicalFoodNutrients, "kcalPer100g">): CanonicalFoodNutrients {
  return { ...Z, ...p };
}

/** Banca dati interna: chiavi stabili per inferenza da nome item. */
export const CANONICAL_FOOD_TABLE: Record<string, CanonicalFoodNutrients> = {
  generic_mixed: row({
    kcalPer100g: 165,
    proteinG: 8,
    carbsG: 18,
    fatG: 6,
    fiberG: 2,
    saturatedFatG: 2,
    monoFatG: 2.2,
    polyFatG: 1.2,
    omega3G: 0.15,
    vitC_mg: 8,
    vitD_mcg: 0.3,
    folate_mcg: 35,
    ca_mg: 40,
    fe_mg: 1,
    mg_mg: 22,
    k_mg: 200,
    na_mg: 120,
    zn_mg: 0.6,
    eaa_leu: 0.55,
    eaa_lys: 0.45,
    eaa_met: 0.18,
    eaa_phe: 0.35,
    eaa_thr: 0.3,
    eaa_trp: 0.08,
    eaa_ile: 0.32,
    eaa_val: 0.38,
    eaa_his: 0.2,
  }),
  milk_2pct: row({
    kcalPer100g: 52,
    proteinG: 3.3,
    carbsG: 4.9,
    fatG: 2,
    fiberG: 0,
    saturatedFatG: 1.2,
    monoFatG: 0.5,
    polyFatG: 0.1,
    omega3G: 0.03,
    vitA_mcg_RAE: 32,
    vitD_mcg: 1.1,
    vitB12_mcg: 0.45,
    riboflavinB2_mg: 0.17,
    ca_mg: 120,
    p_mg: 95,
    k_mg: 150,
    na_mg: 40,
    zn_mg: 0.4,
    eaa_leu: 0.27,
    eaa_lys: 0.22,
    eaa_met: 0.08,
    eaa_phe: 0.16,
    eaa_thr: 0.14,
    eaa_trp: 0.04,
    eaa_ile: 0.15,
    eaa_val: 0.18,
    eaa_his: 0.09,
  }),
  /** Latte di capra (stime educative / USDA-like, per 100 ml ≈ 100 g). */
  milk_goat: row({
    kcalPer100g: 69,
    proteinG: 3.6,
    carbsG: 4.5,
    fatG: 4.1,
    fiberG: 0,
    saturatedFatG: 2.7,
    monoFatG: 1,
    polyFatG: 0.15,
    omega3G: 0.04,
    vitA_mcg_RAE: 28,
    vitD_mcg: 0.6,
    vitB12_mcg: 0.05,
    riboflavinB2_mg: 0.14,
    ca_mg: 134,
    p_mg: 111,
    k_mg: 135,
    na_mg: 50,
    zn_mg: 0.34,
    eaa_leu: 0.29,
    eaa_lys: 0.24,
    eaa_met: 0.09,
    eaa_phe: 0.17,
    eaa_thr: 0.15,
    eaa_trp: 0.05,
    eaa_ile: 0.16,
    eaa_val: 0.19,
    eaa_his: 0.1,
  }),
  oat_dry: row({
    kcalPer100g: 389,
    proteinG: 13,
    carbsG: 66,
    fatG: 7,
    fiberG: 11,
    saturatedFatG: 1.2,
    monoFatG: 2.2,
    polyFatG: 2.5,
    omega3G: 0.45,
    folate_mcg: 32,
    mg_mg: 138,
    p_mg: 410,
    k_mg: 360,
    zn_mg: 3.6,
    fe_mg: 4,
    eaa_leu: 0.95,
    eaa_lys: 0.55,
    eaa_met: 0.25,
    eaa_phe: 0.7,
    eaa_thr: 0.45,
    eaa_trp: 0.18,
    eaa_ile: 0.5,
    eaa_val: 0.75,
    eaa_his: 0.35,
  }),
  yogurt_plain: row({
    kcalPer100g: 75,
    proteinG: 4.5,
    carbsG: 5.5,
    fatG: 3.5,
    saturatedFatG: 2.2,
    monoFatG: 0.9,
    polyFatG: 0.1,
    ca_mg: 120,
    p_mg: 110,
    k_mg: 160,
    zn_mg: 0.6,
    vitB12_mcg: 0.35,
    riboflavinB2_mg: 0.15,
    eaa_leu: 0.35,
    eaa_lys: 0.3,
    eaa_met: 0.12,
    eaa_phe: 0.2,
    eaa_thr: 0.18,
    eaa_trp: 0.05,
    eaa_ile: 0.22,
    eaa_val: 0.28,
    eaa_his: 0.11,
  }),
  banana: row({
    kcalPer100g: 89,
    proteinG: 1.1,
    carbsG: 23,
    fatG: 0.3,
    fiberG: 2.6,
    vitC_mg: 9,
    vitB6_mg: 0.4,
    folate_mcg: 20,
    k_mg: 360,
    mg_mg: 27,
    eaa_leu: 0.05,
    eaa_lys: 0.04,
    eaa_met: 0.01,
    eaa_phe: 0.04,
    eaa_thr: 0.03,
    eaa_trp: 0.01,
    eaa_ile: 0.03,
    eaa_val: 0.05,
    eaa_his: 0.04,
  }),
  mixed_fruit: row({
    kcalPer100g: 52,
    proteinG: 0.7,
    carbsG: 13,
    fatG: 0.2,
    fiberG: 2,
    vitC_mg: 35,
    folate_mcg: 18,
    k_mg: 200,
    eaa_leu: 0.03,
    eaa_lys: 0.03,
    eaa_met: 0.01,
    eaa_phe: 0.03,
    eaa_thr: 0.02,
    eaa_trp: 0.01,
    eaa_ile: 0.02,
    eaa_val: 0.03,
    eaa_his: 0.02,
  }),
  egg_whole: row({
    kcalPer100g: 143,
    proteinG: 13,
    carbsG: 1.1,
    fatG: 9.5,
    saturatedFatG: 3.2,
    monoFatG: 3.7,
    polyFatG: 1.4,
    omega3G: 0.08,
    vitA_mcg_RAE: 160,
    vitD_mcg: 2,
    vitB12_mcg: 1.1,
    folate_mcg: 47,
    se_mcg: 15,
    p_mg: 200,
    k_mg: 130,
    na_mg: 140,
    zn_mg: 1.3,
    eaa_leu: 0.95,
    eaa_lys: 0.75,
    eaa_met: 0.38,
    eaa_phe: 0.55,
    eaa_thr: 0.5,
    eaa_trp: 0.17,
    eaa_ile: 0.55,
    eaa_val: 0.7,
    eaa_his: 0.3,
  }),
  bread_white: row({
    kcalPer100g: 265,
    proteinG: 9,
    carbsG: 49,
    fatG: 3.2,
    fiberG: 2.7,
    saturatedFatG: 0.6,
    monoFatG: 0.5,
    polyFatG: 1.4,
    folate_mcg: 85,
    na_mg: 450,
    fe_mg: 3,
    eaa_leu: 0.6,
    eaa_lys: 0.25,
    eaa_met: 0.15,
    eaa_phe: 0.4,
    eaa_thr: 0.28,
    eaa_trp: 0.12,
    eaa_ile: 0.35,
    eaa_val: 0.42,
    eaa_his: 0.2,
  }),
  pasta_cooked: row({
    kcalPer100g: 131,
    proteinG: 5,
    carbsG: 25,
    fatG: 1.1,
    fiberG: 1.8,
    folate_mcg: 18,
    fe_mg: 0.5,
    mg_mg: 18,
    p_mg: 45,
    eaa_leu: 0.35,
    eaa_lys: 0.2,
    eaa_met: 0.1,
    eaa_phe: 0.28,
    eaa_thr: 0.2,
    eaa_trp: 0.08,
    eaa_ile: 0.22,
    eaa_val: 0.3,
    eaa_his: 0.14,
  }),
  rice_cooked: row({
    kcalPer100g: 130,
    proteinG: 2.7,
    carbsG: 28,
    fatG: 0.3,
    fiberG: 0.4,
    folate_mcg: 3,
    mg_mg: 12,
    p_mg: 43,
    k_mg: 35,
    na_mg: 1,
    eaa_leu: 0.18,
    eaa_lys: 0.1,
    eaa_met: 0.06,
    eaa_phe: 0.15,
    eaa_thr: 0.1,
    eaa_trp: 0.03,
    eaa_ile: 0.12,
    eaa_val: 0.18,
    eaa_his: 0.08,
  }),
  potato_cooked: row({
    kcalPer100g: 87,
    proteinG: 1.9,
    carbsG: 20,
    fatG: 0.1,
    fiberG: 1.8,
    vitC_mg: 13,
    vitB6_mg: 0.3,
    k_mg: 380,
    mg_mg: 23,
    p_mg: 44,
    folate_mcg: 10,
    eaa_leu: 0.1,
    eaa_lys: 0.1,
    eaa_met: 0.03,
    eaa_phe: 0.12,
    eaa_thr: 0.08,
    eaa_trp: 0.03,
    eaa_ile: 0.07,
    eaa_val: 0.12,
    eaa_his: 0.05,
  }),
  farro_cooked: row({
    kcalPer100g: 125,
    proteinG: 4.5,
    carbsG: 26,
    fatG: 1,
    fiberG: 3.5,
    mg_mg: 40,
    zn_mg: 1.2,
    fe_mg: 1,
    eaa_leu: 0.32,
    eaa_lys: 0.2,
    eaa_met: 0.1,
    eaa_phe: 0.25,
    eaa_thr: 0.18,
    eaa_trp: 0.07,
    eaa_ile: 0.2,
    eaa_val: 0.28,
    eaa_his: 0.12,
  }),
  pasta_dry: row({
    kcalPer100g: 371,
    proteinG: 13,
    carbsG: 75,
    fatG: 1.5,
    fiberG: 3.2,
    folate_mcg: 237,
    fe_mg: 3.3,
    mg_mg: 53,
    p_mg: 189,
    eaa_leu: 0.85,
    eaa_lys: 0.35,
    eaa_met: 0.22,
    eaa_phe: 0.58,
    eaa_thr: 0.42,
    eaa_trp: 0.16,
    eaa_ile: 0.52,
    eaa_val: 0.58,
    eaa_his: 0.28,
  }),
  rice_dry: row({
    kcalPer100g: 365,
    proteinG: 7.1,
    carbsG: 80,
    fatG: 0.7,
    fiberG: 1.3,
    folate_mcg: 8,
    mg_mg: 25,
    p_mg: 115,
    k_mg: 115,
    na_mg: 5,
    eaa_leu: 0.55,
    eaa_lys: 0.28,
    eaa_met: 0.18,
    eaa_phe: 0.38,
    eaa_thr: 0.26,
    eaa_trp: 0.1,
    eaa_ile: 0.32,
    eaa_val: 0.48,
    eaa_his: 0.22,
  }),
  farro_dry: row({
    kcalPer100g: 338,
    proteinG: 14,
    carbsG: 70,
    fatG: 2.2,
    fiberG: 10,
    mg_mg: 60,
    zn_mg: 2.5,
    fe_mg: 2.5,
    eaa_leu: 0.95,
    eaa_lys: 0.42,
    eaa_met: 0.28,
    eaa_phe: 0.58,
    eaa_thr: 0.38,
    eaa_trp: 0.14,
    eaa_ile: 0.48,
    eaa_val: 0.62,
    eaa_his: 0.3,
  }),
  chicken_breast: row({
    kcalPer100g: 165,
    proteinG: 31,
    fatG: 3.6,
    saturatedFatG: 1,
    monoFatG: 1.2,
    polyFatG: 0.8,
    vitB6_mg: 0.6,
    niacinB3_mg: 14,
    vitB12_mcg: 0.3,
    p_mg: 240,
    k_mg: 256,
    zn_mg: 1,
    se_mcg: 22,
    eaa_leu: 2.1,
    eaa_lys: 1.9,
    eaa_met: 0.65,
    eaa_phe: 1,
    eaa_thr: 1.1,
    eaa_trp: 0.3,
    eaa_ile: 1.2,
    eaa_val: 1.25,
    eaa_his: 0.75,
  }),
  fish_white: row({
    kcalPer100g: 140,
    proteinG: 24,
    fatG: 4,
    saturatedFatG: 0.8,
    monoFatG: 1.4,
    polyFatG: 1.2,
    omega3G: 0.6,
    vitD_mcg: 4,
    vitB12_mcg: 2.5,
    se_mcg: 36,
    p_mg: 220,
    k_mg: 320,
    na_mg: 60,
    zn_mg: 0.5,
    eaa_leu: 1.8,
    eaa_lys: 1.7,
    eaa_met: 0.65,
    eaa_phe: 0.85,
    eaa_thr: 0.95,
    eaa_trp: 0.25,
    eaa_ile: 1,
    eaa_val: 1.1,
    eaa_his: 0.55,
  }),
  beef_lean: row({
    kcalPer100g: 180,
    proteinG: 26,
    fatG: 8,
    saturatedFatG: 3.2,
    monoFatG: 3.4,
    polyFatG: 0.4,
    vitB12_mcg: 2.4,
    zn_mg: 5,
    fe_mg: 2.4,
    p_mg: 200,
    k_mg: 315,
    se_mcg: 20,
    eaa_leu: 1.9,
    eaa_lys: 1.8,
    eaa_met: 0.55,
    eaa_phe: 0.9,
    eaa_thr: 1,
    eaa_trp: 0.25,
    eaa_ile: 1.05,
    eaa_val: 1.15,
    eaa_his: 0.7,
  }),
  legumes_cooked: row({
    kcalPer100g: 120,
    proteinG: 8,
    carbsG: 20,
    fatG: 0.5,
    fiberG: 7,
    saturatedFatG: 0.1,
    monoFatG: 0.1,
    polyFatG: 0.25,
    folate_mcg: 120,
    fe_mg: 2.5,
    mg_mg: 45,
    k_mg: 280,
    zn_mg: 1.5,
    p_mg: 140,
    eaa_leu: 0.55,
    eaa_lys: 0.5,
    eaa_met: 0.12,
    eaa_phe: 0.45,
    eaa_thr: 0.35,
    eaa_trp: 0.1,
    eaa_ile: 0.38,
    eaa_val: 0.45,
    eaa_his: 0.28,
  }),
  mixed_veg: row({
    kcalPer100g: 35,
    proteinG: 2,
    carbsG: 6,
    fatG: 0.3,
    fiberG: 2.5,
    vitA_mcg_RAE: 180,
    vitC_mg: 28,
    vitK_mcg: 180,
    folate_mcg: 60,
    k_mg: 300,
    mg_mg: 25,
    fe_mg: 1.2,
    eaa_leu: 0.12,
    eaa_lys: 0.12,
    eaa_met: 0.03,
    eaa_phe: 0.1,
    eaa_thr: 0.08,
    eaa_trp: 0.02,
    eaa_ile: 0.08,
    eaa_val: 0.12,
    eaa_his: 0.05,
  }),
  olive_oil: row({
    kcalPer100g: 884,
    proteinG: 0,
    carbsG: 0,
    fatG: 100,
    saturatedFatG: 14,
    monoFatG: 73,
    polyFatG: 11,
    omega3G: 0.76,
    vitE_mg: 14,
    vitK_mcg: 60,
    eaa_leu: 0,
    eaa_lys: 0,
    eaa_met: 0,
    eaa_phe: 0,
    eaa_thr: 0,
    eaa_trp: 0,
    eaa_ile: 0,
    eaa_val: 0,
    eaa_his: 0,
  }),
  cheese_hard: row({
    kcalPer100g: 400,
    proteinG: 32,
    fatG: 30,
    saturatedFatG: 18,
    monoFatG: 8,
    polyFatG: 1,
    ca_mg: 700,
    vitA_mcg_RAE: 250,
    vitB12_mcg: 1.4,
    zn_mg: 3.5,
    p_mg: 550,
    na_mg: 650,
    se_mcg: 15,
    eaa_leu: 2.4,
    eaa_lys: 2,
    eaa_met: 0.75,
    eaa_phe: 1.35,
    eaa_thr: 1.1,
    eaa_trp: 0.45,
    eaa_ile: 1.3,
    eaa_val: 1.65,
    eaa_his: 0.85,
  }),
  avocado: row({
    kcalPer100g: 160,
    proteinG: 2,
    carbsG: 9,
    fatG: 15,
    fiberG: 7,
    saturatedFatG: 2.1,
    monoFatG: 10,
    polyFatG: 1.8,
    omega3G: 0.11,
    vitK_mcg: 21,
    folate_mcg: 81,
    k_mg: 485,
    mg_mg: 29,
    vitE_mg: 2,
    eaa_leu: 0.12,
    eaa_lys: 0.12,
    eaa_met: 0.04,
    eaa_phe: 0.12,
    eaa_thr: 0.08,
    eaa_trp: 0.03,
    eaa_ile: 0.08,
    eaa_val: 0.12,
    eaa_his: 0.05,
  }),
  crackers_whole: row({
    kcalPer100g: 416,
    proteinG: 10,
    carbsG: 69,
    fatG: 10,
    fiberG: 8,
    saturatedFatG: 2,
    monoFatG: 3,
    polyFatG: 4,
    na_mg: 600,
    fe_mg: 2.5,
    mg_mg: 70,
    folate_mcg: 40,
    eaa_leu: 0.65,
    eaa_lys: 0.3,
    eaa_met: 0.2,
    eaa_phe: 0.45,
    eaa_thr: 0.32,
    eaa_trp: 0.14,
    eaa_ile: 0.38,
    eaa_val: 0.48,
    eaa_his: 0.24,
  }),
  deli_lean: row({
    kcalPer100g: 120,
    proteinG: 20,
    fatG: 4,
    saturatedFatG: 1.4,
    monoFatG: 1.6,
    polyFatG: 0.6,
    na_mg: 900,
    vitB12_mcg: 0.5,
    zn_mg: 1.5,
    p_mg: 200,
    se_mcg: 12,
    eaa_leu: 1.4,
    eaa_lys: 1.35,
    eaa_met: 0.45,
    eaa_phe: 0.75,
    eaa_thr: 0.8,
    eaa_trp: 0.2,
    eaa_ile: 0.85,
    eaa_val: 0.9,
    eaa_his: 0.5,
  }),
  whey_powder: row({
    kcalPer100g: 400,
    proteinG: 80,
    carbsG: 6,
    fatG: 5,
    fiberG: 0,
    saturatedFatG: 2.5,
    monoFatG: 1,
    polyFatG: 0.5,
    ca_mg: 400,
    p_mg: 300,
    k_mg: 500,
    zn_mg: 2,
    vitB12_mcg: 1,
    eaa_leu: 6.5,
    eaa_lys: 5.5,
    eaa_met: 1.6,
    eaa_phe: 1.8,
    eaa_thr: 4.2,
    eaa_trp: 1.2,
    eaa_ile: 3.8,
    eaa_val: 3.5,
    eaa_his: 1.2,
  }),
  omega_capsule: row({
    kcalPer100g: 900,
    proteinG: 0,
    carbsG: 0,
    fatG: 100,
    saturatedFatG: 10,
    monoFatG: 30,
    polyFatG: 55,
    omega3G: 30,
    vitE_mg: 10,
    vitA_mcg_RAE: 300,
    eaa_leu: 0,
    eaa_lys: 0,
    eaa_met: 0,
    eaa_phe: 0,
    eaa_thr: 0,
    eaa_trp: 0,
    eaa_ile: 0,
    eaa_val: 0,
    eaa_his: 0,
  }),
};

const INFER_RULES: Array<{ test: RegExp; key: string }> = [
  { test: /omega|epa|dha|capsula/i, key: "omega_capsule" },
  { test: /whey|proteina in polvere|protein powder/i, key: "whey_powder" },
  { test: /olio|evo|olive oil/i, key: "olive_oil" },
  { test: /grana|parmigiano|formaggio/i, key: "cheese_hard" },
  { test: /avocado/i, key: "avocado" },
  { test: /gallette|cracker/i, key: "crackers_whole" },
  { test: /bresaola|prosciutto|affettato|mortadella|salame/i, key: "deli_lean" },
  { test: /latte di capra|latte caprina|goat milk|latte\s+di\s+capra/i, key: "milk_goat" },
  { test: /latte\b|milk/i, key: "milk_2pct" },
  { test: /yogurt|yoghurt|kefir/i, key: "yogurt_plain" },
  { test: /cereal|muesli|avena|fiocchi/i, key: "oat_dry" },
  { test: /banana/i, key: "banana" },
  { test: /uov|egg/i, key: "egg_whole" },
  { test: /pane|focaccia|bread|toast/i, key: "bread_white" },
  {
    test: /(pasta|spaghetti|penne|tagliatelle).*(cotto|cottura|peso\s*cotto|già\s*cotta|cooked)/i,
    key: "pasta_cooked",
  },
  { test: /pasta|spaghetti|penne|tagliatelle/i, key: "pasta_dry" },
  {
    test: /(riso|rice|basmati|jasmine).*(cotto|cottura|peso\s*cotto|già\s*cotto|cooked)/i,
    key: "rice_cooked",
  },
  { test: /riso|rice|basmati|jasmine/i, key: "rice_dry" },
  { test: /patat|potato/i, key: "potato_cooked" },
  {
    test: /(farro|orzo|grano).*(cotto|cottura|peso\s*cotto|già\s*cotto|cooked)/i,
    key: "farro_cooked",
  },
  { test: /farro|orzo/i, key: "farro_dry" },
  { test: /pollo|chicken|tacchino|turkey|petto|fesa/i, key: "chicken_breast" },
  { test: /pesce|salmone|merluzz|tonno|fish|tuna|salmon|orata|branzino|spigola|nasello|sogliola|trota|sgombro|sardina|gamber|polpo|calamar/i, key: "fish_white" },
  { test: /manzo|beef|maiale|pork|agnello|lamb|carne|vitello|bovino|hamburger|filetto|bistecca/i, key: "beef_lean" },
  { test: /legum|lenticch|ceci|fagiol|pisell/i, key: "legumes_cooked" },
  { test: /verdur|insalat|broccoli|zucchin|peperon/i, key: "mixed_veg" },
  { test: /frutta|frutti di bosco|mela|arancia|kiwi|berry/i, key: "mixed_fruit" },
];

export function inferCanonicalFoodKey(label: string): string {
  const t = label.trim();
  for (const r of INFER_RULES) {
    if (r.test.test(t)) return r.key;
  }
  return "generic_mixed";
}

export function scaleCanonicalNutrientsToKcal(row: CanonicalFoodNutrients, targetKcal: number): ScaledMealItemNutrients {
  const k = Math.max(15, Math.round(targetKcal));
  const dens = row.kcalPer100g / 100;
  const factor = dens > 0 ? k / dens : 0;
  const f = factor / 100;
  const num = (v: number) => Math.round(v * f * 1000) / 1000;
  const numMicro = (v: number) => Math.round(v * f * 10) / 10;
  return {
    kcal: k,
    proteinG: num(row.proteinG),
    carbsG: num(row.carbsG),
    fatG: num(row.fatG),
    fiberG: num(row.fiberG),
    saturatedFatG: num(row.saturatedFatG),
    monoFatG: num(row.monoFatG),
    polyFatG: num(row.polyFatG),
    omega3G: num(row.omega3G),
    vitA_mcg_RAE: numMicro(row.vitA_mcg_RAE),
    vitC_mg: numMicro(row.vitC_mg),
    vitD_mcg: numMicro(row.vitD_mcg),
    vitE_mg: numMicro(row.vitE_mg),
    vitK_mcg: numMicro(row.vitK_mcg),
    thiamineB1_mg: numMicro(row.thiamineB1_mg),
    riboflavinB2_mg: numMicro(row.riboflavinB2_mg),
    niacinB3_mg: numMicro(row.niacinB3_mg),
    vitB6_mg: numMicro(row.vitB6_mg),
    folate_mcg: numMicro(row.folate_mcg),
    vitB12_mcg: numMicro(row.vitB12_mcg),
    ca_mg: numMicro(row.ca_mg),
    fe_mg: numMicro(row.fe_mg),
    mg_mg: numMicro(row.mg_mg),
    p_mg: numMicro(row.p_mg),
    k_mg: numMicro(row.k_mg),
    na_mg: numMicro(row.na_mg),
    zn_mg: numMicro(row.zn_mg),
    se_mcg: numMicro(row.se_mcg),
    eaa_leu: num(row.eaa_leu),
    eaa_lys: num(row.eaa_lys),
    eaa_met: num(row.eaa_met),
    eaa_phe: num(row.eaa_phe),
    eaa_thr: num(row.eaa_thr),
    eaa_trp: num(row.eaa_trp),
    eaa_ile: num(row.eaa_ile),
    eaa_val: num(row.eaa_val),
    eaa_his: num(row.eaa_his),
  };
}

/** Massa edibile da porzione testuale quando è esplicita (g o ml con densità nota per olio). */
const OLIVE_OIL_G_PER_ML = 0.92;

function parseExplicitGramsFromPortionHint(hint: string): number | undefined {
  const m = hint.match(/(\d+(?:[.,]\d+)?)\s*g(?:rammi?)?\b/i);
  if (!m) return undefined;
  const v = parseFloat(m[1].replace(",", "."));
  if (!Number.isFinite(v) || v <= 0) return undefined;
  return v;
}

function parseMlFromPortionHint(hint: string): number | undefined {
  const m = hint.match(/(\d+(?:[.,]\d+)?)\s*ml\b/i);
  if (!m) return undefined;
  const v = parseFloat(m[1].replace(",", "."));
  if (!Number.isFinite(v) || v <= 0) return undefined;
  return v;
}

function resolveServingGramsFromPortionHint(portionHint: string, compositionKey: string): number | undefined {
  const hint = portionHint.trim();
  if (!hint) return undefined;
  const g = parseExplicitGramsFromPortionHint(hint);
  if (g != null) return g;
  const ml = parseMlFromPortionHint(hint);
  if (ml == null) return undefined;
  if (compositionKey === "olive_oil") return ml * OLIVE_OIL_G_PER_ML;
  return undefined;
}

/** Scala il profilo per 100 g su una massa edibile nota (g). */
export function scaleCanonicalNutrientsToGrams(row: CanonicalFoodNutrients, gramsEdible: number): ScaledMealItemNutrients {
  const g = Math.max(0.1, gramsEdible);
  const f = g / 100;
  const num = (v: number) => Math.round(v * f * 1000) / 1000;
  const numMicro = (v: number) => Math.round(v * f * 10) / 10;
  const kcal = Math.max(1, Math.round(row.kcalPer100g * f));
  return {
    kcal,
    proteinG: num(row.proteinG),
    carbsG: num(row.carbsG),
    fatG: num(row.fatG),
    fiberG: num(row.fiberG),
    saturatedFatG: num(row.saturatedFatG),
    monoFatG: num(row.monoFatG),
    polyFatG: num(row.polyFatG),
    omega3G: num(row.omega3G),
    vitA_mcg_RAE: numMicro(row.vitA_mcg_RAE),
    vitC_mg: numMicro(row.vitC_mg),
    vitD_mcg: numMicro(row.vitD_mcg),
    vitE_mg: numMicro(row.vitE_mg),
    vitK_mcg: numMicro(row.vitK_mcg),
    thiamineB1_mg: numMicro(row.thiamineB1_mg),
    riboflavinB2_mg: numMicro(row.riboflavinB2_mg),
    niacinB3_mg: numMicro(row.niacinB3_mg),
    vitB6_mg: numMicro(row.vitB6_mg),
    folate_mcg: numMicro(row.folate_mcg),
    vitB12_mcg: numMicro(row.vitB12_mcg),
    ca_mg: numMicro(row.ca_mg),
    fe_mg: numMicro(row.fe_mg),
    mg_mg: numMicro(row.mg_mg),
    p_mg: numMicro(row.p_mg),
    k_mg: numMicro(row.k_mg),
    na_mg: numMicro(row.na_mg),
    zn_mg: numMicro(row.zn_mg),
    se_mcg: numMicro(row.se_mcg),
    eaa_leu: num(row.eaa_leu),
    eaa_lys: num(row.eaa_lys),
    eaa_met: num(row.eaa_met),
    eaa_phe: num(row.eaa_phe),
    eaa_thr: num(row.eaa_thr),
    eaa_trp: num(row.eaa_trp),
    eaa_ile: num(row.eaa_ile),
    eaa_val: num(row.eaa_val),
    eaa_his: num(row.eaa_his),
  };
}

export function nutrientsForMealPlanItem(item: { name: string; portionHint: string; approxKcal: number }): {
  compositionKey: string;
  compositionStatus: "canonical_estimate" | "unresolved";
  nutrients: ScaledMealItemNutrients;
} {
  const hay = `${item.name} ${item.portionHint}`;
  const compositionKey = inferCanonicalFoodKey(hay);
  const row = CANONICAL_FOOD_TABLE[compositionKey];
  if (!row || compositionKey === "generic_mixed") {
    return { compositionKey: "unresolved", compositionStatus: "unresolved", nutrients: { ...ZERO_SCALED } };
  }
  const hintForServing = `${item.portionHint} ${item.name}`.trim();
  const gramsFromHint = resolveServingGramsFromPortionHint(hintForServing, compositionKey);
  const nutrients =
    gramsFromHint != null
      ? scaleCanonicalNutrientsToGrams(row, gramsFromHint)
      : scaleCanonicalNutrientsToKcal(row, item.approxKcal);
  return { compositionKey, compositionStatus: "canonical_estimate", nutrients };
}

function addScaled(a: ScaledMealItemNutrients, b: ScaledMealItemNutrients): ScaledMealItemNutrients {
  const keys = Object.keys(a) as (keyof ScaledMealItemNutrients)[];
  const out = { ...a };
  for (const k of keys) {
    out[k] = Math.round((a[k] + b[k]) * 1000) / 1000;
  }
  return out;
}

const ZERO_SCALED: ScaledMealItemNutrients = {
  kcal: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  fiberG: 0,
  saturatedFatG: 0,
  monoFatG: 0,
  polyFatG: 0,
  omega3G: 0,
  vitA_mcg_RAE: 0,
  vitC_mg: 0,
  vitD_mcg: 0,
  vitE_mg: 0,
  vitK_mcg: 0,
  thiamineB1_mg: 0,
  riboflavinB2_mg: 0,
  niacinB3_mg: 0,
  vitB6_mg: 0,
  folate_mcg: 0,
  vitB12_mcg: 0,
  ca_mg: 0,
  fe_mg: 0,
  mg_mg: 0,
  p_mg: 0,
  k_mg: 0,
  na_mg: 0,
  zn_mg: 0,
  se_mcg: 0,
  eaa_leu: 0,
  eaa_lys: 0,
  eaa_met: 0,
  eaa_phe: 0,
  eaa_thr: 0,
  eaa_trp: 0,
  eaa_ile: 0,
  eaa_val: 0,
  eaa_his: 0,
};

export function sumScaledNutrients(rows: ScaledMealItemNutrients[]): ScaledMealItemNutrients {
  return rows.reduce((acc, r) => addScaled(acc, r), { ...ZERO_SCALED });
}
