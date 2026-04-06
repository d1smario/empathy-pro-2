"use client";

import {
  ChevronLeft,
  ChevronRight,
  Footprints,
  Gauge,
  Heart,
  Layers,
  Mountain,
  Plus,
  Repeat2,
  Timer,
  Sparkles,
  Trash2,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import { SessionBlockIntensityChart } from "@/components/training/SessionBlockIntensityChart";
import { defaultManualPlanBlock, type ManualPlanBlock, type PlanBlockKind } from "@/lib/training/builder/manual-plan-block";
import type { SportMacroId } from "@/lib/training/builder/sport-macro-palette";
import {
  colorForIntensity,
  PRO2_INTENSITY_OPTIONS,
  zoneRangeLabel,
  type Pro2IntensityLabel,
  type Pro2IntensityUnit,
} from "@/lib/training/builder/pro2-intensity";
import type { ChartSegment } from "@/lib/training/engine/block-chart-segments";

function rangeShort(z: string, unit: Pro2IntensityUnit, ftpW: number, hrMax: number): string {
  const raw = zoneRangeLabel(z, unit, ftpW, hrMax);
  const tail = raw.replace(/^(Z\d|LT\d|FatMax)\s*/i, "").trim();
  return tail || raw;
}

function ZoneStrip({
  label,
  value,
  onPick,
  unit,
  ftpW,
  hrMax,
}: {
  label: string;
  value: Pro2IntensityLabel;
  onPick: (z: Pro2IntensityLabel) => void;
  unit: Pro2IntensityUnit;
  ftpW: number;
  hrMax: number;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[0.65rem] font-bold uppercase tracking-wider text-gray-500">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {PRO2_INTENSITY_OPTIONS.map((z) => {
          const sel = z === value;
          const bg = colorForIntensity(z);
          return (
            <button
              key={z}
              type="button"
              onClick={() => onPick(z)}
              className={`min-w-[3.25rem] rounded-xl border-2 px-2 py-1.5 text-center text-[0.7rem] font-bold text-black shadow-md transition ${
                sel ? "ring-2 ring-white ring-offset-2 ring-offset-black scale-[1.02]" : "opacity-85 hover:opacity-100"
              }`}
              style={{ backgroundColor: bg, borderColor: sel ? "#fff" : `${bg}99` }}
              title={zoneRangeLabel(z, unit, ftpW, hrMax)}
            >
              <span className="block leading-tight">{z}</span>
              <span className="mt-0.5 block text-[0.58rem] font-semibold leading-tight opacity-90">
                {rangeShort(z, unit, ftpW, hrMax)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const KIND_META: { kind: PlanBlockKind; label: string; icon: typeof Timer; color: string; iconClass: string }[] = [
  { kind: "steady", label: "Continuo", icon: Timer, color: "from-cyan-500/90 to-teal-600/90", iconClass: "text-cyan-100 drop-shadow-[0_0_8px_rgba(34,211,238,0.45)]" },
  { kind: "ramp", label: "Ramp", icon: TrendingUp, color: "from-amber-500/90 to-orange-600/90", iconClass: "text-amber-100 drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]" },
  { kind: "interval2", label: "2 tempi", icon: Repeat2, color: "from-violet-500/90 to-fuchsia-600/90", iconClass: "text-violet-100 drop-shadow-[0_0_8px_rgba(196,181,253,0.45)]" },
  { kind: "interval3", label: "3 tempi", icon: Layers, color: "from-blue-500/90 to-indigo-600/90", iconClass: "text-sky-100 drop-shadow-[0_0_8px_rgba(125,211,252,0.45)]" },
  { kind: "pyramid", label: "Piramide", icon: Mountain, color: "from-rose-500/90 to-pink-600/90", iconClass: "text-rose-100 drop-shadow-[0_0_8px_rgba(251,113,133,0.45)]" },
];

type KindMetaRow = (typeof KIND_META)[number];

function kindMetaForFamily(f: SportMacroId): KindMetaRow[] {
  if (f === "technical") return KIND_META.filter((k) => k.kind !== "pyramid");
  return KIND_META;
}

function manualPresetTechnicalDrills(): ManualPlanBlock[] {
  const w = defaultManualPlanBlock("steady", "Ingresso");
  w.minutes = 15;
  w.intensity = "Z2";
  const d = defaultManualPlanBlock("interval3", "Drill A-B-C");
  d.repeats = 6;
  d.step1Seconds = 60;
  d.step2Seconds = 45;
  d.step3Seconds = 30;
  d.intensity = "Z3";
  d.intensity2 = "Z2";
  d.intensity3 = "Z1";
  const c = defaultManualPlanBlock("steady", "Uscita tecnica");
  c.minutes = 12;
  c.intensity = "Z2";
  return [w, d, c];
}

function manualPresetTechnicalMixed(): ManualPlanBlock[] {
  const a = defaultManualPlanBlock("steady", "Tecnico continuo");
  a.minutes = 45;
  a.intensity = "Z3";
  const b = defaultManualPlanBlock("interval2", "Accelerazioni brevi");
  b.repeats = 5;
  b.workSeconds = 45;
  b.recoverSeconds = 90;
  b.intensity = "Z4";
  b.intensity2 = "Z2";
  return [a, b];
}

const SESSION_DURATION_CHOICES = Array.from({ length: 19 }, (_, i) => 30 + i * 5);

function manualPresetTechnicalGame(): ManualPlanBlock[] {
  const w = defaultManualPlanBlock("steady", "Riscaldamento");
  w.minutes = 20;
  w.intensity = "Z2";
  const g = defaultManualPlanBlock("interval2", "Partita controllata");
  g.repeats = 6;
  g.workSeconds = 180;
  g.recoverSeconds = 120;
  g.intensity = "Z4";
  g.intensity2 = "Z2";
  return [w, g];
}

function manualPresetLifestyleGentle(): ManualPlanBlock[] {
  const a = defaultManualPlanBlock("steady", "Centratura");
  a.minutes = 10;
  a.intensity = "Z1";
  const b = defaultManualPlanBlock("steady", "Corpo principale");
  b.minutes = 25;
  b.intensity = "Z2";
  const c = defaultManualPlanBlock("steady", "Chiusura / rilascio");
  c.minutes = 10;
  c.intensity = "Z1";
  return [a, b, c];
}

function manualPresetLifestyleMobility(): ManualPlanBlock[] {
  const a = defaultManualPlanBlock("steady", "Mobilità globale");
  a.minutes = 20;
  a.intensity = "Z1";
  const b = defaultManualPlanBlock("interval2", "Mobilità dinamica");
  b.repeats = 8;
  b.workSeconds = 45;
  b.recoverSeconds = 30;
  b.intensity = "Z2";
  b.intensity2 = "Z1";
  const c = defaultManualPlanBlock("steady", "Rilascio finale");
  c.minutes = 15;
  c.intensity = "Z1";
  return [a, b, c];
}

function manualPresetLifestyleBreath(): ManualPlanBlock[] {
  const a = defaultManualPlanBlock("steady", "Respiro & consapevolezza");
  a.minutes = 35;
  a.intensity = "Z1";
  const b = defaultManualPlanBlock("steady", "Movimento leggero");
  b.minutes = 15;
  b.intensity = "Z2";
  return [a, b];
}

const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-lg transition disabled:opacity-40 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-orange-500 hover:brightness-110 border border-white/10";

const btnIcon =
  "inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white shadow-inner transition hover:bg-white/20 disabled:opacity-30";

const stepperBtn =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-black/55 text-lg font-bold text-white shadow-inner transition hover:bg-white/10";

/** Controllo compatto tipo “RPM/SPM”: cella colorata + − / numero / + (stesso schema generativo). */
function GenerativeStepperPod({
  icon: Icon,
  label,
  value,
  onChange,
  min,
  max,
  step,
  borderClass,
  bgClass,
  iconClass,
}: {
  icon: typeof Layers;
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step: number;
  borderClass: string;
  bgClass: string;
  iconClass: string;
}) {
  const dec = () => onChange(Math.max(min, value - step));
  const inc = () => onChange(Math.min(max, value + step));
  return (
    <div className={`flex min-w-[9.5rem] flex-1 items-stretch gap-2 rounded-xl border p-2.5 shadow-inner ${borderClass} ${bgClass}`}>
      <div className="flex flex-col justify-center pt-4">
        <Icon className={`h-4 w-4 shrink-0 ${iconClass}`} aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[0.6rem] font-bold uppercase tracking-wider text-gray-400">{label}</p>
        <div className="mt-1 flex items-center gap-1">
          <button type="button" className={stepperBtn} onClick={dec} aria-label={`Diminuisci ${label}`}>
            −
          </button>
          <input
            type="number"
            className="h-9 w-full min-w-0 rounded-lg border border-white/15 bg-black/60 px-1 text-center font-mono text-sm text-white"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
            }}
          />
          <button type="button" className={stepperBtn} onClick={inc} aria-label={`Aumenta ${label}`}>
            +
          </button>
        </div>
      </div>
    </div>
  );
}

export type BuilderManualComposerProps = {
  athleteId: string | null;
  physioHint: string | null;
  manualPlanBlocks: ManualPlanBlock[];
  setManualPlanBlocks: React.Dispatch<React.SetStateAction<ManualPlanBlock[]>>;
  activeIndex: number;
  setActiveIndex: React.Dispatch<React.SetStateAction<number>>;
  intensityUnit: Pro2IntensityUnit;
  setIntensityUnit: React.Dispatch<React.SetStateAction<Pro2IntensityUnit>>;
  ftpW: number;
  setFtpW: React.Dispatch<React.SetStateAction<number>>;
  hrMax: number;
  setHrMax: React.Dispatch<React.SetStateAction<number>>;
  lengthMode: "time" | "distance";
  setLengthMode: React.Dispatch<React.SetStateAction<"time" | "distance">>;
  speedRefKmh: number;
  setSpeedRefKmh: React.Dispatch<React.SetStateAction<number>>;
  manualSessionName: string;
  setManualSessionName: React.Dispatch<React.SetStateAction<string>>;
  manualChartSegments: ChartSegment[];
  manualPlannedDate: string;
  setManualPlannedDate: React.Dispatch<React.SetStateAction<string>>;
  manualSaveBusy: boolean;
  onSaveManual: () => void;
  manualSaveErr: string | null;
  manualSaveOkId: string | null;
  canSave: boolean;
  /** TSS stimato dal piano manuale (segmenti espansi). */
  estimatedTss: number;
  /** Macro A–D: skin e copy del composer (allineato a TrainingBuilderRichPageView). */
  macroFamily: SportMacroId;
  /** Durata seduta (calendario) scelta dal coach — non ricavata automaticamente dai blocchi. */
  manualSessionDurationMinutes: number;
  setManualSessionDurationMinutes: React.Dispatch<React.SetStateAction<number>>;
};

export function BuilderManualComposer({
  athleteId,
  physioHint,
  manualPlanBlocks,
  setManualPlanBlocks,
  activeIndex,
  setActiveIndex,
  intensityUnit,
  setIntensityUnit,
  ftpW,
  setFtpW,
  hrMax,
  setHrMax,
  lengthMode,
  setLengthMode,
  speedRefKmh,
  setSpeedRefKmh,
  manualSessionName,
  setManualSessionName,
  manualChartSegments,
  manualPlannedDate,
  setManualPlannedDate,
  manualSaveBusy,
  onSaveManual,
  manualSaveErr,
  manualSaveOkId,
  canSave,
  estimatedTss,
  macroFamily,
  manualSessionDurationMinutes,
  setManualSessionDurationMinutes,
}: BuilderManualComposerProps) {
  const safeIndex = Math.min(Math.max(0, activeIndex), Math.max(0, manualPlanBlocks.length - 1));
  const row = manualPlanBlocks[safeIndex];
  const kindMetaList = kindMetaForFamily(macroFamily);

  const structureMinutesFromChart = useMemo(
    () => Math.max(0, Math.round(manualChartSegments.reduce((s, seg) => s + seg.durationSeconds, 0) / 60)),
    [manualChartSegments],
  );

  useEffect(() => {
    const allowed = new Set(kindMetaForFamily(macroFamily).map((k) => k.kind));
    setManualPlanBlocks((blocks) => {
      let changed = false;
      const next = blocks.map((b) => {
        if (allowed.has(b.kind)) return b;
        changed = true;
        return {
          ...defaultManualPlanBlock("steady", b.label),
          id: b.id,
          label: b.label,
          notes: b.notes,
          cadenceMetric: b.cadenceMetric,
          cadenceMin: b.cadenceMin,
          cadenceMax: b.cadenceMax,
          frequencyHint: b.frequencyHint,
          target: b.target,
        };
      });
      return changed ? next : blocks;
    });
  }, [macroFamily, setManualPlanBlocks]);

  const patch = (partial: Partial<ManualPlanBlock>) => {
    setManualPlanBlocks((p) => p.map((b, i) => (i === safeIndex ? { ...b, ...partial } : b)));
  };

  const setKind = (k: PlanBlockKind) => {
    setManualPlanBlocks((p) =>
      p.map((b, i) =>
        i === safeIndex
          ? {
              ...defaultManualPlanBlock(k, b.label),
              id: b.id,
              label: b.label,
              notes: b.notes,
              cadenceMetric: b.cadenceMetric,
              cadenceMin: b.cadenceMin,
              cadenceMax: b.cadenceMax,
              frequencyHint: b.frequencyHint,
              target: b.target,
            }
          : b,
      ),
    );
  };

  const addBlock = () => {
    setManualPlanBlocks((p) => {
      const next = [...p, defaultManualPlanBlock("steady", `Blocco ${p.length + 1}`)];
      const idx = next.length - 1;
      queueMicrotask(() => setActiveIndex(idx));
      return next;
    });
  };

  const removeBlock = () => {
    if (manualPlanBlocks.length <= 1) return;
    const nextLen = manualPlanBlocks.length - 1;
    const nextIdx = Math.min(safeIndex, nextLen - 1);
    setManualPlanBlocks((p) => p.filter((_, i) => i !== safeIndex));
    setActiveIndex(Math.max(0, nextIdx));
  };

  const goPrev = () => setActiveIndex((i) => Math.max(0, i - 1));
  const goNext = () => setActiveIndex((i) => Math.min(manualPlanBlocks.length - 1, i + 1));

  if (!row) {
    return null;
  }

  const ftp = Math.max(1, ftpW);
  const hr = Math.max(1, hrMax);

  const skin =
    macroFamily === "technical"
      ? { border: "border-violet-500/35", bg: "from-violet-950/40 via-fuchsia-950/15 to-black/80" }
      : macroFamily === "lifestyle"
        ? { border: "border-emerald-500/35", bg: "from-emerald-950/40 via-teal-950/25 to-black/80" }
        : { border: "border-cyan-500/30", bg: "from-cyan-950/40 via-violet-950/10 to-black/80" };

  const titleCopy =
    macroFamily === "technical"
      ? { h: "Manuale · Tecnici", p: "Preset rapidi drill / partita / tecnico + burst; piramide omessa per restare sul semplice." }
      : macroFamily === "lifestyle"
        ? {
            h: "Manuale · Lifestyle",
            p: "Mobilità, respiro, recovery: zone basse (Z1–Z2). Usa le sedute rapide o componi i blocchi come per l’aerobico.",
          }
        : {
            h: "Costruisci seduta · Aerobico",
            p: "Il grafico si aggiorna mentre componi. Zone watt/FC; distanza e cadenza solo per A · Aerobico.",
          };

  const showAerobicDistance = macroFamily === "aerobic";
  const showCadenceRow = macroFamily === "aerobic";

  return (
    <section
      aria-label="Builder manuale coach"
      className={`rounded-2xl border bg-gradient-to-b ${skin.border} ${skin.bg} p-4 sm:p-6`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            className={`text-lg font-bold ${
              macroFamily === "technical"
                ? "text-transparent bg-clip-text bg-gradient-to-r from-violet-200 via-fuchsia-200 to-white"
                : macroFamily === "lifestyle"
                  ? "text-transparent bg-clip-text bg-gradient-to-r from-emerald-200 via-teal-200 to-cyan-200"
                  : "text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 via-violet-200 to-teal-200"
            }`}
          >
            {titleCopy.h}
          </h2>
          <p className="mt-1 max-w-xl text-xs text-gray-400">{titleCopy.p}</p>
        </div>
        {physioHint ? (
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-[0.65rem] font-medium text-emerald-200">
            {physioHint}
          </span>
        ) : null}
      </div>

      {/* Grafico in alto */}
      <div
        className={`mt-4 rounded-2xl border bg-black/50 p-3 shadow-inner ${
          macroFamily === "technical"
            ? "border-violet-500/25"
            : macroFamily === "lifestyle"
              ? "border-emerald-500/25"
              : "border-cyan-500/25"
        }`}
      >
        <SessionBlockIntensityChart segments={manualChartSegments} title="Anteprima sessione" estimatedTss={estimatedTss} />
        <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
          {manualPlanBlocks.map((b, i) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setActiveIndex(i)}
              className={`h-2.5 rounded-full transition-all ${
                i === safeIndex
                  ? macroFamily === "technical"
                    ? "w-8 bg-gradient-to-r from-violet-400 to-fuchsia-500"
                    : macroFamily === "lifestyle"
                      ? "w-8 bg-gradient-to-r from-emerald-400 to-teal-400"
                      : "w-8 bg-gradient-to-r from-cyan-400 to-teal-400"
                  : "w-2.5 bg-white/25 hover:bg-white/40"
              }`}
              title={b.label}
              aria-label={`Vai a ${b.label}`}
            />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
          <label className="flex flex-col gap-1 text-[0.65rem] text-gray-400">
            <span
              className={`font-bold uppercase tracking-wider ${
                macroFamily === "technical"
                  ? "text-violet-200/90"
                  : macroFamily === "lifestyle"
                    ? "text-emerald-200/90"
                    : "text-cyan-200/90"
              }`}
            >
              Durata nel calendario
            </span>
            <select
              className="min-w-[7.5rem] rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-sm font-mono text-white"
              value={manualSessionDurationMinutes}
              onChange={(e) => setManualSessionDurationMinutes(Number(e.target.value))}
            >
              {SESSION_DURATION_CHOICES.map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </select>
          </label>
          <p className="max-w-md pb-1 text-[0.65rem] leading-relaxed text-gray-500">
            Somma segmenti nel grafico:{" "}
            <span className="font-mono font-semibold text-gray-300">~{structureMinutesFromChart} min</span>. La seduta salvata sul calendario
            usa la durata selezionata a sinistra.
          </p>
        </div>
      </div>

      {macroFamily === "technical" ? (
        <div className="mt-4 rounded-xl border border-violet-500/30 bg-violet-500/[0.08] p-3">
          <p className="mb-2 flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-wider text-violet-200">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Sedute rapide · tecnici
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="min-w-[8.5rem] flex-1 rounded-xl border border-violet-400/35 bg-gradient-to-br from-violet-600/80 to-fuchsia-800/80 px-3 py-2.5 text-left text-xs font-bold text-white shadow-inner transition hover:brightness-110"
              onClick={() => {
                setManualPlanBlocks(manualPresetTechnicalDrills());
                setActiveIndex(0);
              }}
            >
              Drill A-B-C
            </button>
            <button
              type="button"
              className="min-w-[8.5rem] flex-1 rounded-xl border border-violet-400/35 bg-gradient-to-br from-violet-600/80 to-fuchsia-800/80 px-3 py-2.5 text-left text-xs font-bold text-white shadow-inner transition hover:brightness-110"
              onClick={() => {
                setManualPlanBlocks(manualPresetTechnicalMixed());
                setActiveIndex(0);
              }}
            >
              Tecnico + burst
            </button>
            <button
              type="button"
              className="min-w-[8.5rem] flex-1 rounded-xl border border-violet-400/35 bg-gradient-to-br from-violet-600/80 to-fuchsia-800/80 px-3 py-2.5 text-left text-xs font-bold text-white shadow-inner transition hover:brightness-110"
              onClick={() => {
                setManualPlanBlocks(manualPresetTechnicalGame());
                setActiveIndex(0);
              }}
            >
              Partita
            </button>
          </div>
        </div>
      ) : macroFamily === "lifestyle" ? (
        <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] p-3">
          <p className="mb-2 flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-wider text-emerald-200">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Sedute rapide · lifestyle
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="min-w-[8.5rem] flex-1 rounded-xl border border-emerald-400/35 bg-gradient-to-br from-emerald-600/80 to-teal-800/80 px-3 py-2.5 text-left text-xs font-bold text-white shadow-inner transition hover:brightness-110"
              onClick={() => {
                setManualPlanBlocks(manualPresetLifestyleGentle());
                setActiveIndex(0);
              }}
            >
              Flow gentile
            </button>
            <button
              type="button"
              className="min-w-[8.5rem] flex-1 rounded-xl border border-emerald-400/35 bg-gradient-to-br from-emerald-600/80 to-teal-800/80 px-3 py-2.5 text-left text-xs font-bold text-white shadow-inner transition hover:brightness-110"
              onClick={() => {
                setManualPlanBlocks(manualPresetLifestyleMobility());
                setActiveIndex(0);
              }}
            >
              Mobilità
            </button>
            <button
              type="button"
              className="min-w-[8.5rem] flex-1 rounded-xl border border-emerald-400/35 bg-gradient-to-br from-emerald-600/80 to-teal-800/80 px-3 py-2.5 text-left text-xs font-bold text-white shadow-inner transition hover:brightness-110"
              onClick={() => {
                setManualPlanBlocks(manualPresetLifestyleBreath());
                setActiveIndex(0);
              }}
            >
              Respiro + movimento
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/35 p-3">
          <div className="flex rounded-full border border-white/15 bg-black/50 p-0.5">
            <button
              type="button"
              onClick={() => setIntensityUnit("watt")}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                intensityUnit === "watt" ? "bg-gradient-to-r from-amber-500 to-orange-500 text-black" : "text-gray-400"
              }`}
            >
              <Zap
                className={`h-3.5 w-3.5 ${intensityUnit === "watt" ? "text-amber-950 drop-shadow-sm" : "text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.4)]"}`}
                aria-hidden
              />
              W
            </button>
            <button
              type="button"
              onClick={() => setIntensityUnit("hr")}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                intensityUnit === "hr" ? "bg-gradient-to-r from-rose-500 to-pink-500 text-white" : "text-gray-400"
              }`}
            >
              <Heart
                className={`h-3.5 w-3.5 ${intensityUnit === "hr" ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.35)]" : "text-rose-400 drop-shadow-[0_0_6px_rgba(251,113,133,0.45)]"}`}
                aria-hidden
              />
              FC
            </button>
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-400">
            <span className="w-14 shrink-0">FTP</span>
            <input
              type="number"
              min={50}
              max={600}
              className="w-20 rounded-lg border border-white/20 bg-black/50 px-2 py-1.5 text-sm font-mono text-white"
              value={ftpW}
              onChange={(e) => setFtpW(Number(e.target.value))}
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-400">
            <span className="w-14 shrink-0">FC max</span>
            <input
              type="number"
              min={120}
              max={220}
              className="w-20 rounded-lg border border-white/20 bg-black/50 px-2 py-1.5 text-sm font-mono text-white"
              value={hrMax}
              onChange={(e) => setHrMax(Number(e.target.value))}
            />
          </label>
          <label className="ml-auto flex min-w-[8rem] flex-1 flex-col gap-1 text-[0.65rem] text-gray-500 sm:max-w-xs">
            Nome sessione
            <input
              type="text"
              className="rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-sm text-white"
              value={manualSessionName}
              onChange={(e) => setManualSessionName(e.target.value)}
            />
          </label>
        </div>

      {showAerobicDistance ? (
        <div className="mt-2 flex flex-wrap gap-2 text-[0.65rem] text-gray-500">
          <span>
            Durata:{" "}
            <button
              type="button"
              className={lengthMode === "time" ? "text-cyan-300 underline" : ""}
              onClick={() => setLengthMode("time")}
            >
              tempo
            </button>
            {" · "}
            <button
              type="button"
              className={lengthMode === "distance" ? "text-cyan-300 underline" : ""}
              onClick={() => setLengthMode("distance")}
            >
              distanza
            </button>
          </span>
          <span className="text-gray-600">|</span>
          <label className="flex items-center gap-1">
            Vel. ref km/h
            <input
              type="number"
              min={5}
              max={60}
              className="w-14 rounded border border-white/15 bg-black/40 px-1 py-0.5 text-gray-200"
              value={speedRefKmh}
              onChange={(e) => setSpeedRefKmh(Number(e.target.value))}
            />
          </label>
        </div>
      ) : (
        <p className="mt-2 text-[0.65rem] text-gray-600">
          Blocchi su tempo; distanza riservata al settore A · Aerobico. La durata sul calendario è quella impostata sopra il grafico.
        </p>
      )}

      {/* Navigazione blocchi */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button type="button" className={btnIcon} onClick={goPrev} disabled={safeIndex <= 0} aria-label="Blocco precedente">
            <ChevronLeft className="h-5 w-5 text-sky-400 drop-shadow-[0_0_6px_rgba(56,189,248,0.35)]" />
          </button>
          <span className="min-w-[7rem] text-center text-sm font-mono text-gray-300">
            Blocco {safeIndex + 1} / {manualPlanBlocks.length}
          </span>
          <button
            type="button"
            className={btnIcon}
            onClick={goNext}
            disabled={safeIndex >= manualPlanBlocks.length - 1}
            aria-label="Blocco successivo"
          >
            <ChevronRight className="h-5 w-5 text-sky-400 drop-shadow-[0_0_6px_rgba(56,189,248,0.35)]" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className={`${btnIcon} border-emerald-500/40 bg-emerald-500/20`} onClick={addBlock} aria-label="Aggiungi blocco">
            <Plus className="h-5 w-5 text-emerald-200" />
          </button>
          <button
            type="button"
            className={`${btnIcon} border-rose-500/40 bg-rose-500/15`}
            onClick={removeBlock}
            disabled={manualPlanBlocks.length <= 1}
            aria-label="Elimina blocco"
          >
            <Trash2 className="h-5 w-5 text-rose-200" />
          </button>
        </div>
      </div>

      {/* Un solo pannello blocco */}
      <div className="mt-4 rounded-2xl border border-white/15 bg-black/40 p-4">
        <input
          type="text"
          className="mb-3 w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-base font-semibold text-white"
          value={row.label}
          onChange={(e) => patch({ label: e.target.value })}
          placeholder="Nome blocco"
        />

        <p className="text-[0.65rem] font-bold uppercase tracking-wider text-gray-500">Tipo</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {kindMetaList.map(({ kind, label, icon: Icon, color, iconClass }) => {
            const on = row.kind === kind;
            return (
              <button
                key={kind}
                type="button"
                onClick={() => setKind(kind)}
                className={`flex flex-1 min-w-[5.5rem] flex-col items-center gap-1 rounded-xl border-2 px-2 py-2.5 text-[0.7rem] font-bold transition sm:min-w-[6rem] ${
                  on ? "border-white text-white shadow-lg scale-[1.02]" : "border-white/10 text-gray-300 opacity-80 hover:opacity-100"
                } bg-gradient-to-br ${color}`}
              >
                <Icon className={`h-5 w-5 ${iconClass}`} aria-hidden />
                {label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
          {(row.kind === "steady" || row.kind === "ramp") && lengthMode === "time" ? (
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-black/50 px-2 py-2">
                <button type="button" className="rounded-lg bg-white/10 px-2 py-1 text-lg" onClick={() => patch({ minutes: Math.max(0, row.minutes - 1) })}>
                  −
                </button>
                <div className="text-center">
                  <p className="text-[0.6rem] text-gray-500">Min</p>
                  <p className="font-mono text-xl text-white">{row.minutes}</p>
                </div>
                <button type="button" className="rounded-lg bg-white/10 px-2 py-1 text-lg" onClick={() => patch({ minutes: row.minutes + 1 })}>
                  +
                </button>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-black/50 px-2 py-2">
                <button
                  type="button"
                  className="rounded-lg bg-white/10 px-2 py-1 text-lg"
                  onClick={() => patch({ seconds: Math.max(0, row.seconds - 5) })}
                >
                  −
                </button>
                <div className="text-center">
                  <p className="text-[0.6rem] text-gray-500">Sec</p>
                  <p className="font-mono text-xl text-white">{row.seconds}</p>
                </div>
                <button
                  type="button"
                  className="rounded-lg bg-white/10 px-2 py-1 text-lg"
                  onClick={() => patch({ seconds: Math.min(59, row.seconds + 5) })}
                >
                  +
                </button>
              </div>
            </div>
          ) : null}

          {(row.kind === "steady" || row.kind === "ramp" || row.kind === "pyramid") && showAerobicDistance && lengthMode === "distance" ? (
            <label className="flex max-w-xs flex-col gap-1 text-xs text-gray-500">
              Distanza (km)
              <input
                type="number"
                step="0.1"
                min={0.1}
                className="rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-white"
                value={row.distanceKm}
                onChange={(e) => patch({ distanceKm: Number(e.target.value) })}
              />
            </label>
          ) : null}

          {row.kind === "steady" ? (
            <ZoneStrip
              label="Zona principale"
              value={row.intensity}
              onPick={(z) => patch({ intensity: z })}
              unit={intensityUnit}
              ftpW={ftp}
              hrMax={hr}
            />
          ) : null}

          {row.kind === "ramp" ? (
            <div className="space-y-3">
              <ZoneStrip
                label="Partenza"
                value={row.startIntensity}
                onPick={(z) => patch({ startIntensity: z })}
                unit={intensityUnit}
                ftpW={ftp}
                hrMax={hr}
              />
              <ZoneStrip
                label="Arrivo"
                value={row.endIntensity}
                onPick={(z) => patch({ endIntensity: z })}
                unit={intensityUnit}
                ftpW={ftp}
                hrMax={hr}
              />
            </div>
          ) : null}

          {row.kind === "interval2" ? (
            <div className="space-y-3">
              <ZoneStrip
                label="Lavoro"
                value={row.intensity}
                onPick={(z) => patch({ intensity: z })}
                unit={intensityUnit}
                ftpW={ftp}
                hrMax={hr}
              />
              <ZoneStrip
                label="Recupero"
                value={row.intensity2}
                onPick={(z) => patch({ intensity2: z })}
                unit={intensityUnit}
                ftpW={ftp}
                hrMax={hr}
              />
              <div className="flex flex-wrap gap-3">
                <label className="text-xs text-gray-500">
                  Ripetute
                  <input
                    type="number"
                    min={1}
                    className="ml-2 w-16 rounded-lg border border-white/15 bg-black/50 px-2 py-1 text-white"
                    value={row.repeats}
                    onChange={(e) => patch({ repeats: Number(e.target.value) })}
                  />
                </label>
                <label className="text-xs text-gray-500">
                  Work (s)
                  <input
                    type="number"
                    min={10}
                    className="ml-2 w-16 rounded-lg border border-white/15 bg-black/50 px-2 py-1 text-white"
                    value={row.workSeconds}
                    onChange={(e) => patch({ workSeconds: Number(e.target.value) })}
                  />
                </label>
                <label className="text-xs text-gray-500">
                  Rec (s)
                  <input
                    type="number"
                    min={10}
                    className="ml-2 w-16 rounded-lg border border-white/15 bg-black/50 px-2 py-1 text-white"
                    value={row.recoverSeconds}
                    onChange={(e) => patch({ recoverSeconds: Number(e.target.value) })}
                  />
                </label>
              </div>
            </div>
          ) : null}

          {row.kind === "interval3" ? (
            <div className="space-y-3">
              <ZoneStrip
                label="Tempo A"
                value={row.intensity}
                onPick={(z) => patch({ intensity: z })}
                unit={intensityUnit}
                ftpW={ftp}
                hrMax={hr}
              />
              <ZoneStrip
                label="Tempo B"
                value={row.intensity2}
                onPick={(z) => patch({ intensity2: z })}
                unit={intensityUnit}
                ftpW={ftp}
                hrMax={hr}
              />
              <ZoneStrip
                label="Tempo C"
                value={row.intensity3}
                onPick={(z) => patch({ intensity3: z })}
                unit={intensityUnit}
                ftpW={ftp}
                hrMax={hr}
              />
              <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                <label>
                  Serie
                  <input
                    type="number"
                    min={1}
                    className="ml-2 w-14 rounded border border-white/15 bg-black/50 px-1 py-1 text-white"
                    value={row.repeats}
                    onChange={(e) => patch({ repeats: Number(e.target.value) })}
                  />
                </label>
                <label>
                  A (s)
                  <input
                    type="number"
                    min={10}
                    className="ml-2 w-14 rounded border border-white/15 bg-black/50 px-1 py-1 text-white"
                    value={row.step1Seconds}
                    onChange={(e) => patch({ step1Seconds: Number(e.target.value) })}
                  />
                </label>
                <label>
                  B (s)
                  <input
                    type="number"
                    min={10}
                    className="ml-2 w-14 rounded border border-white/15 bg-black/50 px-1 py-1 text-white"
                    value={row.step2Seconds}
                    onChange={(e) => patch({ step2Seconds: Number(e.target.value) })}
                  />
                </label>
                <label>
                  C (s)
                  <input
                    type="number"
                    min={10}
                    className="ml-2 w-14 rounded border border-white/15 bg-black/50 px-1 py-1 text-white"
                    value={row.step3Seconds}
                    onChange={(e) => patch({ step3Seconds: Number(e.target.value) })}
                  />
                </label>
              </div>
            </div>
          ) : null}

          {row.kind === "pyramid" ? (
            <div className="space-y-2">
              <p className="flex flex-col gap-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-gray-500 sm:flex-row sm:items-center sm:gap-2">
                <span className="inline-flex items-center gap-2">
                  <Mountain className="h-4 w-4 text-rose-300 drop-shadow-[0_0_8px_rgba(251,113,133,0.45)]" aria-hidden />
                  Piramide
                </span>
                <span className="font-mono text-[0.58rem] font-normal normal-case text-gray-600">
                  Δ scalino = (fine − inizio) / scalini · ultimo = fine
                </span>
              </p>
              <div className="flex flex-wrap gap-3">
                <GenerativeStepperPod
                  icon={Layers}
                  label="Scalini"
                  value={row.pyramidSteps}
                  onChange={(n) => patch({ pyramidSteps: n })}
                  min={1}
                  max={30}
                  step={1}
                  borderClass="border-rose-500/40"
                  bgClass="bg-rose-500/10"
                  iconClass="text-rose-300"
                />
                <GenerativeStepperPod
                  icon={Timer}
                  label="Sec / scalino"
                  value={row.pyramidStepSeconds}
                  onChange={(n) => patch({ pyramidStepSeconds: n })}
                  min={20}
                  max={900}
                  step={10}
                  borderClass="border-cyan-500/40"
                  bgClass="bg-cyan-500/10"
                  iconClass="text-cyan-300"
                />
                <GenerativeStepperPod
                  icon={intensityUnit === "watt" ? Zap : Heart}
                  label={`Start (${intensityUnit === "watt" ? "W" : "bpm"})`}
                  value={row.pyramidStartTarget}
                  onChange={(n) => patch({ pyramidStartTarget: n })}
                  min={intensityUnit === "watt" ? 50 : 90}
                  max={intensityUnit === "watt" ? 600 : 220}
                  step={intensityUnit === "watt" ? 5 : 1}
                  borderClass="border-amber-500/40"
                  bgClass="bg-amber-500/10"
                  iconClass="text-amber-300"
                />
                <GenerativeStepperPod
                  icon={TrendingUp}
                  label={`End (${intensityUnit === "watt" ? "W" : "bpm"})`}
                  value={row.pyramidEndTarget}
                  onChange={(n) => patch({ pyramidEndTarget: n })}
                  min={intensityUnit === "watt" ? 50 : 90}
                  max={intensityUnit === "watt" ? 600 : 220}
                  step={intensityUnit === "watt" ? 5 : 1}
                  borderClass="border-violet-500/40"
                  bgClass="bg-violet-500/10"
                  iconClass="text-violet-300"
                />
              </div>
            </div>
          ) : null}

          <div className={`flex flex-wrap items-end gap-3 ${!showCadenceRow ? "hidden" : ""}`}>
            <div className="space-y-1.5">
              <p className="text-[0.65rem] font-bold uppercase tracking-wider text-gray-500">Cadenza</p>
              <div className="flex rounded-full border border-white/15 bg-black/50 p-0.5">
                <button
                  type="button"
                  onClick={() => patch({ cadenceMetric: "none" })}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                    row.cadenceMetric === "none" ? "bg-white/15 text-white" : "text-gray-500"
                  }`}
                >
                  —
                </button>
                <button
                  type="button"
                  onClick={() => patch({ cadenceMetric: "rpm" })}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                    row.cadenceMetric === "rpm"
                      ? "bg-gradient-to-r from-teal-500 to-cyan-500 text-black"
                      : "text-gray-400"
                  }`}
                >
                  <Gauge
                    className={`h-3.5 w-3.5 ${row.cadenceMetric === "rpm" ? "text-teal-950" : "text-teal-400 drop-shadow-[0_0_6px_rgba(45,212,191,0.4)]"}`}
                    aria-hidden
                  />
                  RPM
                </button>
                <button
                  type="button"
                  onClick={() => patch({ cadenceMetric: "spm" })}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                    row.cadenceMetric === "spm"
                      ? "bg-gradient-to-r from-lime-500 to-emerald-500 text-black"
                      : "text-gray-400"
                  }`}
                >
                  <Footprints
                    className={`h-3.5 w-3.5 ${row.cadenceMetric === "spm" ? "text-lime-950" : "text-lime-400 drop-shadow-[0_0_6px_rgba(163,230,53,0.4)]"}`}
                    aria-hidden
                  />
                  SPM
                </button>
              </div>
            </div>
            <label className={`flex items-center gap-2 text-xs text-gray-400 ${row.cadenceMetric === "none" ? "opacity-40" : ""}`}>
              <span className="w-10 shrink-0">Min</span>
              <input
                type="number"
                min={30}
                max={220}
                disabled={row.cadenceMetric === "none"}
                className="w-20 rounded-lg border border-white/20 bg-black/50 px-2 py-1.5 text-sm font-mono text-white disabled:cursor-not-allowed"
                value={row.cadenceMin}
                onChange={(e) => patch({ cadenceMin: Number(e.target.value) })}
              />
            </label>
            <label className={`flex items-center gap-2 text-xs text-gray-400 ${row.cadenceMetric === "none" ? "opacity-40" : ""}`}>
              <span className="w-10 shrink-0">Max</span>
              <input
                type="number"
                min={30}
                max={240}
                disabled={row.cadenceMetric === "none"}
                className="w-20 rounded-lg border border-white/20 bg-black/50 px-2 py-1.5 text-sm font-mono text-white disabled:cursor-not-allowed"
                value={row.cadenceMax}
                onChange={(e) => patch({ cadenceMax: Number(e.target.value) })}
              />
            </label>
          </div>
          {macroFamily === "technical" ? (
            <details className="mt-3 rounded-lg border border-white/10 bg-black/25">
              <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-gray-400">
                Note e moltiplicatore carico (opzionale)
              </summary>
              <div className="space-y-3 border-t border-white/10 px-3 pb-3 pt-3">
                <label className="flex flex-col gap-1 text-xs text-gray-500">
                  Note esecuzione
                  <textarea
                    rows={2}
                    className="rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-sm text-white"
                    value={row.notes}
                    onChange={(e) => patch({ notes: e.target.value })}
                  />
                </label>
                <label className="flex max-w-xs flex-col gap-1 text-xs text-gray-500">
                  Moltiplicatore carico (motore, opz.)
                  <input
                    type="number"
                    step="0.05"
                    min={0.3}
                    max={2}
                    className="rounded-lg border border-white/15 bg-black/50 px-2 py-1.5 text-white"
                    value={row.loadFactor}
                    onChange={(e) => patch({ loadFactor: Number(e.target.value) })}
                  />
                </label>
              </div>
            </details>
          ) : (
            <>
              <label className="flex flex-col gap-1 text-xs text-gray-500">
                Note esecuzione
                <textarea
                  rows={2}
                  className="rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-sm text-white"
                  value={row.notes}
                  onChange={(e) => patch({ notes: e.target.value })}
                />
              </label>
              <label className="flex max-w-xs flex-col gap-1 text-xs text-gray-500">
                Moltiplicatore carico (motore, opz.)
                <input
                  type="number"
                  step="0.05"
                  min={0.3}
                  max={2}
                  className="rounded-lg border border-white/15 bg-black/50 px-2 py-1.5 text-white"
                  value={row.loadFactor}
                  onChange={(e) => patch({ loadFactor: Number(e.target.value) })}
                />
              </label>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-white/10 pt-4">
        <label className="flex flex-col gap-1 text-xs text-gray-500">
          Data
          <input
            type="date"
            className="rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
            value={manualPlannedDate}
            onChange={(e) => setManualPlannedDate(e.target.value)}
          />
        </label>
        <button
          type="button"
          className={btnPrimary}
          disabled={!athleteId || !canSave || manualSaveBusy}
          onClick={() => onSaveManual()}
        >
          {manualSaveBusy ? "Salvataggio…" : "Salva nel calendario"}
        </button>
      </div>
      {manualSaveErr ? (
        <p className="mt-3 text-sm text-amber-300" role="alert">
          {manualSaveErr}
        </p>
      ) : null}
      {manualSaveOkId ? (
        <p className="mt-3 text-sm text-emerald-300/90">
          Salvato con dettaglio builder in notes
          {manualSaveOkId !== "ok" ? ` (id ${manualSaveOkId.slice(0, 8)}…)` : ""}.
        </p>
      ) : null}
    </section>
  );
}
