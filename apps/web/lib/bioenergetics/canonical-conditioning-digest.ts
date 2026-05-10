import { createHash } from "crypto";
import type { BioenergeticConditioningContextV1 } from "@empathy/contracts";

/** JSON deterministico (chiavi ordinate) per digest contesto. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const parts = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`);
  return `{${parts.join(",")}}`;
}

/** SHA-256 hex del contesto condizionamento (reproducibilità synthesizer). */
export function sha256BioenergeticConditioningContext(ctx: BioenergeticConditioningContextV1): string {
  return createHash("sha256").update(stableStringify(ctx), "utf8").digest("hex");
}
