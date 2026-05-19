import { describe, expect, it } from "vitest";
import { catalogRowMatchesViryaDistricts } from "@/lib/training/builder/pro2-gym-catalog-plan";
import type { BuilderCatalogExerciseRow } from "@/modules/training/services/training-builder-catalog-api";

function row(partial: Partial<BuilderCatalogExerciseRow>): BuilderCatalogExerciseRow {
  return {
    id: "1",
    name: "Test",
    muscleGroup: "",
    equipment: "",
    equipmentClass: "",
    primaryDistrict: "",
    catalogCategory: "strength_foundation",
    sportTags: [],
    mediaUrl: "",
    movementPattern: "",
    ...partial,
  };
}

describe("catalogRowMatchesViryaDistricts", () => {
  it("matches Italian district labels on primaryDistrict", () => {
    const r = row({ primaryDistrict: "Petto", muscleGroup: "upper" });
    expect(catalogRowMatchesViryaDistricts(r, ["Petto"])).toBe(true);
    expect(catalogRowMatchesViryaDistricts(r, ["Gambe"])).toBe(false);
  });

  it("allows all rows for full body only selection", () => {
    const r = row({ primaryDistrict: "Gambe" });
    expect(catalogRowMatchesViryaDistricts(r, ["Full body"])).toBe(true);
  });

  it("matches any of multiple VIRYA districts", () => {
    const petto = row({ primaryDistrict: "Petto" });
    const gambe = row({ primaryDistrict: "Quadricipiti", muscleGroup: "legs" });
    expect(catalogRowMatchesViryaDistricts(petto, ["Petto", "Gambe"])).toBe(true);
    expect(catalogRowMatchesViryaDistricts(gambe, ["Petto", "Gambe"])).toBe(true);
  });

  it("matches Gambe label to quadricipiti catalog row", () => {
    const r = row({ primaryDistrict: "Quadricipiti" });
    expect(catalogRowMatchesViryaDistricts(r, ["Gambe"])).toBe(true);
  });
});
