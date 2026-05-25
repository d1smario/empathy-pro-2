import test from "node:test";
import assert from "node:assert/strict";
import { resolveAerobicViryaPrescription } from "@/lib/training/engine/aerobic-virya-prescription";
import { parsePro2BuilderSessionFromNotes } from "@/lib/training/builder/pro2-session-notes";
import { materializeViryaAerobicFromCatalog } from "@/lib/training/virya/materialize-virya-aerobic-from-catalog";
import { resolveViryaCatalogPreset } from "@/lib/training/virya/virya-catalog-preset-resolver";
import { viryaDisciplineToCatalogDiscipline } from "@/lib/training/virya/virya-catalog-discipline";

test("viryaDisciplineToCatalogDiscipline maps UI sports", () => {
  assert.equal(viryaDisciplineToCatalogDiscipline("Ciclismo"), "Cycling");
  assert.equal(viryaDisciplineToCatalogDiscipline("Nuoto"), "Swimming");
  assert.equal(viryaDisciplineToCatalogDiscipline("Running"), "Running");
  assert.equal(viryaDisciplineToCatalogDiscipline("XC Ski"), "XC Ski");
  assert.equal(viryaDisciplineToCatalogDiscipline("Trail"), "Trail Running");
});

test("resolveViryaCatalogPreset picks catalog template for VO2 archetype", () => {
  const preset = resolveViryaCatalogPreset({
    archetypeId: "build_vo2_interval",
    discipline: "Ciclismo",
    sessionIndexInWeek: 0,
  });
  assert.ok(preset);
  assert.equal(preset!.discipline, "Cycling");
  assert.ok(preset!.tags.some((t) => t.includes("vo2")));
});

test("resolveViryaCatalogPreset: XC Ski vertical session", () => {
  const preset = resolveViryaCatalogPreset({
    archetypeId: "build_norwegian_z4",
    discipline: "XC Ski",
    sessionIndexInWeek: 1,
  });
  assert.ok(preset);
  assert.equal(preset!.discipline, "XC Ski");
});

test("resolveViryaCatalogPreset: Trail uphill session", () => {
  const preset = resolveViryaCatalogPreset({
    archetypeId: "build_vo2_interval",
    discipline: "Trail",
    sessionIndexInWeek: 0,
  });
  assert.ok(preset);
  assert.equal(preset!.discipline, "Trail Running");
});

test("materializeViryaAerobicFromCatalog: valid contract with catalog metadata", () => {
  const prescription = resolveAerobicViryaPrescription({
    viryaPhase: "build",
    goalSummary: "",
    weekObjectives: ["aerobico"],
    sessionIndexInWeek: 1,
    sessionsInWeek: 4,
  });
  const notes = materializeViryaAerobicFromCatalog({
    prescription,
    discipline: "Ciclismo",
    sessionName: "VIRYA · Build · VO2",
    phase: "build",
    targetDurationMinutes: 75,
    targetTss: 82,
    targetKcal: 760,
    sessionIndexInWeek: 1,
    ftpW: 280,
    hrMax: 188,
    viryaStructureTag: "[VIRYA:annual_test]",
    methodology: "annual_periodized_distribution",
  });
  assert.ok(notes);
  assert.ok(notes!.includes("BUILDER_SESSION_JSON::"));

  const contract = parsePro2BuilderSessionFromNotes(notes!);
  assert.ok(contract);
  assert.ok((contract!.blocks?.[0]?.notes ?? "").includes("origin=virya_catalog"));
  assert.ok((contract!.blocks?.[0]?.notes ?? "").includes("catalogPreset="));

  assert.equal(contract!.discipline, "Cycling");
  assert.ok((contract!.blocks?.length ?? 0) >= 3);
  assert.equal(contract!.plannedSessionDurationMinutes, 75);
  assert.equal(contract!.summary?.tss, 82);
  assert.ok(
    (contract!.blocks ?? []).some(
      (b) => b.kind === "pyramid" || b.kind === "interval2" || b.kind === "interval3" || b.kind === "ramp",
    ) || (contract!.blocks?.length ?? 0) >= 4,
  );
});
