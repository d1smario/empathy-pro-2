import assert from "node:assert/strict";
import test from "node:test";
import {
  getSupplementCategoryLabel,
  normalizeSupplementCategoryId,
  normalizeSupplementToken,
  normalizeSupplementTokensCsv,
} from "./supplement-category-catalog";

test("normalizeSupplementCategoryId: legacy → canonico", () => {
  assert.equal(normalizeSupplementCategoryId("aminoacidi"), "amino");
  assert.equal(normalizeSupplementCategoryId("Ergogenici"), "ergo");
  assert.equal(normalizeSupplementCategoryId("micronutrienti"), "micro");
});

test("getSupplementCategoryLabel: etichette tab corte", () => {
  assert.equal(getSupplementCategoryLabel("amino"), "Aminosangue");
  assert.equal(getSupplementCategoryLabel("aminoacidi"), "Aminosangue");
  assert.equal(getSupplementCategoryLabel("ergo"), "Ergo");
  assert.equal(getSupplementCategoryLabel("ergogenici"), "Ergo");
  assert.equal(getSupplementCategoryLabel("micro"), "Micro");
  assert.equal(getSupplementCategoryLabel("micronutrienti"), "Micro");
});

test("normalizeSupplementTokensCsv: migra prefissi legacy", () => {
  assert.equal(
    normalizeSupplementTokensCsv("aminoacidi:BCAA, ergogenici:Creatina, micro:Ferro"),
    "amino:BCAA, ergo:Creatina, micro:Ferro",
  );
});

test("normalizeSupplementToken: singolo token", () => {
  assert.equal(normalizeSupplementToken("micronutrienti:Vitamina D"), "micro:Vitamina D");
});
