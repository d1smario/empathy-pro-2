import { createHash, randomBytes } from "node:crypto";

/** Verifier PKCE 64 caratteri (charset RFC 7636). */
export function createGarminPkceVerifier(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  let out = "";
  const buf = randomBytes(64);
  for (let i = 0; i < 64; i++) {
    out += chars[buf[i]! % chars.length];
  }
  return out;
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** code_challenge = BASE64URL(SHA256(verifier)). */
export function garminPkceChallengeS256(verifier: string): string {
  const hash = createHash("sha256").update(verifier, "utf8").digest();
  return base64UrlEncode(hash);
}
