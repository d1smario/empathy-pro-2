import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  coerceLocale,
  isKnownLocale,
  parseAcceptLanguageToLocale,
} from "./supported-locales";

test("isKnownLocale: positivi", () => {
  for (const tag of ["it", "en", "fr", "es", "de", "ar", "zh"]) {
    assert.equal(isKnownLocale(tag), true, tag);
  }
});

test("isKnownLocale: negativi (esempi)", () => {
  for (const tag of ["", "xx", "EN", "it-IT", null, undefined, 42, {}]) {
    assert.equal(isKnownLocale(tag as unknown), false, `${String(tag)}`);
  }
});

test("coerceLocale: input vuoto → DEFAULT_LOCALE", () => {
  assert.equal(coerceLocale(null), DEFAULT_LOCALE);
  assert.equal(coerceLocale(""), DEFAULT_LOCALE);
  assert.equal(coerceLocale(undefined), DEFAULT_LOCALE);
});

test("coerceLocale: input case/region-agnostic", () => {
  assert.equal(coerceLocale("EN"), "en");
  assert.equal(coerceLocale("en-US"), "en");
  assert.equal(coerceLocale("it_IT"), "it");
  assert.equal(coerceLocale("de-AT"), "de");
});

test("coerceLocale: input sconosciuto → fallback esplicito", () => {
  assert.equal(coerceLocale("xx"), DEFAULT_LOCALE);
  assert.equal(coerceLocale("xx", FALLBACK_LOCALE), FALLBACK_LOCALE);
});

test("parseAcceptLanguageToLocale: ordina per q-value", () => {
  const r = parseAcceptLanguageToLocale("de;q=0.5,en;q=0.8,it;q=0.3", ["it", "en"]);
  assert.equal(r, "en");
});

test("parseAcceptLanguageToLocale: privilegia tag esatto, fallback su primario", () => {
  const r = parseAcceptLanguageToLocale("it-IT,it;q=0.9,en;q=0.5", ["it", "en"]);
  assert.equal(r, "it");
});

test("parseAcceptLanguageToLocale: salta locale non enabled", () => {
  const r = parseAcceptLanguageToLocale("de-DE,de;q=0.9,en;q=0.5", ["it", "en"]);
  assert.equal(r, "en");
});

test("parseAcceptLanguageToLocale: nessun match → null", () => {
  assert.equal(parseAcceptLanguageToLocale("xx;q=0.9,yy;q=0.5", ["it", "en"]), null);
});

test("parseAcceptLanguageToLocale: header vuoto/null → null", () => {
  assert.equal(parseAcceptLanguageToLocale(null, ["it", "en"]), null);
  assert.equal(parseAcceptLanguageToLocale("", ["it", "en"]), null);
});

test("parseAcceptLanguageToLocale: q=0 ignorato", () => {
  const r = parseAcceptLanguageToLocale("it;q=0,en;q=0.5", ["it", "en"]);
  assert.equal(r, "en");
});
