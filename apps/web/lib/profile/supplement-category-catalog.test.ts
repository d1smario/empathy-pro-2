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

test("getSupplementCategoryLabel: etichette tab profilo", () => {
  assert.equal(getSupplementCategoryLabel("amino"), "Aminoacidi");
  assert.equal(getSupplementCategoryLabel("aminoacidi"), "Aminoacidi");
  assert.equal(getSupplementCategoryLabel("aminosangue"), "Aminoacidi");
  assert.equal(getSupplementCategoryLabel("ergo"), "Ergogenici");
  assert.equal(getSupplementCategoryLabel("ergogenici"), "Ergogenici");
  assert.equal(getSupplementCategoryLabel("micro"), "Micronutrienti");
  assert.equal(getSupplementCategoryLabel("micronutrienti"), "Micronutrienti");
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
