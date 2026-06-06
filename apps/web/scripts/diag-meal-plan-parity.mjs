/**
 * Confronto V1 vs V2 meal plan per atleta/giorno (richiede dev server o import diretto).
 * Usage:
 *   node apps/web/scripts/diag-meal-plan-parity.mjs <athleteId> [planDate]
 *   MEAL_PLAN_BASE=http://localhost:3020 node apps/web/scripts/diag-meal-plan-parity.mjs ...
 */
const athleteId = process.argv[2];
const planDate = process.argv[3] ?? new Date().toISOString().slice(0, 10);
const base = (process.env.MEAL_PLAN_BASE ?? "http://localhost:3020").replace(/\/$/, "");

if (!athleteId) {
  console.error("Usage: node apps/web/scripts/diag-meal-plan-parity.mjs <athleteId> [planDate]");
  process.exit(1);
}

const JUNK_RE =
  /\b(beverage|snacks|butter replacement|babyfood|walrus|corn dog|potato chips|granola bar)\b/i;

async function fetchPlan(engine) {
  const prev = process.env.NUTRITION_MEAL_PLAN_ENGINE;
  process.env.NUTRITION_MEAL_PLAN_ENGINE = engine;
  const res = await fetch(`${base}/api/nutrition/intelligent-meal-plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: process.env.DIAG_COOKIE ?? "" },
    body: JSON.stringify({
      athleteId,
      plan: { planDate, slots: [] },
      _diagEngine: engine,
    }),
  });
  if (prev === undefined) delete process.env.NUTRITION_MEAL_PLAN_ENGINE;
  else process.env.NUTRITION_MEAL_PLAN_ENGINE = prev;
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) };
  } catch {
    return { status: res.status, body: { error: text.slice(0, 400) } };
  }
}

function summarize(body) {
  if (!body?.slots) return { error: body?.error ?? "no slots" };
  let kcal = 0;
  const names = [];
  const junk = [];
  for (const slot of body.slots) {
    for (const it of slot.items ?? []) {
      kcal += Number(it.approxKcal) || Number(it.nutrients?.kcal) || 0;
      const n = `${it.name}`.trim();
      names.push(`${slot.slot}:${n}`);
      if (JUNK_RE.test(n)) junk.push(n);
    }
  }
  return {
    slotCount: body.slots.length,
    itemCount: names.length,
    approxKcal: Math.round(kcal),
    junk,
    names: names.slice(0, 24),
    solverDaily: body.solverBasis?.dailyMealsKcalTotal ?? null,
  };
}

console.log("=== Meal plan parity ===");
console.log("athlete:", athleteId);
console.log("date:", planDate);
console.log("base:", base);
console.log("(Nota: richiede sessione auth valida via DIAG_COOKIE o dev bypass)");

for (const engine of ["v1", "v2"]) {
  const { status, body } = await fetchPlan(engine);
  const s = summarize(body);
  console.log(`\n--- ${engine.toUpperCase()} (HTTP ${status}) ---`);
  console.log(JSON.stringify(s, null, 2));
}
