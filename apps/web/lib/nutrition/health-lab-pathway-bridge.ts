import type { AthleteHealthMemory } from "@/lib/empathy/schemas/memory";
import type { NutritionPathwaySupportItem } from "@/api/nutrition/contracts";
import { readLabMarkerValue, resolveBloodValuesFromHealth } from "@/lib/health/lab-marker-resolver";

/** Marker canonici letti da `health.blood` / panel blood (chiavi ontology + legacy ingest). */
export type HealthLabMarkerKey =
  | "ferritina"
  | "emoglobina"
  | "vit_d"
  | "b12"
  | "homocysteine"
  | "crp_mg_l";

const MARKER_KEY_ALIASES: Record<HealthLabMarkerKey, readonly string[]> = {
  ferritina: ["ferritina", "ferritin", "ferritin_ng_ml", "ferritina_sierica"],
  emoglobina: ["emoglobina", "hemoglobin", "hgb", "hb"],
  vit_d: ["vit_d", "vitamin_d", "vit_d_25_oh", "25_oh_d", "25oh_d", "25_oh_vitamina_d"],
  b12: ["b12", "vit_b12", "vitamina_b12", "cobalamin", "cobalamina"],
  homocysteine: ["homocysteine", "omocisteina", "hcy"],
  crp_mg_l: ["crp_mg_l", "crp", "hs_crp", "hscrp", "pcr_us", "pcr"],
};

/** Soglie conservative v1 (qualitative, non diagnostiche). Allineate a virya ironConstraint (<35 ng/mL). */
const THRESHOLDS = {
  ferritinaLowNgMl: 35,
  emoglobinaLowGdl: 12.5,
  vitDLowNgMl: 30,
  b12LowPgMl: 300,
  homocysteineHighUmolL: 12,
  crpHighMgL: 3,
} as const;

export type HealthLabMarkerSignal = {
  marker: HealthLabMarkerKey;
  value: number;
  status: "low" | "high";
  sourceKey: string;
};

export type HealthLabPathwayBridgeResult = {
  cofactorStrings: string[];
  markerSignals: HealthLabMarkerSignal[];
  pathwayExtension: NutritionPathwaySupportItem | null;
  notes: string[];
};

export function readHealthLabMarkerValue(
  blood: Record<string, unknown> | null | undefined,
  marker: HealthLabMarkerKey,
): { value: number; sourceKey: string } | null {
  return readLabMarkerValue(blood, MARKER_KEY_ALIASES[marker], {
    excludeHbA1c: marker === "emoglobina",
  });
}

function uniq(items: string[]): string[] {
  return Array.from(new Set(items.map((s) => s.trim()).filter(Boolean)));
}

/**
 * Bridge deterministico Health lab → cofactor strings per pathway modulation / meal plan.
 * Puro, sincrono, zero I/O: consuma solo `AthleteHealthMemory` già in slice nutrition.
 */
export function buildHealthLabPathwayBridge(
  health: AthleteHealthMemory | null | undefined,
): HealthLabPathwayBridgeResult {
  const blood = resolveBloodValuesFromHealth(health);
  const markerSignals: HealthLabMarkerSignal[] = [];
  const cofactorStrings: string[] = [];
  const notes: string[] = [];

  if (!blood) {
    return { cofactorStrings, markerSignals, pathwayExtension: null, notes };
  }

  const ferritina = readHealthLabMarkerValue(blood, "ferritina");
  if (ferritina && ferritina.value < THRESHOLDS.ferritinaLowNgMl) {
    markerSignals.push({
      marker: "ferritina",
      value: ferritina.value,
      status: "low",
      sourceKey: ferritina.sourceKey,
    });
    cofactorStrings.push("Ferro eme/non eme", "Vitamina C per assorbimento ferro");
    notes.push(`Lab: ferritina bassa (${ferritina.value} ng/mL) — supporto ferro alimentare + vit C.`);
  }

  const hb = readHealthLabMarkerValue(blood, "emoglobina");
  if (hb && hb.value < THRESHOLDS.emoglobinaLowGdl) {
    markerSignals.push({ marker: "emoglobina", value: hb.value, status: "low", sourceKey: hb.sourceKey });
    cofactorStrings.push("Ferro eme/non eme", "Folati (B9)", "Vitamina B12");
    notes.push(`Lab: emoglobina bassa (${hb.value} g/dL) — cofattori eritropoiesi.`);
  }

  const vitD = readHealthLabMarkerValue(blood, "vit_d");
  if (vitD && vitD.value < THRESHOLDS.vitDLowNgMl) {
    markerSignals.push({ marker: "vit_d", value: vitD.value, status: "low", sourceKey: vitD.sourceKey });
    cofactorStrings.push("Vitamina D");
    notes.push(`Lab: vitamina D insufficiente (${vitD.value} ng/mL).`);
  }

  const b12 = readHealthLabMarkerValue(blood, "b12");
  if (b12 && b12.value < THRESHOLDS.b12LowPgMl) {
    markerSignals.push({ marker: "b12", value: b12.value, status: "low", sourceKey: b12.sourceKey });
    cofactorStrings.push("Vitamina B12", "Folati (B9)");
    notes.push(`Lab: B12 bassa (${b12.value} pg/mL).`);
  }

  const hcy = readHealthLabMarkerValue(blood, "homocysteine");
  if (hcy && hcy.value > THRESHOLDS.homocysteineHighUmolL) {
    markerSignals.push({ marker: "homocysteine", value: hcy.value, status: "high", sourceKey: hcy.sourceKey });
    cofactorStrings.push("Folati (B9)", "Vitamina B12", "Vitamina B6");
    notes.push(`Lab: omocisteina elevata (${hcy.value} µmol/L) — cofattori metilazione.`);
  }

  const crp = readHealthLabMarkerValue(blood, "crp_mg_l");
  if (crp && crp.value > THRESHOLDS.crpHighMgL) {
    markerSignals.push({ marker: "crp_mg_l", value: crp.value, status: "high", sourceKey: crp.sourceKey });
    cofactorStrings.push("Vitamina C da alimenti", "Polifenoli alimentari");
    notes.push(`Lab: PCR elevata (${crp.value} mg/L) — supporto redox alimentare.`);
  }

  const dedupedCofactors = uniq(cofactorStrings);
  if (!dedupedCofactors.length) {
    return { cofactorStrings: dedupedCofactors, markerSignals, pathwayExtension: null, notes };
  }

  const stimulatedBy = markerSignals.map((s) => `${s.marker}:${s.status}:${s.value}`);

  const pathwayExtension: NutritionPathwaySupportItem = {
    id: "health_lab_micronutrient_support",
    pathwayLabel: "Supporto micronutrienti · segnali lab ematici",
    stimulatedBy,
    substrates: ["Pasti misti regolari con densità micronutrienti"],
    cofactors: dedupedCofactors,
    inhibitorsToAvoid: ["Assunzione ferro contemporanea a tè/caffè nelle finestre critiche (modello qualitativo)"],
    phases: [
      {
        phase: "daily_support",
        windowLabel: "Asse giornaliero (non sostituisce integrazione medica)",
        halfLifeClass: "circadian",
        actions: ["Distribuire cofattori su colazione/pranzo/cena secondo tolleranza GI."],
      },
      {
        phase: "early_recovery",
        windowLabel: "Pranzo/cena preferiti per ferro (assorbimento qualitativo)",
        halfLifeClass: "hours_extended",
        actions: ["Evitare tannini/calcio nello stesso pasto del ferro alimentare."],
      },
    ],
    systemLevels: ["biochemical"],
    confidence: "engine_derived",
  };

  return {
    cofactorStrings: dedupedCofactors,
    markerSignals,
    pathwayExtension,
    notes,
  };
}
