import type { FdcFoodBrowseHit } from "@/lib/nutrition/v2/fdc-branch-query";

/** Descrizioni SR Legacy / artefatti / junk food da escludere dal composer V2. */
const DESCRIPTION_DENYLIST = [
  /^beverage$/i,
  /^beverages$/i,
  /^snacks?,?\s/i,
  /butter replacement/i,
  /meal replacement/i,
  /infant formula/i,
  /babyfood/i,
  /walrus/i,
  /alaska native/i,
  /navajo/i,
  /graham cracker.*crust/i,
  /pie crust.*cookie/i,
  /restaurant,\s*chinese/i,
  /gelatins,\s*dry powder/i,
  /french fries/i,
  /potato chips/i,
  /tortilla chips/i,
  /onion rings/i,
  /corn dog/i,
  /fast foods/i,
  /kraft foods/i,
  /general mills/i,
  /granola bar/i,
  /fruit leather/i,
  /candy bar/i,
  /ice cream/i,
  /cupcake/i,
  /doughnut/i,
  /rice cake/i,
  /\bcrackers?\b/i,
  /mini rice cakes/i,
  /^candies/i,
  /^candy,/i,
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
