import type { FuelingFunctionalFocus, FuelingProduct } from "@/lib/nutrition/fueling-product-catalog";

function round(v: number, digits = 0) {
  const m = 10 ** digits;
  return Math.round(v * m) / m;
}

export const FUELING_FORMAT_IT: Record<FuelingProduct["format"], string> = {
  powder: "Polvere",
  gel: "Gel",
  bar: "Barretta",
  chew: "Chew",
  drink: "Drink",
  capsule: "Capsule",
  tablet: "Compresse",
  gummies: "Gummies",
  sachet: "Bustina",
};

export const FUELING_CATEGORY_IT: Record<FuelingProduct["category"], string> = {
  recovery: "Recovery",
  drink: "Drink",
  gel: "Gel",
  bar: "Bar",
  chew: "Chew",
};

export const FOCUS_IT: Partial<Record<FuelingFunctionalFocus, string>> = {
  carbo: "Carbo",
  electrolyte: "Elettroliti",
  preworkout: "Pre-workout",
  recovery: "Recovery",
  protein: "Proteine",
  eaa: "EAA",
  bcaa: "BCAA",
  caffeine: "Caffeina",
  creatine: "Creatina",
};

export const TIMING_IT: Record<FuelingProduct["timing"][number], string> = {
  pre: "Pre",
  intra: "Intra",
  post: "Post",
  daily: "Giornaliero",
};

export type IntegrationQuantityContext = {
  choGHour: number;
  energyAdequacyRatio: number | null | undefined;
  proteinBiasPctPoints: number;
  fuelingChoScale: number;
};

export function buildIntegrationQuantityHint(product: FuelingProduct, ctx: IntegrationQuantityContext): string {
  const lines: string[] = [];
  const choH = ctx.choGHour;
  const gPer = product.carbohydrateGPerServing;

  if (product.functionalFocus.includes("recovery") || product.functionalFocus.includes("protein")) {
    lines.push("Post-seduta: 1 porzione entro ~60 min, in aggiunta al pasto (recovery).");
  }
  if (product.timing.includes("pre") && (product.functionalFocus.includes("preworkout") || product.functionalFocus.includes("caffeine"))) {
    lines.push("Pre: dose singola 20–45 min prima; valutare tolleranza individuale alla caffeina.");
  }
  if (gPer != null && gPer > 0 && (product.timing.includes("intra") || product.timing.includes("pre")) && choH > 3) {
    const porzH = Math.max(0.25, choH / gPer);
    lines.push(
      `CHO catalogo ~${gPer} g/porzione · target intra solver ~${round(choH, 0)} g/h (scala fueling ×${ctx.fuelingChoScale.toFixed(2)}) → ordine di grandezza ~${round(porzH, 1)} porzioni/h se questo fosse l'unico riferimento.`,
    );
  } else if (gPer != null && gPer > 0) {
    lines.push(`CHO dichiarato in catalogo ~${gPer} g/porzione; confronta con piano fueling del giorno.`);
  }
  if (ctx.energyAdequacyRatio != null && ctx.energyAdequacyRatio < 0.88) {
    lines.push("Diario: energia sotto target — non stringere recovery; allinea con pasto principale.");
  }
  if (ctx.proteinBiasPctPoints >= 2 && (product.functionalFocus.includes("protein") || product.functionalFocus.includes("eaa"))) {
    lines.push(`Leve solver: bias proteico pasti +${ctx.proteinBiasPctPoints} pt — far coincidere recovery con piano pasti.`);
  }
  if (!lines.length) {
    lines.push("Quantità: seguire etichetta e accordo con lo staff; leve giornata modulano training↔nutrizione.");
  }
  return lines.slice(0, 2).join(" ");
}
