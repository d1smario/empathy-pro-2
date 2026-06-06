# Nutrition Meal Plan V2 — architettura produzione

## Pipeline

1. **Prep** — `intelligent-meal-plan-route-prep.ts` (Diet, routine, gara, filtri profilo)
2. **Compute** — `nutrition-day-model-v2.ts` (fabbisogno, substrati, fueling)
3. **Compose** — `compose-meal-plan-v2.ts` (staple registry → solver grammi)
4. **Enrich** — `enrich-meal-slots-after-compose.ts` (pathway, integrazione, boostNote)
5. **Finalize** — `meal-plan-response-finalize.ts` (nutrienti USDA + rollup)

## Motore

- Env: `NUTRITION_MEAL_PLAN_ENGINE=v1|v2|shadow`
- Vercel default: **shadow** (serve V1, log diff V2) fino a cutover QA
- Cutover: `NUTRITION_MEAL_PLAN_ENGINE=v2`

## Staple registry

- File: `apps/web/lib/nutrition/v2/fdc-staple-registry.ts`
- Allowlist per ruolo (`lunch_carb`, `dinner_pro`, …) allineata al composer Mediterranean V1
- Pool FDC taggati = **fallback** solo se allowlist esaurita

## QA

- `npm run test --workspace=@empathy/web -- fdc-staple-registry`
- `node apps/web/scripts/diag-meal-plan-parity.mjs <athleteId> [date]` (con dev server + auth)
