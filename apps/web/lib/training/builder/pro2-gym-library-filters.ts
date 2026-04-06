import type { BuilderCatalogExerciseRow } from "@/modules/training/services/training-builder-catalog-api";

/** Filtro catalogo per famiglia attrezzi (allineato V1). Nessun valore = nessun filtro stretto. */
export type Pro2GymLibraryEquipmentFilter =
  | ""
  | "free_weights"
  | "bodyweight"
  | "cables"
  | "bands"
  | "machines";

/** Preset contrazione / letteratura per filtro libreria e per prescrizione riga. */
export type Pro2GymContractionPreset = "" | "standard" | "eccentric" | "isometric" | "plyometric";

export const PRO2_GYM_LIBRARY_EQUIPMENT_OPTIONS: Array<{
  value: Pro2GymLibraryEquipmentFilter;
  label: string;
}> = [
  { value: "", label: "Tutti gli attrezzi" },
  { value: "free_weights", label: "Libero / bilanciere" },
  { value: "bodyweight", label: "Corpo libero" },
  { value: "cables", label: "Cavi" },
  { value: "bands", label: "Elastici" },
  { value: "machines", label: "Macchinari" },
];

export const PRO2_GYM_CONTRACTION_OPTIONS: Array<{
  value: Pro2GymContractionPreset;
  label: string;
}> = [
  { value: "", label: "Tutti gli stili" },
  { value: "standard", label: "Standard" },
  { value: "eccentric", label: "Eccentrica" },
  { value: "isometric", label: "Isometrica" },
  { value: "plyometric", label: "Pliometrica" },
];

export const PRO2_GYM_CONTRACTION_LABELS: Record<Exclude<Pro2GymContractionPreset, "">, string> = {
  standard: "Standard",
  eccentric: "Eccentrica",
  isometric: "Isometrica",
  plyometric: "Pliometrica",
};

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/** Classificazione euristica per filtro catalogo (non sostituisce metadati futuri nel JSON). */
export function classifyCatalogContractionBucket(
  row: Pick<BuilderCatalogExerciseRow, "name" | "movementPattern">,
): Exclude<Pro2GymContractionPreset, ""> {
  const combined = `${norm(row.name)} ${norm(row.movementPattern)}`;
  if (
    /\bplyo|plyometric|jump|bounding|box\s*jump|broad\s*jump|\bjump\b|\bhop\b|bounds|salto|countermovement/i.test(
      combined,
    )
  ) {
    return "plyometric";
  }
  if (
    /\bisometric|iso\b|static\b|\bplank\b|hollow|wall\s*sit|dead\s*hang|l-?sit|carry\s*hold/i.test(combined)
  ) {
    return "isometric";
  }
  if (/\beccentric|negative\b|discesa|slow\s*descent|tempo\s*\d+\s*[-–]\s*0/i.test(combined)) {
    return "eccentric";
  }
  return "standard";
}

export function matchesLibraryEquipmentFilter(
  row: BuilderCatalogExerciseRow,
  filter: Pro2GymLibraryEquipmentFilter,
): boolean {
  if (!filter) return true;
  const eq = norm(row.equipment);
  const cls = norm(row.equipmentClass);

  const has = (re: RegExp) => re.test(eq) || re.test(norm(row.name));

  switch (filter) {
    case "free_weights":
      if (cls.includes("pesi liberi")) return true;
      return /\bbarbell\b|\bdumbbell\b|\bkettlebell\b|trap\s*bar|ez[_\s-]*bar|weight[_\s-]*plate/.test(eq);
    case "bodyweight":
      if (cls.includes("corpo libero")) return true;
      return /\bbodyweight\b|pullup[_\s-]*bar|\bring\b/.test(eq) && !/\bmachine\b/.test(eq);
    case "cables":
      if (cls.includes("cavo")) return true;
      return /\bcable\b/.test(eq);
    case "bands":
      return (
        /\bband\b|resistance[_\s-]*band|mini[_\s-]*band|elastic|loop\s*band/.test(eq) ||
        /\bband\b|elastico/i.test(row.name)
      );
    case "machines":
      if (cls.includes("macchinario")) return true;
      return /\bmachine\b|leg[_\s-]*press|smith\b|chest\s*press\s*machine/i.test(eq);
    default:
      return true;
  }
}

export function matchesContractionLibraryFilter(
  row: BuilderCatalogExerciseRow,
  filter: Pro2GymContractionPreset,
): boolean {
  if (!filter) return true;
  const b = classifyCatalogContractionBucket(row);
  if (filter === "standard") return b === "standard";
  return b === filter;
}
