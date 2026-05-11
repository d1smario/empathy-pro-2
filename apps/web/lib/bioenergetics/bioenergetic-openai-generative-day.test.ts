import assert from "node:assert/strict";
import { test } from "node:test";
import { buildMetricTilesFromGenerativeMap, BIOENERGETIC_GENERATIVE_TILE_PANEL } from "@/lib/bioenergetics/bioenergetic-openai-generative-day";

test("buildMetricTilesFromGenerativeMap copre tutti gli id del pannello", () => {
  const m = new Map<string, number>([
    ["gaba", 0.55],
    ["cortisol", 12],
  ]);
  const tiles = buildMetricTilesFromGenerativeMap(m);
  assert.equal(tiles.length, BIOENERGETIC_GENERATIVE_TILE_PANEL.length);
  const gaba = tiles.find((t) => t.id === "gaba");
  assert.ok(gaba);
  assert.equal(gaba!.provenance, "estimated");
  const missing = tiles.find((t) => t.id === "tsh");
  assert.ok(missing);
  assert.equal(missing!.provenance, "absent");
});
