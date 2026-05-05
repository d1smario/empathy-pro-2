import test from "node:test";
import assert from "node:assert/strict";
import { normalizeLoosePdfText } from "@/lib/health/lab-pdf-text-normalize";

test("normalizeLoosePdfText inserts space before glued percentages", () => {
  const raw = "Clinical Bacteroidetes45%Firmicutes40%Shannon3.8";
  const out = normalizeLoosePdfText(raw);
  assert.ok(out.includes("Bacteroidetes 45"));
  assert.ok(out.includes("Firmicutes 40"));
  assert.ok(out.includes("Shannon 3"));
});
