import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import { serializePro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import { preparePro2BuilderSessionContractForPersist } from "@/lib/training/builder/pro2-session-interpretation";
import type { AerobicViryaPrescription } from "@/lib/training/engine/aerobic-virya-prescription";
import { buildStarterContractFromPreset } from "@/lib/training/library/starter-pack-aerobic-helpers";
import { scaleLibraryContract } from "@/lib/training/library/scale-library-contract";
import { viryaDisciplineToCatalogDiscipline } from "@/lib/training/virya/virya-catalog-discipline";
import { resolveViryaCatalogPreset } from "@/lib/training/virya/virya-catalog-preset-resolver";
import { resolvePlannedSessionMetrics } from "@/lib/training/physiology/planned-session-metrics";

function computeViryaSlotLoadScale(
  contract: Pro2BuilderSessionContract,
  targetMinutes: number,
  targetTss: number,
): number {
  const baseMinutes =
    contract.plannedSessionDurationMinutes ??
    (contract.summary?.durationSec ? Math.max(1, Math.round(contract.summary.durationSec / 60)) : 60);
  const baseTss = Math.max(12, contract.summary?.tss ?? 50);
  const durScale = targetMinutes / Math.max(15, baseMinutes);
  const tssScale = targetTss / baseTss;
  return durScale * 0.72 + tssScale * 0.28;
}

export function scaleCatalogContractForViryaSlot(
  contract: Pro2BuilderSessionContract,
  targetMinutes: number,
  targetTss: number,
  targetKcal: number,
): Pro2BuilderSessionContract {
  const loadScaleRaw = computeViryaSlotLoadScale(contract, targetMinutes, targetTss);
  const scaled = scaleLibraryContract(contract, loadScaleRaw, { clampMin: 0.5, clampMax: 1.55 });
  const durationSec = Math.max(60, targetMinutes * 60);
  const draft: Pro2BuilderSessionContract = {
    ...scaled,
    plannedSessionDurationMinutes: targetMinutes,
    summary: scaled.summary
      ? {
          ...scaled.summary,
          durationSec,
          tss: targetTss,
          kcal: targetKcal,
          kj: scaled.summary.kj,
          avgPowerW:
            scaled.summary.avgPowerW > 0
              ? Math.max(80, Math.round((targetTss * 1000) / Math.max(durationSec / 3600, 0.25) / 36))
              : scaled.summary.avgPowerW,
        }
      : scaled.summary,
  };
  const metrics = resolvePlannedSessionMetrics({
    contract: draft,
    durationMinutesDb: targetMinutes,
    tssTargetDb: targetTss,
    kcalTargetDb: targetKcal,
    athleteFtpWatts: draft.renderProfile?.ftpW,
  });
  return {
    ...draft,
    summary: draft.summary
      ? {
          ...draft.summary,
          durationSec,
          tss: metrics.tss > 0 ? metrics.tss : targetTss,
          kcal: metrics.kcal > 0 ? metrics.kcal : targetKcal,
          kj: metrics.kj > 0 ? metrics.kj : draft.summary.kj,
          avgPowerW: metrics.avgPowerW ?? draft.summary.avgPowerW,
        }
      : draft.summary,
  };
}

export type MaterializeViryaAerobicFromCatalogInput = {
  prescription: AerobicViryaPrescription;
  discipline: string;
  sessionName: string;
  phase: string;
  targetDurationMinutes: number;
  targetTss: number;
  targetKcal: number;
  sessionIndexInWeek: number;
  ftpW?: number;
  hrMax?: number;
  viryaStructureTag: string;
  methodology?: string;
};

/**
 * Materializza seduta aerobica VIRYA dal catalogo Empathy (stesso pack libreria coach),
 * scalando durata/carico sullo slot microciclo.
 */
export function materializeViryaAerobicFromCatalog(input: MaterializeViryaAerobicFromCatalogInput): string | null {
  const preset = resolveViryaCatalogPreset({
    archetypeId: input.prescription.archetypeId,
    discipline: input.discipline,
    sessionIndexInWeek: input.sessionIndexInWeek,
  });
  if (!preset) return null;

  const catalogDiscipline = viryaDisciplineToCatalogDiscipline(input.discipline);
  let contract = buildStarterContractFromPreset({
    ...preset,
    title: input.sessionName,
    discipline: catalogDiscipline,
    phase: input.phase,
  });

  contract = scaleCatalogContractForViryaSlot(
    contract,
    input.targetDurationMinutes,
    input.targetTss,
    input.targetKcal,
  );

  const ftpW = input.ftpW && input.ftpW > 0 ? input.ftpW : contract.renderProfile?.ftpW ?? 250;
  const hrMax = input.hrMax && input.hrMax > 0 ? input.hrMax : contract.renderProfile?.hrMax ?? 185;

  contract = {
    ...contract,
    sessionName: input.sessionName,
    phase: input.phase,
    discipline: catalogDiscipline,
    renderProfile: {
      ...(contract.renderProfile ?? {
        intensityUnit: "watt",
        ftpW: 250,
        hrMax: 185,
        lengthMode: "time",
        speedRefKmh: 35,
      }),
      ftpW,
      hrMax,
    },
  };

  const prepared = preparePro2BuilderSessionContractForPersist(contract);
  const catalogMeta = [
    input.viryaStructureTag,
    `catalogPreset=${preset.presetId}`,
    `archetype=${input.prescription.archetypeId}`,
    input.methodology ? `methodology=${input.methodology}` : "",
    "origin=virya_catalog",
  ]
    .filter(Boolean)
    .join(" · ");

  const blocksMerged = (prepared.blocks ?? []).map((b, i) => {
    if (i !== 0) return b;
    const notes = [catalogMeta, b.notes].filter(Boolean).join(" | ");
    return { ...b, notes };
  });

  return serializePro2BuilderSessionContract({ ...prepared, blocks: blocksMerged });
}
