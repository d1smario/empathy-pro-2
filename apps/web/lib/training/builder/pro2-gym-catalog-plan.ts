/**
 * Parità funzionale V1: selezione deterministica esercizi da catalogo unificato + prescrizione
 * dopo aver ricevuto i nomi suggeriti dal motore (`blockExercises`).
 * Nessun secondo generatore: il motore resta l’unica sorgente di struttura; qui si fa solo match su catalogo EMPATHY.
 */

import type { AdaptationTarget } from "@/lib/training/engine/types";
import type { BuilderCatalogExerciseRow } from "@/modules/training/services/training-builder-catalog-api";
import { defaultPro2GymManualRow, type Pro2GymManualRow } from "@/lib/training/builder/pro2-gym-manual-plan";

function strengthGenerationProfile(adaptation: AdaptationTarget) {
  switch (adaptation) {
    case "max_strength":
      return {
        categories: ["strength_foundation", "sport_specific_skill"],
        technicalScope: "" as "" | "generic" | "sport_specific",
        exerciseCount: 5,
      };
    case "power_output":
      return {
        categories: ["sport_specific_skill", "strength_foundation", "mixed_modal_conditioning"],
        technicalScope: "" as "" | "generic" | "sport_specific",
        exerciseCount: 5,
      };
    case "skill_transfer":
      return {
        categories: ["sport_specific_skill", "strength_foundation"],
        technicalScope: "sport_specific" as const,
        exerciseCount: 5,
      };
    case "movement_quality":
    case "mobility_capacity":
      return {
        categories: ["trunk_stability", "strength_accessory", "sport_specific_skill"],
        technicalScope: "" as "" | "generic" | "sport_specific",
        exerciseCount: 4,
      };
    case "recovery":
      return {
        categories: ["trunk_stability", "strength_accessory", "mixed_modal_conditioning"],
        technicalScope: "generic" as const,
        exerciseCount: 4,
      };
    default:
      return {
        categories: ["mixed_modal_conditioning", "strength_foundation", "strength_accessory"],
        technicalScope: "" as "" | "generic" | "sport_specific",
        exerciseCount: 5,
      };
  }
}

function normalizeExerciseName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function scoreCatalogRow(
  row: BuilderCatalogExerciseRow,
  profile: ReturnType<typeof strengthGenerationProfile>,
  activeSportTag: string,
  adaptation: AdaptationTarget,
): number {
  let score = 0;
  const cat = row.catalogCategory ?? "";
  if (profile.categories.includes(cat)) score += 7;
  const tags = (row.sportTags ?? []).map((t) => t.toLowerCase());
  const tag = activeSportTag.toLowerCase();
  if (tags.includes(tag)) score += 5;
  if (tags.some((t) => t.includes(tag) || tag.includes(t))) score += 2;
  if (profile.technicalScope === "sport_specific" && tags.length) score += 2;
  if ((row.primaryDistrict ?? "").trim()) score += 1;
  const mp = (row.movementPattern ?? "").toLowerCase();
  if (
    adaptation === "max_strength" &&
    (mp.includes("squat") || mp.includes("press") || mp.includes("pull") || mp.includes("hinge"))
  )
    score += 2;
  if (adaptation === "power_output" && (mp.includes("jump") || mp.includes("plyo") || mp.includes("olympic"))) score += 2;
  return score;
}

function prescriptionForStrengthSlot(
  adaptation: AdaptationTarget,
  slotIndex: number,
  category: string | undefined,
): Pick<Pro2GymManualRow, "sets" | "reps" | "restSec" | "technique"> {
  const isPrimary = slotIndex === 0 || category === "strength_foundation" || category === "sport_specific_skill";
  switch (adaptation) {
    case "max_strength":
      return {
        sets: isPrimary ? 5 : 4,
        reps: isPrimary ? "3-5" : "5-6",
        restSec: isPrimary ? 180 : 120,
        technique: isPrimary ? "Forza neurale · esecuzione pulita" : "Back-off strength · controllo eccentrico",
      };
    case "power_output":
      return {
        sets: 4,
        reps: isPrimary ? "3-4" : "4-6",
        restSec: isPrimary ? 150 : 105,
        technique: isPrimary ? "Esplosivo · massima intenzione" : "Power accessory · velocità costante",
      };
    case "movement_quality":
    case "mobility_capacity":
      return {
        sets: 3,
        reps: "8-12",
        restSec: 60,
        technique: "Qualità del gesto · range controllato",
      };
    case "recovery":
      return {
        sets: 2,
        reps: "12-15",
        restSec: 45,
        technique: "Recovery flow · bassa fatica sistemica",
      };
    case "skill_transfer":
      return {
        sets: 4,
        reps: isPrimary ? "3-5" : "5-8",
        restSec: isPrimary ? 120 : 75,
        technique: "Transfer tecnico · precisione e timing",
      };
    default:
      return {
        sets: 4,
        reps: isPrimary ? "6-8" : "8-12",
        restSec: isPrimary ? 90 : 60,
        technique: "Builder strength · densità adattativa",
      };
  }
}

/** Estrae nomi esercizio dalla risposta motore (`blockExercises`), stesso contratto V1. */
export function extractPreferredExerciseNamesFromBlockExercises(blockExercises: unknown): string[] {
  if (!Array.isArray(blockExercises)) return [];
  const names: string[] = [];
  for (const bundle of blockExercises) {
    if (!bundle || typeof bundle !== "object") continue;
    const ex = (bundle as { exercises?: unknown }).exercises;
    if (!Array.isArray(ex)) continue;
    for (const item of ex) {
      if (!item || typeof item !== "object") continue;
      const n = String((item as { name?: string }).name ?? "").trim();
      if (n) names.push(n);
    }
  }
  return names;
}

/**
 * Costruisce righe scheda Pro 2 da catalogo builder, allineato a `buildStrengthPlanRowsFromCatalog` V1.
 */
export function buildPro2GymRowsFromCatalog(input: {
  sourceRows: BuilderCatalogExerciseRow[];
  activeSportTag: string;
  adaptation: AdaptationTarget;
  executionStyle: string;
  preferredExerciseNames?: string[];
}): Pro2GymManualRow[] {
  const profile = strengthGenerationProfile(input.adaptation);
  const preferred = (input.preferredExerciseNames ?? []).map(normalizeExerciseName).filter(Boolean);
  const ranked = input.sourceRows
    .map((row) => {
      const normalizedRowName = normalizeExerciseName(row.name);
      const preferredBoost = preferred.some(
        (name) =>
          normalizedRowName === name ||
          normalizedRowName.includes(name) ||
          name.includes(normalizedRowName),
      )
        ? 100
        : 0;
      return {
        row,
        score:
          scoreCatalogRow(row, profile, input.activeSportTag, input.adaptation) +
          preferredBoost,
      };
    })
    .sort((a, b) => b.score - a.score || a.row.name.localeCompare(b.row.name));

  const usedDistricts = new Map<string, number>();
  const selected: Pro2GymManualRow[] = [];
  const usedIds = new Set<string>();
  const style = input.executionStyle.trim() || "Standard";

  for (const { row } of ranked) {
    if (selected.length >= profile.exerciseCount) break;
    if (usedIds.has(row.id)) continue;
    const districtKey = (row.primaryDistrict ?? row.muscleGroup ?? "general").trim() || "general";
    const currentDistrictCount = usedDistricts.get(districtKey) ?? 0;
    if (currentDistrictCount >= 2) continue;

    const prescription = prescriptionForStrengthSlot(input.adaptation, selected.length, row.catalogCategory);
    const technique = `${style} · ${prescription.technique}`;
    const notes = [`equipment=${row.equipment || row.equipmentClass || "—"}`, `category=${row.catalogCategory ?? "—"}`].join(
      " · ",
    );

    selected.push(
      defaultPro2GymManualRow({
        exerciseId: row.id,
        name: row.name,
        sets: prescription.sets,
        reps: prescription.reps,
        restSec: prescription.restSec,
        loadKg: null,
        executionStyle: style,
        technique,
        notes,
        mediaUrl: row.mediaUrl || undefined,
      }),
    );
    usedIds.add(row.id);
    usedDistricts.set(districtKey, currentDistrictCount + 1);
  }

  return selected;
}
