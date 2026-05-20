/**
 * VIRYA gym → stesso percorso del Builder: motore sessione + catalogo + `buildPro2GymSchedaSessionContract`.
 * Nessun secondo generatore: istruzioni VIRYA (distretti, metodologia, adattamento) guidano la materializzazione.
 */

import type { BuilderSessionOperationalScalingViewModel } from "@/api/training/contracts";
import type { Pro2BuilderBlockContract, Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import { serializePro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import {
  buildPro2GymManualRowsFromEngine,
  buildPro2GymRowsCatalogOnly,
} from "@/lib/training/builder/build-pro2-gym-rows-from-engine";
import { buildPro2GymSchedaSessionContract } from "@/lib/training/builder/pro2-gym-manual-plan";
import { PRO2_GYM_EXECUTION_STYLES } from "@/lib/training/builder/gym-execution-styles";
import { disciplineToBlock1SportTag } from "@/lib/training/domain-blocks/block1-strength-functional";
import type { AdaptationTarget } from "@/lib/training/engine/types";
import type { SessionGoalRequest } from "@/lib/training/engine";
import { gymModuleDistricts, type GymDayModule } from "@/lib/training/virya/gym-day-modules";
import { fetchUnifiedBuilderExercises } from "@/modules/training/services/training-builder-catalog-api";
import { generateBuilderSession } from "@/modules/training/services/training-engine-api";

const DEFAULT_RENDER = {
  intensityUnit: "watt" as const,
  ftpW: 250,
  hrMax: 185,
  lengthMode: "time" as const,
  speedRefKmh: 32,
};

export function viryaGymExecutionStyleFromModule(module: GymDayModule): string {
  const method = module.methodology.trim();
  const exact = PRO2_GYM_EXECUTION_STYLES.find((s) => s.toLowerCase() === method.toLowerCase());
  if (exact) return exact;
  const ml = method.toLowerCase();
  if (ml.includes("lento") || ml.includes("controllato")) return "Lento controllato";
  if (ml.includes("max veloc") || ml.includes("spinta veloce")) return "Veloce";
  if (ml.includes("superserie")) return "Superserie";
  if (ml.includes("isometric")) return "Isometrico";
  if (ml.includes("pliomet")) return "Pliometrico";
  if (ml.includes("circuito")) return "Serie composte / triset";
  const ex = module.exerciseType.trim().toLowerCase();
  if (ex.includes("pliomet")) return "Pliometrico";
  if (ex.includes("isometric")) return "Isometrico";
  if (ex.includes("crossfit") || ex.includes("hyrox")) return "Veloce";
  return method || "Lento controllato";
}

function applyViryaMetadataToGymContract(
  contract: Pro2BuilderSessionContract,
  input: { viryaStructureTag: string; methodology?: string },
): Pro2BuilderSessionContract {
  const meta = [input.viryaStructureTag, input.methodology ? `methodology=${input.methodology}` : ""]
    .filter(Boolean)
    .join(" · ");
  const blocks = (contract.blocks ?? []).map((b, i) => {
    if (i !== 0) return b;
    const notes = b.notes ? `${meta} | ${b.notes}` : meta;
    return { ...b, notes: notes.includes("origin=virya_planner") ? notes : `${notes} | origin=virya_planner` };
  });
  return {
    ...contract,
    source: "virya",
    family: "strength",
    blocks,
  };
}

export type MaterializeViryaGymBuilderSessionInput = {
  athleteId: string;
  discipline: string;
  sessionName: string;
  phase: SessionGoalRequest["phase"];
  durationMinutes: number;
  tss: number;
  kcal: number;
  adaptationTarget: AdaptationTarget;
  intensityHint: string;
  objectiveDetail: string;
  methodology?: string;
  gymModule: GymDayModule;
  viryaStructureTag: string;
  applyOperationalScaling?: boolean;
};

export type MaterializeViryaGymBuilderSessionResult =
  | { ok: true; notesLine: string; exerciseCount: number }
  | { ok: false; reason: string; fallbackBlocks: Pro2BuilderBlockContract[] };

export async function materializeViryaGymBuilderSession(
  input: MaterializeViryaGymBuilderSessionInput,
): Promise<MaterializeViryaGymBuilderSessionResult> {
  const districts = gymModuleDistricts(input.gymModule);
  const executionStyle = viryaGymExecutionStyleFromModule(input.gymModule);
  const sportTag = disciplineToBlock1SportTag(input.discipline);

  const engineRes = await generateBuilderSession({
    athleteId: input.athleteId,
    applyOperationalScaling: input.applyOperationalScaling ?? false,
    request: {
      sport: input.discipline.toLowerCase() || "gym",
      domain: "gym",
      goalLabel: input.sessionName,
      adaptationTarget: input.adaptationTarget,
      sessionMinutes: input.durationMinutes,
      phase: input.phase,
      tssTargetHint: input.tss,
      intensityHint: input.intensityHint,
      objectiveDetail: input.objectiveDetail,
    },
  });

  const fallbackBlocks: Pro2BuilderBlockContract[] = [
    {
      id: `virya-strength-${input.gymModule.dayIndex}`,
      label: `${districts.join(" + ")} · ${input.gymModule.exerciseType}`,
      kind: "gym_exercise",
      durationMinutes: input.durationMinutes,
      target: input.gymModule.districtObjective,
      intensityCue: input.intensityHint,
      notes: `method=${input.gymModule.methodology};districts=${districts.join(",")};fallback=virya_gym_builder`,
    },
  ];

  if (!("ok" in engineRes) || !engineRes.ok) {
    return {
      ok: false,
      reason: "error" in engineRes ? String(engineRes.error) : "engine_unavailable",
      fallbackBlocks,
    };
  }

  const { rows: catalogRows, error: catErr } = await fetchUnifiedBuilderExercises({
    sportTag,
    limit: 400,
  });
  if (catErr || catalogRows.length === 0) {
    return { ok: false, reason: catErr ?? "catalog_empty", fallbackBlocks };
  }

  const gymRows = buildPro2GymManualRowsFromEngine({
    blockExercises: engineRes.blockExercises,
    catalogRows,
    sportTag,
    adaptation: input.adaptationTarget,
    executionStyle,
    targetDistrictLabels: districts,
  });

  let rows = gymRows;
  if (!rows.length) {
    rows = buildPro2GymRowsCatalogOnly({
      catalogRows,
      sportTag,
      adaptation: input.adaptationTarget,
      executionStyle,
    });
  }
  if (!rows.length) {
    return { ok: false, reason: "no_catalog_match_for_districts", fallbackBlocks };
  }

  const operationalScaling = (
    engineRes as { operationalScaling?: BuilderSessionOperationalScalingViewModel | null }
  ).operationalScaling;
  const effectiveDuration = operationalScaling?.sessionMinutesEffective ?? input.durationMinutes;
  const effectiveTss = operationalScaling?.tssTargetHintEffective ?? input.tss;
  const effectiveKcal =
    operationalScaling?.applied && operationalScaling.loadScale > 0
      ? Math.max(1, Math.round(input.kcal * operationalScaling.loadScale))
      : input.kcal;

  const scheda = buildPro2GymSchedaSessionContract({
    rows,
    renderProfile: DEFAULT_RENDER,
    discipline: input.discipline.trim() || "Gym",
    sessionName: input.sessionName,
    adaptationTarget: input.adaptationTarget,
    phase: input.phase,
    plannedSessionDurationMinutes: effectiveDuration,
  });

  const withVirya = applyViryaMetadataToGymContract(
    {
      ...scheda,
      summary: {
        ...scheda.summary,
        tss: Math.max(0, Math.round(effectiveTss)),
        kcal: Math.max(0, Math.round(effectiveKcal)),
        kj: Math.max(0, Math.round(effectiveKcal * 4.184)),
      },
    },
    { viryaStructureTag: input.viryaStructureTag, methodology: input.methodology },
  );

  return {
    ok: true,
    notesLine: serializePro2BuilderSessionContract(withVirya),
    exerciseCount: rows.length,
  };
}
