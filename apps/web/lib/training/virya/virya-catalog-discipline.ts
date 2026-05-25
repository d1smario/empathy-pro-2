/** Allinea discipline UI VIRYA → catalogo starter pack. */
const VIRYA_TO_CATALOG: Record<string, string> = {
  ciclismo: "Cycling",
  cycling: "Cycling",
  mtb: "Cycling",
  gravel: "Cycling",
  triathlon: "Cycling",
  bici: "Cycling",
  running: "Running",
  corsa: "Running",
  trail: "Trail Running",
  "trail running": "Trail Running",
  skyrunning: "Trail Running",
  "xc ski": "XC Ski",
  xcski: "XC Ski",
  "sci di fondo": "XC Ski",
  "sci fondo": "XC Ski",
  nordic: "XC Ski",
  "sci nordico": "XC Ski",
  nuoto: "Swimming",
  swimming: "Swimming",
  swim: "Swimming",
  canoa: "Canoe",
  canoe: "Canoe",
  kayak: "Canoe",
  alpinismo: "Trail Running",
};

export function viryaDisciplineToCatalogDiscipline(discipline: string): string {
  const key = discipline.trim().toLowerCase();
  return VIRYA_TO_CATALOG[key] ?? "Cycling";
}

export function catalogDisciplineSlug(catalogDiscipline: string): string {
  switch (catalogDiscipline) {
    case "Running":
      return "run";
    case "Swimming":
      return "swm";
    case "Canoe":
      return "can";
    case "XC Ski":
      return "xcs";
    case "Trail Running":
      return "trl";
    default:
      return "cyc";
  }
}
