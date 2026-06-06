/**
 * Etichette alimento in italiano per UI meal plan V2 (USDA SR → copy prodotto).
 */

const LABEL_RULES: ReadonlyArray<{ re: RegExp; label: string }> = [
  { re: /\b(spaghetti|macaroni|penne|fusilli|farfalle|pasta)\b/i, label: "Pasta di semola" },
  { re: /\b(rice,?\s*(white|brown| cooked| long-grain)?|riso)\b/i, label: "Riso" },
  { re: /\b(quinoa)\b/i, label: "Quinoa" },
  { re: /\b(barley|orzo)\b/i, label: "Orzo perlato" },
  { re: /\b(bulgur|farro|spelt)\b/i, label: "Farro / cereale integrale" },
  { re: /\b(potato(es)?,?\s*(flesh|baked| boiled| without skin)?|patat)\b/i, label: "Patate" },
  { re: /\b(sweet potato)\b/i, label: "Patate dolci" },
  { re: /\b(lentil|lenticch)\b/i, label: "Lenticchie" },
  { re: /\b(chickpea|ceci)\b/i, label: "Ceci" },
  { re: /\b(black beans|kidney beans|fagiol)\b/i, label: "Fagioli" },
  { re: /\b(chicken breast|broilers.*breast|petto.*pollo)\b/i, label: "Petto di pollo" },
  { re: /\b(turkey breast|tacchino)\b/i, label: "Petto di tacchino" },
  { re: /\b(salmon|salmone)\b/i, label: "Salmone" },
  { re: /\b(tuna|tonno)\b/i, label: "Tonno" },
  { re: /\b(cod|merluzzo)\b/i, label: "Merluzzo" },
  { re: /\b(mackerel|sgombro)\b/i, label: "Sgombro" },
  { re: /\b(sardine|sardina)\b/i, label: "Sardine" },
  { re: /\b(trout|trota)\b/i, label: "Trota" },
  { re: /\b(egg,?\s*whole|uova)\b/i, label: "Uova" },
  { re: /\b(beef.*(lean|sirloin|round)|manzo)\b/i, label: "Manzo magro" },
  { re: /\b(pork.*loin|maiale)\b/i, label: "Maiale magro" },
  { re: /\b(tofu)\b/i, label: "Tofu" },
  { re: /\b(spinach|spinaci)\b/i, label: "Spinaci" },
  { re: /\b(broccoli)\b/i, label: "Broccoli" },
  { re: /\b(zucchini|zucchine)\b/i, label: "Zucchine" },
  { re: /\b(bell pepper|peperoni|pepper,?\s*sweet)\b/i, label: "Peperoni" },
  { re: /\b(tomato(es)?,?\s*raw|pomodor)\b/i, label: "Pomodori" },
  { re: /\b(carrot|carote)\b/i, label: "Carote" },
  { re: /\b(lettuce|lattuga|insalata)\b/i, label: "Insalata mista" },
  { re: /\b(kale|cavolo)\b/i, label: "Verdura a foglia" },
  { re: /\b(asparagus|asparagi)\b/i, label: "Asparagi" },
  { re: /\b(green beans|fagiolini)\b/i, label: "Fagiolini" },
  { re: /\b(banana)\b/i, label: "Banana" },
  { re: /\b(apple|mela)\b/i, label: "Mela" },
  { re: /\b(orange|arancia)\b/i, label: "Arancia" },
  { re: /\b(kiwi)\b/i, label: "Kiwi" },
  { re: /\b(strawber|fragol)\b/i, label: "Fragole" },
  { re: /\b(blueber|mirtill)\b/i, label: "Mirtilli" },
  { re: /\b(yogurt,?\s*greek|yogurt greco)\b/i, label: "Yogurt greco" },
  { re: /\b(yogurt)\b/i, label: "Yogurt" },
  { re: /\b(milk,?\s*(lowfat|skim|whole)?|latte)\b/i, label: "Latte" },
  { re: /\b(cheese,?\s*cottage|cottage)\b/i, label: "Cottage cheese" },
  { re: /\b(mozzarella|ricotta|parmesan|formaggio)\b/i, label: "Formaggio" },
  { re: /\b(oats?|avena|oatmeal|porridge)\b/i, label: "Fiocchi d'avena" },
  { re: /\b(cereal|corn flakes|muesli|granola)\b/i, label: "Cereali da colazione" },
  { re: /\b(bread,?\s*(white|whole|wheat)?|pane)\b/i, label: "Pane integrale" },
  { re: /\b(crackers?|biscott)\b/i, label: "Fette biscottate" },
  { re: /\b(almond|mandorl)\b/i, label: "Mandorle" },
  { re: /\b(walnut|noci)\b/i, label: "Noci" },
  { re: /\b(olive oil|olio)\b/i, label: "Olio EVO" },
  { re: /\b(avocado)\b/i, label: "Avocado" },
];

function cleanUsdaTitle(raw: string): string {
  const first = raw.split(",")[0]?.trim() ?? raw.trim();
  return first
    .replace(/\bNS\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Nome breve in italiano per la griglia meal plan. */
export function fdcDescriptionToLabelIt(description: string): string {
  const d = description.trim();
  if (!d) return "Alimento";
  for (const rule of LABEL_RULES) {
    if (rule.re.test(d)) return rule.label;
  }
  const cleaned = cleanUsdaTitle(d);
  if (/^[a-z\s\-']+$/i.test(cleaned) && cleaned.length <= 48) {
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  return cleaned.slice(0, 56);
}
