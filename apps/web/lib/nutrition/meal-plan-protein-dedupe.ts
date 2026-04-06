/**
 * Garantisce che pranzo e cena non ripetano la stessa famiglia proteica principale
 * (es. uova a pranzo e uova a cena), anche se l’output LLM ignora le regole.
 */

import type { IntelligentMealPlanItemOut, IntelligentMealPlanSlotOut } from "@/lib/nutrition/intelligent-meal-plan-types";

type ProteinFamily = "egg" | "fish" | "poultry" | "legume" | "red_meat";

const FAMILY_ORDER: ProteinFamily[] = ["poultry", "fish", "legume", "red_meat", "egg"];

function haystack(it: Pick<IntelligentMealPlanItemOut, "name" | "portionHint">): string {
  return `${it.name} ${it.portionHint}`.toLowerCase();
}

/** Proteine “secondarie” lattiero-casearie (non contano come proteina principale del pasto). */
function isSecondaryDairyOrPowder(it: IntelligentMealPlanItemOut): boolean {
  if (it.macroRole !== "protein") return false;
  const t = haystack(it);
  if (/\buov|\beggs?\b|frittata|strapazzat|omelett/i.test(t)) return false;
  return (
    /yogurt|kefir|latte |bevanda (di )?(mandorla|riso|avena)|proteine in polvere|whey|shake proteic/i.test(t) ||
    /(grana|parmigiano|formaggio).{0,24}(gratt|fette)/i.test(t)
  );
}

export function proteinFamilyFromItem(it: IntelligentMealPlanItemOut): ProteinFamily | null {
  if (it.macroRole !== "protein") return null;
  if (isSecondaryDairyOrPowder(it)) return null;
  const t = haystack(it);
  if (/\buov|\beggs?\b|frittata|strapazzat|omelett|albumi/i.test(t)) return "egg";
  if (
    /merluzz|salmon|salmone|tonn|sgombr|spigol|pesce|acciug|gamber|filetto|orata|branzin|trota|sarde/i.test(t)
  ) {
    return "fish";
  }
  if (/pollo|tacchino|petto|pollo|turkey|chicken/i.test(t)) return "poultry";
  if (/legum|lenticch|ceci|fagiol|pisell|cece|hummus|soia edamame/i.test(t)) return "legume";
  if (/manzo|maiale|agnell|carne magra|bresaola|vitello|hamburger|spezzatin|ragù|prosciutto cotto|prosciutto crudo|affettat/i.test(t)) {
    return "red_meat";
  }
  return null;
}

function collectLunchFamilies(lunch: IntelligentMealPlanSlotOut): Set<ProteinFamily> {
  const s = new Set<ProteinFamily>();
  for (const it of lunch.items) {
    const f = proteinFamilyFromItem(it);
    if (f) s.add(f);
  }
  return s;
}

function templateFor(family: ProteinFamily, approxKcal: number): Pick<IntelligentMealPlanItemOut, "name" | "portionHint" | "functionalBridge"> {
  const note =
    "Variazione automatica EMPATHY: evitata la stessa famiglia proteica principale già usata a pranzo (stesso giorno).";
  switch (family) {
    case "poultry":
      return {
        name: "Proteina: pollo/tacchino",
        portionHint: `${approxKcal >= 280 ? 200 : 170} g petto di pollo o tacchino`,
        functionalBridge: note,
      };
    case "fish":
      return {
        name: "Proteina: merluzzo",
        portionHint: `${approxKcal >= 280 ? 220 : 190} g merluzzo o altro pesce magro (cottura semplice)`,
        functionalBridge: note,
      };
    case "legume":
      return {
        name: "Proteina: legumi",
        portionHint: `${approxKcal >= 280 ? 220 : 190} g legumi cotti (ceci, lenticchie o fagioli)`,
        functionalBridge: note,
      };
    case "red_meat":
      return {
        name: "Proteina: carne magra",
        portionHint: `${approxKcal >= 280 ? 180 : 150} g carne magra (manzo/maiale magro)`,
        functionalBridge: note,
      };
    case "egg":
      return {
        name: "Proteina: uova",
        portionHint: `${approxKcal >= 320 ? 3 : 2} uova (frittata o strapazzate)`,
        functionalBridge: note,
      };
    default:
      return templateFor("poultry", approxKcal);
  }
}

function pickReplacementFamily(lunchFamilies: Set<ProteinFamily>, duplicate: ProteinFamily): ProteinFamily {
  for (const f of FAMILY_ORDER) {
    if (f === duplicate) continue;
    if (!lunchFamilies.has(f)) return f;
  }
  for (const f of FAMILY_ORDER) {
    if (f !== duplicate) return f;
  }
  return "poultry";
}

/**
 * Se a cena compare la stessa famiglia proteica principale già presente a pranzo,
 * sostituisce la voce cena con un’alternativa coerente (kcal invariate).
 */
export function dedupeLunchDinnerMainProteins(slots: IntelligentMealPlanSlotOut[]): IntelligentMealPlanSlotOut[] {
  const bySlot = new Map(slots.map((s) => [s.slot, s] as const));
  const lunch = bySlot.get("lunch");
  const dinner = bySlot.get("dinner");
  if (!lunch || !dinner) return slots;

  const lunchFamilies = collectLunchFamilies(lunch);
  if (lunchFamilies.size === 0) return slots;

  let changed = false;
  const newItems = dinner.items.map((it) => {
    if (it.macroRole !== "protein") return it;
    const fam = proteinFamilyFromItem(it);
    if (!fam || !lunchFamilies.has(fam)) return it;
    changed = true;
    const alt = pickReplacementFamily(lunchFamilies, fam);
    const t = templateFor(alt, Math.max(40, it.approxKcal));
    return {
      ...it,
      name: t.name,
      portionHint: t.portionHint.slice(0, 160),
      functionalBridge: `${it.functionalBridge} ${t.functionalBridge}`.slice(0, 500),
    };
  });

  if (!changed) return slots;
  return slots.map((s) => (s.slot === "dinner" ? { ...s, items: newItems } : s));
}
