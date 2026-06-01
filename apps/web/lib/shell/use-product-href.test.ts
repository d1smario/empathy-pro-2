import { test } from "node:test";
import assert from "node:assert/strict";
import { productHrefForPathname } from "@/lib/shell/use-product-href";

test("productHrefForPathname: mobile shell maps session path", () => {
  assert.equal(
    productHrefForPathname("/training/session/2026-06-03", "/m/training/calendar"),
    "/m/training/session/2026-06-03",
  );
});

test("productHrefForPathname: desktop shell keeps path", () => {
  assert.equal(
    productHrefForPathname("/training/session/2026-06-03", "/training/calendar"),
    "/training/session/2026-06-03",
  );
});

test("productHrefForPathname: builder unchanged on mobile", () => {
  assert.equal(
    productHrefForPathname("/training/builder", "/m/training/calendar"),
    "/training/builder",
  );
});
