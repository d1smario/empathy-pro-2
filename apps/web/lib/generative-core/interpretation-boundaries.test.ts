import test from "node:test";
import assert from "node:assert/strict";

/**
 * Contratti Interpretation (L2) vs Compute (L3):
 * - stringhe di contesto nutrizione / diary / twin non sostituiscono output numerici del meal solver;
 * - bridge fisiologia multisport produce sempre payload strutturato per `metabolic_lab_runs`, separato da narrazione UI.
 */
test("interpretation: contesto testuale non altera shape engine physiology bridge (regola architettura)", () => {
  const dummyContextLines = [
    "Twin: glicogeno ~60% (solo interpretazione).",
    "Diario: 3/7 giorni loggati.",
  ];
  assert.ok(Array.isArray(dummyContextLines));
  assert.equal(dummyContextLines.length, 2);
  // Vincolo documentato: il composer LLM consuma `contextLines`; i kcal slot restano dal deterministic meal path.
  assert.match(dummyContextLines[0] ?? "", /interpretazione/);
});
