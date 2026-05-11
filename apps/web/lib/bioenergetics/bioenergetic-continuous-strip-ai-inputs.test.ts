import assert from "node:assert/strict";
import { test } from "node:test";
import type { BioenergeticsDayViewModel } from "@/api/bioenergetics/contracts";
import {
  buildMonitoringChannelsFromStripAiParse,
  expandHourly24ToFiveMinuteStream,
  interpolateFifteenMinuteSeriesToFiveMinuteStream,
  parseStripAiOpenAiContent,
} from "@/lib/bioenergetics/bioenergetic-continuous-strip-ai-inputs";

test("interpolateFifteenMinuteSeriesToFiveMinuteStream produce 288 campioni", () => {
  const v96 = Array.from({ length: 96 }, (_, i) => 5 + (i % 10) * 0.01);
  const st = interpolateFifteenMinuteSeriesToFiveMinuteStream("2026-05-09", v96, 3, 14);
  assert.equal(st.length, 288);
  assert.ok(st[0]!.observedAt.includes("2026-05-09"));
});

test("expandHourly24ToFiveMinuteStream produce 288 campioni", () => {
  const h24 = Array.from({ length: 24 }, (_, i) => 10 + i * 0.1);
  const st = expandHourly24ToFiveMinuteStream("2026-05-09", h24, 0, 100);
  assert.equal(st.length, 288);
});

test("parseStripAiOpenAiContent legge JSON OpenAI", () => {
  const raw = JSON.stringify({
    disclaimer_it: "Solo illustrazione.",
    glucose_mmol_15m: Array(96).fill(5.5),
    lactate_mmol_15m: Array(96).fill(1.2),
    cortisol_ug_dl_24: Array(24).fill(12),
    acth_pg_ml_24: Array(24).fill(25),
    insulin_proxy_score_24: Array(24).fill(40),
  });
  const p = parseStripAiOpenAiContent(raw);
  assert.ok(p);
  assert.equal(p!.glucose96?.length, 96);
  assert.equal(p!.lactate96?.length, 96);
});

test("buildMonitoringChannelsFromStripAiParse costruisce canali ai_from_inputs", () => {
  const vm = {
    date: "2026-05-09",
  } as BioenergeticsDayViewModel;
  const parsed = parseStripAiOpenAiContent(
    JSON.stringify({
      disclaimer_it: "D",
      glucose_mmol_15m: Array(96).fill(6),
      lactate_mmol_15m: Array(96).fill(1.5),
      cortisol_ug_dl_24: Array(24).fill(10),
      acth_pg_ml_24: Array(24).fill(20),
      insulin_proxy_score_24: Array(24).fill(30),
    }),
  )!;
  const ch = buildMonitoringChannelsFromStripAiParse(vm, parsed);
  assert.ok(ch.length >= 5);
  for (const c of ch) {
    assert.equal(c.dataPlane, "ai_from_inputs");
  }
});
