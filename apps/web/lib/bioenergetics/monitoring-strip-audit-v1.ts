import type {
  BioenergeticMonitoringStripAuditV1,
  BioenergeticMonitoringStripChannelAuditV1,
  BioenergeticsDayViewModel,
} from "@/api/bioenergetics/contracts";
import type { BioenergeticDayMemorySlice } from "@/lib/bioenergetics/bioenergetic-day-memory-slice";
import { num } from "@/lib/bioenergetics/bioenergetic-day-payload-parsers";
import { postprandialMealLoad01ForCortisolMod } from "@/lib/bioenergetics/day-presentation";
import {
  activitySupportHours,
  countTimelineMealsWithMacroSignalsV1,
  mealGlycemicHourWeights24,
} from "@empathy/domain-bioenergetics";
import type { SimTimelineEventV1 } from "@empathy/domain-bioenergetics";

function asSimTimeline(vm: BioenergeticsDayViewModel): readonly SimTimelineEventV1[] {
  return vm.timeline as readonly SimTimelineEventV1[];
}

function curveResNote(
  ch: NonNullable<BioenergeticsDayViewModel["continuousMonitoring"]>["channels"][number],
): string | null {
  const r = ch.curveResolution;
  if (!r) return null;
  const dm = Math.round(r.deterministicWeight01 * 100);
  const ai = Math.round(r.aiProposalWeight01 * 100);
  const ric = Math.round(r.internalContextRichness01 * 100);
  return `fusione v${r.fusionContractVersion}: motore ${dm}% · AI ${ai}% · ricchezza ${ric}% · ${r.governance}`;
}

function channelAudit(
  ch: NonNullable<BioenergeticsDayViewModel["continuousMonitoring"]>["channels"][number],
): BioenergeticMonitoringStripChannelAuditV1 {
  const nums = ch.hourly.filter((x): x is number => x != null && Number.isFinite(x));
  return {
    id: ch.id,
    labelIt: ch.labelIt,
    unit: ch.unit,
    dataPlane: ch.dataPlane,
    hourlyNonNullCount: nums.length,
    hourlyMin: nums.length ? Math.min(...nums) : null,
    hourlyMax: nums.length ? Math.max(...nums) : null,
    streamPointCount: ch.streamTrace?.length ?? 0,
    curveResolutionNote: curveResNote(ch),
  };
}

/**
 * Riepilogo tecnico per `GET …/bioenergetics/day?stripAudit=1`: stessi input della VM mostrata,
 * senza ricalcolo delle curve (solo aggregati da `continuousMonitoring` + slice + kernel).
 */
export function buildBioenergeticMonitoringStripAuditV1(
  vm: BioenergeticsDayViewModel,
  slice: BioenergeticDayMemorySlice,
): BioenergeticMonitoringStripAuditV1 {
  const tl = asSimTimeline(vm);
  const mealW = mealGlycemicHourWeights24(tl);
  let maxH = 0;
  let maxW = 0;
  for (let h = 0; h < 24; h += 1) {
    const w = mealW[h] ?? 0;
    if (w > maxW) {
      maxW = w;
      maxH = h;
    }
  }
  const actH = activitySupportHours(tl);
  const choIntakeG = slice.diaryRows.reduce((sum, row) => sum + (num(row.carbs_g) ?? 0), 0);
  const executedLoad = slice.executed.reduce((sum, row) => sum + Math.max(0, Number(row.tss ?? 0)), 0);
  const plannedLoad = slice.planned.reduce((sum, row) => sum + Math.max(0, Number(row.tssTarget ?? 0)), 0);
  const strip = vm.continuousMonitoring;
  const post01 = postprandialMealLoad01ForCortisolMod(vm.timeline);

  return {
    auditContractVersion: 1,
    stripLayerRendered: strip?.layer ?? "model_continuous_v1",
    kernel: vm.kernel,
    diaryAndTraining: {
      choIntakeGramsDay: choIntakeG,
      executedWorkoutCount: slice.executed.length,
      plannedWorkoutCount: slice.planned.length,
      executedTssSum: executedLoad,
      plannedTssSum: plannedLoad,
      diaryRowCount: slice.diaryRows.length,
      mealsWithMacroSignals: countTimelineMealsWithMacroSignalsV1(tl),
    },
    channelsSource: {
      glucosePointCount: vm.channels.glucose?.length ?? 0,
      lactatePointCount: vm.channels.lactate?.length ?? 0,
      glucoseProvenance: vm.provenance.glucose,
      lactateProvenance: vm.provenance.lactate,
      glucoseSamples055: vm.canonicalStreamCounts.glucoseSampleCount,
      lactateSamples055: vm.canonicalStreamCounts.lactateSampleCount,
    },
    timelineDigest: {
      mealGlycemicMaxHour: maxH,
      mealGlycemicMaxWeight: Math.round(maxW * 1000) / 1000,
      activitySupportHours: [...actH].sort((a, b) => a - b),
      events: vm.timeline.slice(0, 48).map((e) => ({ ts: e.ts, type: e.type, title: e.title.slice(0, 160) })),
    },
    cortisolActhModulation: {
      postprandialMealLoad01: post01,
      noteIt:
        "Modulazione nominale cortisolo/ACTH: `postprandialMealLoad01` da pasti con CHO/kcal in timeline (vedi `postprandialMealLoad01ForCortisolMod` + `buildNominalCortisolActhHourly24` in domain-bioenergetics).",
    },
    engineRefsIt: [
      "Glucosio/lattato orari: `day-presentation` → `interpolateNumericSeriesByHour` / dense sim + `applyTimelineContextToGluLacHourly24` (pasti `mealGlycemicHourWeights24`, sedute `activitySupportHours`).",
      "Stream «CGM-like» UI: `streamTrace` se glu/lac densi (misura >3 punti o predittori sub-orari v1 / legacy `sim_diurnal_v1_*m`) o striscia AI con ≥72 punti 5 min (`BioenergeticsContinuousMonitoringGrid`).",
      "Domanda insulinica oraria/striscia: `buildInsulinStimulusPredictorSubhourlyV1` (5 min) → media oraria in `buildInsulinProxyHourly24` / striscia quando `channels.insulinProxyDense` è valorizzato dal bundle sim.",
      "Cortisolo/ACTH in striscia: solo se tile ha valore (lab o sim da kernel) — `mergeLabSim` in `day-presentation`; diurna nominale + mod pasto.",
      "TSH / FT4 in striscia: stesso criterio tile — `buildNominalThyroidTshFt4Hourly24` (domain) + hold lab piatto se misurato; fusione come altri ormoni nominali.",
      "GH / ghrelina in striscia: `buildNominalGhGhrelinHourly24` (domain, timeline pasti/sedute) + hold lab; tile da `mergeLabSimRespectingSkeleton` (nodi skeleton gh_pulse / ghrelin).",
      "IGF-1 / leptina: `buildNominalIgf1LeptinHourly24` (domain) + hold lab; leptina anche con tile skeleton `leptin_energy_balance`.",
    ],
    stripChannels: (strip?.channels ?? []).map(channelAudit),
  };
}
