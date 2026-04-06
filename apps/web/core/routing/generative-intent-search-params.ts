import { isProductModuleId, type ProductModuleId } from "@empathy/contracts";

/** Contesto passato dalla superficie generativa → hub (`/dashboard?genModule=&genFocus=`). */
export type GenerativeHubIntent = {
  module: ProductModuleId;
  focus: string;
};

const FOCUS_MAX = 64;
const FOCUS_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Valida query stabili; rifiuta id sconosciuti e focus non sicuri per eco in UI.
 */
export function parseGenerativeHubIntent(
  raw: Record<string, string | string[] | undefined> | undefined,
): GenerativeHubIntent | null {
  if (!raw) return null;
  const gm = typeof raw.genModule === "string" ? raw.genModule.trim() : "";
  const gf = typeof raw.genFocus === "string" ? raw.genFocus.trim() : "";
  if (!gm || !gf || !isProductModuleId(gm)) return null;
  if (gf.length > FOCUS_MAX || !FOCUS_PATTERN.test(gf)) return null;
  return { module: gm, focus: gf };
}
