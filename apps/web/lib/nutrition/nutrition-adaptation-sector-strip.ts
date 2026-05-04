import type { KnowledgeResearchTraceSummary } from "@/api/knowledge/contracts";
import type { NutritionPathwayModulationViewModel, NutritionPathwaySystemLevel } from "@/api/nutrition/contracts";
import type { AdaptationSectorBoxVm, AdaptationSectorPillVm } from "@/lib/adaptation/adaptation-sector-box";
import type { PhysiologyState } from "@/lib/empathy/schemas/physiology";
import type { TwinState } from "@/lib/empathy/schemas/twin";
import type { RecoverySummary } from "@/lib/reality/recovery-summary";

const LEVEL_ORDER: { key: NutritionPathwaySystemLevel; short: string }[] = [
  { key: "biochemical", short: "Biochimico" },
  { key: "genetic", short: "Genetico" },
  { key: "hormonal", short: "Ormonale" },
  { key: "neurologic", short: "Neuro" },
  { key: "microbiota", short: "Microbiota" },
];

type PhysioSlice = Pick<PhysiologyState, "metabolicProfile" | "lactateProfile" | "performanceProfile" | "recoveryProfile"> | null;
type TwinSlice = Pick<TwinState, "glycogenStatus" | "readiness" | "redoxStressIndex" | "inflammationRisk"> | null;

export type NutritionAdaptationSectorPillContext = {
  physiology: PhysioSlice;
  twin: TwinSlice;
  recoverySummary: RecoverySummary | null;
  intolerances?: string[] | null;
  allergies?: string[] | null;
  researchTraceSummaries?: KnowledgeResearchTraceSummary[] | null;
};

function clip(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

function pushPill(list: AdaptationSectorPillVm[], pill: AdaptationSectorPillVm, max: number) {
  if (list.length >= max) return;
  if (list.some((p) => p.text === pill.text)) return;
  list.push(pill);
}

const TRACE_LEVEL_HINTS: { level: NutritionPathwaySystemLevel; re: RegExp }[] = [
  { level: "microbiota", re: /microbiota|microbiom|intestin|gut|scfa|fibra|fermentat/i },
  { level: "genetic", re: /genetic|epigen|metilaz|mtor|transcript|hif\b|gene\b/i },
  { level: "hormonal", re: /hormon|cortisol|insulin|thyroid|hpa|asse\s*endocr/i },
  { level: "neurologic", re: /neuro|autonomic|hrv|sympathetic|cognitive|vagal/i },
  { level: "biochemical", re: /metabol|glucose|glycem|glycogen|redox|mitochond|substrat|lactat/i },
];

function tracePillsForLevel(level: NutritionPathwaySystemLevel, summaries: KnowledgeResearchTraceSummary[]): AdaptationSectorPillVm[] {
  const out: AdaptationSectorPillVm[] = [];
  const hint = TRACE_LEVEL_HINTS.find((h) => h.level === level)?.re;
  if (!hint) return out;
  let n = 0;
  for (const s of summaries) {
    if (n >= 1) break;
    const text = (s.latestResultSummary ?? "").trim();
    if (!text || s.linkCounts.documents + s.linkCounts.assertions < 1) continue;
    if (!hint.test(text)) continue;
    pushPill(
      out,
      {
        id: `nut_trace_${level}_${s.traceId.slice(0, 8)}`,
        text: clip(`Letteratura: ${text}`, 58),
        direction: "forward",
      },
      1,
    );
    n += 1;
  }
  return out;
}

function forwardPillsForPathwayLevel(
  mod: NutritionPathwayModulationViewModel,
  level: NutritionPathwaySystemLevel,
): AdaptationSectorPillVm[] {
  const out: AdaptationSectorPillVm[] = [];
  const pathways = mod.pathways.filter((p) => p.systemLevels.includes(level));
  for (const p of pathways) {
    if (out.length >= 2) break;
    const action = p.phases[0]?.actions[0];
    if (action) {
      pushPill(
        out,
        { id: `nut_fwd_act_${p.id}_${out.length}`, text: clip(action, 58), direction: "forward" },
        2,
      );
    } else if (p.stimulatedBy[0]) {
      pushPill(
        out,
        {
          id: `nut_fwd_stim_${p.id}_${out.length}`,
          text: clip(`Segnale: ${p.stimulatedBy[0]}`, 58),
          direction: "forward",
        },
        2,
      );
    }
  }
  return out;
}

function stimulusForwardPills(mod: NutritionPathwayModulationViewModel | null): AdaptationSectorPillVm[] {
  if (!mod?.pathways.length) return [];
  const out: AdaptationSectorPillVm[] = [];
  const stim = uniqFlat(mod.pathways.flatMap((p) => p.stimulatedBy));
  for (const s of stim.slice(0, 2)) {
    pushPill(out, { id: `nut_stim_fwd_${out.length}`, text: clip(`Target / stimolo: ${s}`, 58), direction: "forward" }, 2);
  }
  return out;
}

function uniqFlat(items: string[]): string[] {
  return Array.from(new Set(items.map((x) => x.trim()).filter(Boolean)));
}

function reversePillsForLevel(
  level: NutritionPathwaySystemLevel | "stimulus",
  ctx: NutritionAdaptationSectorPillContext | null,
): AdaptationSectorPillVm[] {
  if (!ctx) return [];
  const out: AdaptationSectorPillVm[] = [];
  const lact = ctx.physiology?.lactateProfile;
  const perf = ctx.physiology?.performanceProfile;
  const recProf = ctx.physiology?.recoveryProfile;
  const twin = ctx.twin;
  const rec = ctx.recoverySummary;
  const intol = uniqFlat(ctx.intolerances ?? []);
  const allerg = uniqFlat(ctx.allergies ?? []);

  const gut = (lact?.gutStressScore ?? 0) * 100;
  const choDel = lact?.bloodDeliveryPctOfIngested ?? 100;
  const dys = lact?.microbiotaDysbiosisScore ?? 0;
  const redox = Math.max(perf?.redoxStressIndex ?? 0, twin?.redoxStressIndex ?? 0);
  const hrv = rec?.hrvMs;
  const readiness = rec?.readinessScore ?? twin?.readiness;
  const baseGlucose = recProf?.baselineGlucoseMmol;
  const baseHrv = recProf?.baselineHrvMs;

  if (level === "stimulus") {
    if (rec?.status === "poor") {
      pushPill(out, { id: "nut_rev_stim_rec", text: "Recovery device scarsa: modula stimolo pianificato.", direction: "reverse" }, 2);
    } else if (rec?.status === "moderate") {
      pushPill(out, { id: "nut_rev_stim_rec_m", text: "Recovery moderata: prudenza su volume/intensità cumulati.", direction: "reverse" }, 2);
    }
    if (typeof readiness === "number" && readiness < 48) {
      pushPill(out, { id: "nut_rev_stim_read", text: `Readiness ${Math.round(readiness)}: asse recupero vs carico.`, direction: "reverse" }, 2);
    }
  }

  if (level === "biochemical") {
    if (gut >= 38) {
      pushPill(out, { id: "nut_rev_bio_gut", text: "Stress GI modello: influenza assorbimento e timing CHO.", direction: "reverse" }, 2);
    }
    if (choDel < 84) {
      pushPill(out, { id: "nut_rev_bio_cho", text: `Delivery CHO ${Math.round(choDel)}%: modula fueling peri.`, direction: "reverse" }, 2);
    }
    if (typeof baseGlucose === "number" && baseGlucose > 0) {
      pushPill(
        out,
        {
          id: "nut_rev_bio_gluc",
          text: `Glicemia baseline lab ${baseGlucose.toFixed(1)} mmol: contesto glucosio.`,
          direction: "reverse",
        },
        2,
      );
    }
  }

  if (level === "genetic") {
    if (redox >= 58) {
      pushPill(out, { id: "nut_rev_gen_redox", text: "Stress redox elevato: contesto segnali di regolazione.", direction: "reverse" }, 2);
    }
  }

  if (level === "hormonal") {
    if (typeof readiness === "number" && readiness < 52) {
      pushPill(out, { id: "nut_rev_horm_read", text: "Asse recupero/stress: readiness bassa vs cortisolo atteso.", direction: "reverse" }, 2);
    }
  }

  if (level === "neurologic") {
    if (hrv != null && baseHrv != null && hrv < baseHrv * 0.88) {
      pushPill(out, { id: "nut_rev_neu_hrv", text: "HRV sotto baseline: modulazione autonomica vs stimolo.", direction: "reverse" }, 2);
    } else if (hrv != null && rec?.status !== "good") {
      pushPill(out, { id: "nut_rev_neu_hrv2", text: "HRV / recovery non ottimali: drive simpatico da calibrare.", direction: "reverse" }, 2);
    }
  }

  if (level === "microbiota") {
    if (dys >= 42 || gut >= 35) {
      pushPill(out, { id: "nut_rev_micro_dys", text: "Proxy microbiota/intestino: influenza barriera e tolleranza.", direction: "reverse" }, 2);
    }
    if (intol.length) {
      pushPill(
        out,
        {
          id: "nut_rev_micro_intol",
          text: clip(`Intolleranze dichiarate: ${intol.slice(0, 2).join(", ")}`, 58),
          direction: "reverse",
        },
        2,
      );
    }
    if (allerg.length && out.length < 2) {
      pushPill(
        out,
        {
          id: "nut_rev_micro_all",
          text: clip(`Allergie: ${allerg.slice(0, 2).join(", ")}`, 58),
          direction: "reverse",
        },
        2,
      );
    }
  }

  return out;
}

/**
 * Striscia settori per giorno nutrizione: stimolo giornata + livelli pathway modulation.
 * Opzionalmente arricchisce con pillole → (effetto stimolo / pathway) e ← (contesto atleta, lab, letteratura).
 */
export function buildNutritionAdaptationSectorBoxes(
  mod: NutritionPathwayModulationViewModel | null,
  sessionStimulusLine: string | null,
  pillContext?: NutritionAdaptationSectorPillContext | null,
): AdaptationSectorBoxVm[] {
  const stim = sessionStimulusLine?.trim();
  const summaries = pillContext?.researchTraceSummaries?.filter(Boolean) ?? [];

  const stimForward = stimulusForwardPills(mod);
  const stimPills = [...stimForward, ...reversePillsForLevel("stimulus", pillContext ?? null)];
  const stimBox: AdaptationSectorBoxVm = {
    id: "nut_stimulus",
    shortLabel: "Stimolo",
    valueLine: stim ? clip(stim, 40) : "—",
    detailLine:
      stim ??
      "Nessuna sessione pianificata sul giorno selezionato o contract senza descrizione sintetica.",
    ...(stimPills.length ? { pills: stimPills } : {}),
  };

  if (!mod) {
    return [
      stimBox,
      ...LEVEL_ORDER.map((row) => {
        const rev = reversePillsForLevel(row.key, pillContext ?? null);
        const tr = tracePillsForLevel(row.key, summaries);
        const pills = [...tr, ...rev];
        return {
          id: `nut_empty_${row.key}`,
          shortLabel: row.short,
          valueLine: "—",
          detailLine: "Pathway modulation non calcolabile (manca contesto sessione / fisiologia).",
          ...(pills.length ? { pills } : {}),
        };
      }),
    ];
  }

  const levelBoxes = LEVEL_ORDER.map((row) => {
    const lines = mod.multiLevelSummary[row.key] ?? [];
    const primary = lines[0];
    const forward = forwardPillsForPathwayLevel(mod, row.key);
    const trace = tracePillsForLevel(row.key, summaries);
    const rev = reversePillsForLevel(row.key, pillContext ?? null);
    const pills = [...trace, ...forward, ...rev];
    return {
      id: `nut_${row.key}`,
      shortLabel: row.short,
      valueLine: primary ? clip(primary, 40) : "—",
      detailLine: lines.length ? lines.join(" · ") : "Nessun pathway attivo in questo settore per il giorno.",
      ...(pills.length ? { pills } : {}),
    };
  });

  return [stimBox, ...levelBoxes];
}
