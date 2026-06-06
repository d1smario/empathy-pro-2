import type { FdcFoodBrowseHit } from "@/lib/nutrition/v2/fdc-branch-query";

/** Descrizioni SR Legacy / artefatti da escludere dal composer V2. */
const DESCRIPTION_DENYLIST = [
  /walrus/i,
  /alaska native/i,
  /navajo/i,
  /babyfood/i,
  /graham cracker.*crust/i,
  /pie crust.*cookie/i,
  /restaurant,\s*chinese/i,
  /gelatins,\s*dry powder/i,
];

export function isDeniedFdcDescription(description: string, denyFragments: string[]): boolean {
  const d = description.toLowerCase();
  for (const frag of denyFragments) {
    if (frag && d.includes(frag.toLowerCase())) return true;
  }
  for (const re of DESCRIPTION_DENYLIST) {
    if (re.test(description)) return true;
  }
  return false;
}

export function filterFdcCandidates(
  candidates: FdcFoodBrowseHit[],
  denyFragments: string[],
): FdcFoodBrowseHit[] {
  return candidates.filter(
    (c) => c.kcalPer100g > 0 && !isDeniedFdcDescription(c.description, denyFragments),
  );
}
