import assert from "node:assert/strict";
import test from "node:test";
import { isMobilePreferred, isMobileUserAgent } from "./mobile-detect";

test("isMobileUserAgent: iPhone", () => {
  assert.equal(
    isMobileUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"),
    true,
  );
});

test("isMobileUserAgent: iPad esplicito", () => {
  assert.equal(isMobileUserAgent("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)"), true);
});

test("isMobileUserAgent: iPadOS Macintosh + Mobile", () => {
  assert.equal(
    isMobileUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    ),
    true,
  );
});

test("isMobilePreferred: empathy_mobile vince su empathy_desktop", () => {
  assert.equal(
    isMobilePreferred({
      desktopCookie: "1",
      mobileCookie: "1",
      userAgent: "Mozilla/5.0 (Windows NT 10.0)",
    }),
    true,
  );
});

test("isMobilePreferred: empathy_desktop blocca redirect", () => {
  assert.equal(
    isMobilePreferred({
      desktopCookie: "1",
      mobileCookie: null,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    }),
    false,
  );
});
