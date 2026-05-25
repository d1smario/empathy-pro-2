/**
 * Matrice endurance per fase/durata — crescita catalogo verso 500 senza duplicare strutture complesse.
 * Ogni preset ha presetId univoco, tag fase e disciplina per filtri/VIRYA.
 */
import { preset, st, type AerobicStarterPreset } from "@/lib/training/library/starter-pack-aerobic-helpers";
import { DISCIPLINE_SCALES } from "@/lib/training/library/starter-pack-aerobic-helpers";

type PhaseKey = "base" | "build" | "peak" | "deload";

const PHASE_META: Record<
  PhaseKey,
  { label: string; zone: string; adaptation: string; tssFactor: number; tags: string[] }
> = {
  base: { label: "Base", zone: "Z2", adaptation: "aerobic_base", tssFactor: 0.72, tags: ["endurance", "z2", "base_phase"] },
  build: {
    label: "Build",
    zone: "Z2",
    adaptation: "aerobic_base",
    tssFactor: 0.88,
    tags: ["endurance", "z2", "build_phase", "volume"],
  },
  peak: { label: "Peak", zone: "Z2", adaptation: "aerobic_base", tssFactor: 0.78, tags: ["endurance", "z2", "peak_phase", "taper_volume"] },
  deload: {
    label: "Deload",
    zone: "Z1",
    adaptation: "recovery",
    tssFactor: 0.48,
    tags: ["endurance", "recovery", "deload", "deload_phase"],
  },
};

const DURATION_BANDS = [
  { suffix: "45", minutes: 45, scale: 0.72 },
  { suffix: "60", minutes: 60, scale: 0.88 },
  { suffix: "90", minutes: 90, scale: 1 },
  { suffix: "120", minutes: 120, scale: 1.18 },
] as const;

function buildEnduranceMatrix(): AerobicStarterPreset[] {
  const out: AerobicStarterPreset[] = [];
  const disciplines = [
    DISCIPLINE_SCALES.cycling,
    DISCIPLINE_SCALES.running,
    DISCIPLINE_SCALES.swimming,
    DISCIPLINE_SCALES.canoe,
    DISCIPLINE_SCALES.xcSki,
    DISCIPLINE_SCALES.trailRunning,
  ];

  for (const d of disciplines) {
    for (const phase of Object.keys(PHASE_META) as PhaseKey[]) {
      const meta = PHASE_META[phase];
      for (const band of DURATION_BANDS) {
        const plannedMinutes = Math.max(30, Math.round(band.minutes * d.durationScale));
        const mainMin = Math.max(18, Math.round((plannedMinutes - 24) * band.scale));
        const tss = Math.max(12, Math.round(plannedMinutes * 0.62 * meta.tssFactor * d.tssScale));
        const presetId = `${d.slug}_phase_${phase}_z2_${band.suffix}`;
        out.push(
          preset(
            presetId,
            d.discipline,
            `${meta.label} ${d.discipline} · ${band.suffix}′`,
            `Volume ${meta.zone} fase ${phase} — matrice catalogo (crescita controllata).`,
            meta.adaptation,
            phase === "deload" ? "deload" : phase,
            [...meta.tags, d.slug],
            plannedMinutes,
            tss,
            [st(`Steady ${meta.zone}`, mainMin, meta.zone)],
            { warm: phase === "deload" ? 8 : 12, cool: phase === "deload" ? 8 : 10 },
          ),
        );
      }
    }
  }
  return out;
}

export const ENDURANCE_MATRIX_PRESETS: AerobicStarterPreset[] = buildEnduranceMatrix();
