"use client";

import { FileText, Plus, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LifestylePracticeMediaThumb } from "@/components/training/LifestylePracticeMediaThumb";
import { SessionBlockIntensityChart } from "@/components/training/SessionBlockIntensityChart";
import { lifestyleV1FallbackImageForCategory } from "@/lib/training/builder/lifestyle-media";
import {
  defaultPro2LifestyleManualRow,
  rowFromLifestylePlaybookEntry,
  type Pro2LifestyleManualRow,
} from "@/lib/training/builder/pro2-lifestyle-manual-plan";
import {
  getLifestylePlaybookForSport,
  lifestyleCategoryLabel,
  type LifestylePlaybookEntry,
  type LifestylePracticeCategory,
} from "@/lib/training/builder/lifestyle-playbook-catalog";
import type { ChartSegment } from "@/lib/training/engine/block-chart-segments";

const SESSION_DURATION_CHOICES = Array.from({ length: 19 }, (_, i) => 30 + i * 5);
const ROUND_CHIP_PRESETS = [1, 2, 3, 4, 5, 6] as const;
const REST_CHIP_PRESETS = [0, 20, 30, 45, 60, 90, 120] as const;
const RPE_CHIP_PRESETS = [3, 4, 5, 6, 7] as const;

const EXECUTION_QUICK_CHIPS: readonly string[] = [
  "Lento controllato",
  "Flusso continuo",
  "Tenute respirate",
  "Tecnica controllata",
  "Micro-movimento",
];
const BREATH_QUICK_CHIPS: readonly string[] = [
  "Naso 4:6",
  "Naso 5:5",
  "Coerenza 6:6",
  "Box 4-4-4-4",
  "Diaframmatica lenta",
  "Espira in allungamento",
];

const PRACTICE_CATEGORY_OPTIONS: { id: LifestylePracticeCategory; label: string }[] = [
  { id: "yoga", label: "Yoga" },
  { id: "pilates", label: "Pilates" },
  { id: "breath", label: "Respiro" },
  { id: "meditation", label: "Meditazione" },
  { id: "mobility", label: "Mobilità" },
  { id: "stretch", label: "Stretching" },
];

const panelShell =
  "rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-950/55 via-teal-950/25 to-cyan-950/40 shadow-[0_0_40px_-10px_rgba(52,211,153,0.35)]";
const catalogPanel =
  "mt-4 rounded-xl border border-emerald-400/35 bg-gradient-to-br from-emerald-950/35 via-teal-950/15 to-cyan-950/25 p-3";
const chipOff =
  "rounded-full border border-white/15 bg-black/40 px-2.5 py-1 text-[0.65rem] font-bold text-gray-300 transition hover:border-white/25 hover:bg-white/5";
const chipOnCat =
  "rounded-full border border-emerald-300/55 bg-gradient-to-r from-emerald-600/95 to-teal-600/90 px-2.5 py-1 text-[0.65rem] font-bold text-white shadow-md shadow-emerald-600/25";
const chipRxActive =
  "rounded-full border border-teal-300/50 bg-gradient-to-r from-teal-500/90 to-cyan-600/80 px-2 py-1 text-[0.65rem] font-bold text-white shadow-md shadow-teal-500/25";
const chipRxIdle =
  "rounded-full border border-white/12 bg-black/35 px-2 py-1 text-[0.65rem] font-semibold text-gray-400 transition hover:border-teal-400/30 hover:text-teal-100";

const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-lg transition disabled:opacity-40 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-500 hover:brightness-110 border border-white/10 shadow-emerald-500/20";

export type BuilderLifestyleManualComposerProps = {
  athleteId: string | null;
  physioHint: string | null;
  lifestyleRows: Pro2LifestyleManualRow[];
  setLifestyleRows: React.Dispatch<React.SetStateAction<Pro2LifestyleManualRow[]>>;
  manualSessionName: string;
  setManualSessionName: React.Dispatch<React.SetStateAction<string>>;
  manualChartSegments: ChartSegment[];
  manualPlannedDate: string;
  setManualPlannedDate: React.Dispatch<React.SetStateAction<string>>;
  manualSessionDurationMinutes: number;
  setManualSessionDurationMinutes: React.Dispatch<React.SetStateAction<number>>;
  /** Chiave palette: yoga | pilates | meditation | breathwork | mobility | stretching */
  paletteSport: string;
  currentSportLabel: string;
  manualSaveBusy: boolean;
  onSaveManual: () => void;
  manualSaveErr: string | null;
  manualSaveOkId: string | null;
  canSave: boolean;
  estimatedTss: number;
};

export function BuilderLifestyleManualComposer({
  athleteId,
  physioHint,
  lifestyleRows,
  setLifestyleRows,
  manualSessionName,
  setManualSessionName,
  manualChartSegments,
  manualPlannedDate,
  setManualPlannedDate,
  manualSessionDurationMinutes,
  setManualSessionDurationMinutes,
  paletteSport,
  currentSportLabel,
  manualSaveBusy,
  onSaveManual,
  manualSaveErr,
  manualSaveOkId,
  canSave,
  estimatedTss,
}: BuilderLifestyleManualComposerProps) {
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState<LifestylePracticeCategory | "">("");
  const [selectedPlaybookId, setSelectedPlaybookId] = useState<string>("");
  const [extraNotesOpen, setExtraNotesOpen] = useState<Record<string, boolean>>({});

  const playbookForSport = useMemo(() => getLifestylePlaybookForSport(paletteSport), [paletteSport]);

  const visiblePlaybook = useMemo(() => {
    if (!catalogCategoryFilter) return playbookForSport;
    return playbookForSport.filter((e) => e.practiceCategory === catalogCategoryFilter);
  }, [playbookForSport, catalogCategoryFilter]);

  useEffect(() => {
    if (selectedPlaybookId && !visiblePlaybook.some((e) => e.id === selectedPlaybookId)) {
      setSelectedPlaybookId("");
    }
  }, [visiblePlaybook, selectedPlaybookId]);

  const structureMinutesFromChart = useMemo(
    () => Math.max(0, Math.round(manualChartSegments.reduce((s, seg) => s + seg.durationSeconds, 0) / 60)),
    [manualChartSegments],
  );

  const updateRow = (id: string, partial: Partial<Pro2LifestyleManualRow>) => {
    setLifestyleRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...partial } : r)));
  };

  const removeRow = (id: string) => {
    setLifestyleRows((prev) => prev.filter((r) => r.id !== id));
  };

  const addFromPlaybook = (entry: LifestylePlaybookEntry) => {
    setLifestyleRows((prev) => [...prev, rowFromLifestylePlaybookEntry(entry)]);
  };

  const addEmptyRow = () => {
    setLifestyleRows((prev) => [...prev, defaultPro2LifestyleManualRow({ practiceCategory: catalogCategoryFilter || "mobility" })]);
  };

  const selectedEntry = visiblePlaybook.find((e) => e.id === selectedPlaybookId) ?? null;

  return (
    <section aria-label="Builder manuale scheda lifestyle" className={`p-4 sm:p-6 ${panelShell}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="bg-gradient-to-r from-emerald-200 via-teal-200 to-cyan-200 bg-clip-text text-lg font-bold text-transparent">
            Manuale · Scheda lifestyle
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-gray-400">
            Stessa logica della scheda Gym: righe prescrittive con catalogo per{" "}
            <span className="font-semibold text-emerald-300">{currentSportLabel}</span> (playbook macro D), filtri per categoria di
            pratica, chip round / tenuta-respiro / recupero / RPE — niente blocchi watt/FC.
          </p>
        </div>
        {physioHint ? (
          <span className="rounded-full border border-cyan-500/40 bg-cyan-500/15 px-3 py-1 text-[0.65rem] font-medium text-cyan-200">
            {physioHint}
          </span>
        ) : null}
      </div>

      <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-black/45 p-3 shadow-inner">
        <SessionBlockIntensityChart segments={manualChartSegments} title="Anteprima sessione (proxy tempo)" estimatedTss={estimatedTss} />
        <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-emerald-500/20 bg-gradient-to-r from-emerald-950/40 to-teal-950/25 px-3 py-2.5">
          <label className="flex flex-col gap-1 text-[0.65rem] text-gray-400">
            <span className="font-bold uppercase tracking-wider text-emerald-200/90">Durata nel calendario</span>
            <select
              className="min-w-[7.5rem] rounded-lg border border-emerald-500/30 bg-black/50 px-2 py-2 text-sm font-mono text-white"
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
            Tempo stimato dal grafico: <span className="font-mono font-semibold text-teal-200/90">~{structureMinutesFromChart} min</span>.
            Il calendario usa la durata selezionata.
          </p>
        </div>
      </div>

      <div className={catalogPanel}>
        <p className="mb-2 flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-wider text-emerald-200">
          <Sparkles className="h-3.5 w-3.5 text-cyan-300" aria-hidden />
          Playbook pratiche · filtra per categoria
        </p>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className={catalogCategoryFilter === "" ? chipOnCat : chipOff}
            onClick={() => setCatalogCategoryFilter("")}
          >
            Tutte
          </button>
          {PRACTICE_CATEGORY_OPTIONS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={catalogCategoryFilter === c.id ? chipOnCat : chipOff}
              onClick={() => setCatalogCategoryFilter((prev) => (prev === c.id ? "" : c.id))}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div className="max-h-[14rem] overflow-y-auto rounded-lg border border-white/10 bg-black/45 p-1">
            {visiblePlaybook.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-gray-500">Nessuna voce in questa selezione.</p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {visiblePlaybook.map((e) => {
                  const sel = selectedPlaybookId === e.id;
                  return (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedPlaybookId(e.id)}
                        className={`flex w-full flex-col rounded-md px-2 py-1.5 text-left text-xs transition ${
                          sel
                            ? "bg-gradient-to-r from-emerald-600/50 to-teal-600/40 text-white ring-1 ring-emerald-300/45"
                            : "text-gray-300 hover:bg-white/10"
                        }`}
                      >
                        <span className="font-semibold leading-snug">{e.name}</span>
                        <span className="text-[0.6rem] text-gray-500">
                          {lifestyleCategoryLabel(e.practiceCategory)} · {e.brief}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="flex flex-col justify-between rounded-lg border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 to-teal-950/20 p-3">
            {selectedEntry ? (
              <>
                <div className="flex gap-3">
                  <LifestylePracticeMediaThumb
                    src={null}
                    practiceCategory={selectedEntry.practiceCategory}
                    alt={selectedEntry.name}
                    playbookItemId={selectedEntry.id}
                    fallbackLabel={selectedEntry.name}
                    className="h-24 w-24 shrink-0 rounded-xl border border-emerald-400/25"
                  />
                  <div className="min-w-0">
                    <p className="text-[0.65rem] font-bold uppercase tracking-wider text-emerald-300/80">Selezionato</p>
                    <p className="mt-1 text-sm font-bold text-white">{selectedEntry.name}</p>
                    <p className="mt-1 text-[0.65rem] text-gray-500">{selectedEntry.brief}</p>
                    <p className="mt-1 text-[0.55rem] text-emerald-500/80">
                      Anteprima V1:{" "}
                      <span className="font-mono text-emerald-400/90">
                        {lifestyleV1FallbackImageForCategory(selectedEntry.practiceCategory)}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  <button
                    type="button"
                    className="w-full rounded-xl border border-teal-400/45 bg-gradient-to-r from-emerald-600 to-teal-500 py-2.5 text-sm font-bold text-white shadow-lg shadow-teal-500/20 transition hover:brightness-110"
                    onClick={() => addFromPlaybook(selectedEntry)}
                  >
                    <Plus className="mr-1 inline h-4 w-4 align-text-bottom" aria-hidden />
                    Aggiungi alla scheda
                  </button>
                  <button
                    type="button"
                    className="w-full rounded-xl border border-white/15 bg-black/40 py-2 text-xs font-semibold text-gray-300 hover:border-emerald-400/35 hover:text-white"
                    onClick={addEmptyRow}
                  >
                    + Riga libera (nome e prescrizione manuali)
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-gray-500">Seleziona una pratica dalla lista oppure aggiungi una riga vuota.</p>
                <button
                  type="button"
                  className="rounded-xl border border-teal-400/40 bg-teal-600/25 py-2.5 text-sm font-bold text-teal-100 hover:bg-teal-600/35"
                  onClick={addEmptyRow}
                >
                  <Plus className="mr-1 inline h-4 w-4 align-text-bottom" aria-hidden />
                  Riga libera
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-emerald-500/25 bg-black/35 p-3">
        <label className="flex max-w-xl flex-col gap-1 text-[0.65rem] text-gray-400">
          Nome sessione
          <input
            type="text"
            className="rounded-lg border border-emerald-400/30 bg-black/50 px-2 py-2 text-sm text-white"
            value={manualSessionName}
            onChange={(e) => setManualSessionName(e.target.value)}
          />
        </label>
      </div>

      <div className="mt-4 space-y-3">
        <p className="text-[0.65rem] font-bold uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300">
          Scheda · {lifestyleRows.length} pratiche
        </p>
        {lifestyleRows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-emerald-500/30 bg-emerald-950/20 px-4 py-8 text-center text-sm text-gray-500">
            Aggiungi voci dal playbook o righe libere. Output: seduta <span className="text-emerald-300">flow / recovery</span> nel
            motore.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {lifestyleRows.map((row) => (
              <li
                key={row.id}
                className="rounded-2xl border border-emerald-400/35 bg-gradient-to-br from-emerald-950/40 via-teal-950/15 to-cyan-950/25 p-4 shadow-inner shadow-emerald-950/40"
              >
                <div className="mb-3 flex gap-3">
                  <div className="relative h-28 w-28 shrink-0">
                    <LifestylePracticeMediaThumb
                      src={row.mediaUrl}
                      practiceCategory={row.practiceCategory}
                      alt={row.name}
                      playbookItemId={row.playbookItemId}
                      fallbackLabel={row.name}
                      className="h-full w-full rounded-xl border border-emerald-400/25"
                    />
                    <span className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-xl bg-black/65 px-1 py-0.5 text-center text-[0.55rem] font-bold uppercase tracking-wide text-emerald-100/95">
                      {lifestyleCategoryLabel(row.practiceCategory)}
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <input
                        type="text"
                        className="min-w-[10rem] flex-1 rounded-lg border border-emerald-400/35 bg-black/45 px-3 py-2 text-base font-semibold text-white"
                        value={row.name}
                        onChange={(e) => updateRow(row.id, { name: e.target.value })}
                      />
                      <button
                        type="button"
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-500/40 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25"
                        onClick={() => removeRow(row.id)}
                        aria-label="Rimuovi pratica"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <label className="flex max-w-xs flex-col gap-1 text-[0.65rem] text-gray-500">
                      Categoria (prescrizione)
                      <select
                        className="rounded-lg border border-emerald-400/30 bg-black/50 px-2 py-2 text-sm text-white"
                        value={row.practiceCategory}
                        onChange={(e) => updateRow(row.id, { practiceCategory: e.target.value as LifestylePracticeCategory })}
                      >
                        {PRACTICE_CATEGORY_OPTIONS.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex max-w-lg flex-col gap-1 text-[0.65rem] text-gray-500">
                      Immagine · URL (opzionale)
                      <input
                        type="url"
                        inputMode="url"
                        autoComplete="off"
                        placeholder="https://… oppure scena Spline (in arrivo)"
                        className="rounded-lg border border-teal-400/25 bg-black/50 px-2 py-2 text-sm text-white placeholder:text-gray-600"
                        value={row.mediaUrl ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          updateRow(row.id, { mediaUrl: v === "" ? undefined : v });
                        }}
                      />
                      <span className="text-[0.55rem] leading-snug text-gray-600">
                        Se vuoto: stesso master SVG Vyria V1 usato in palestra (<span className="font-mono text-gray-500">{lifestyleV1FallbackImageForCategory(row.practiceCategory)}</span>
                        ). Galleria dedicata + Spline: prossimo step.
                      </span>
                    </label>
                  </div>
                </div>

                <div className="space-y-2 border-t border-white/10 pt-3">
                  <p className="text-[0.6rem] font-bold uppercase tracking-wider text-emerald-300/90">Round / cicli</p>
                  <div className="flex flex-wrap gap-1">
                    {ROUND_CHIP_PRESETS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={row.rounds === n ? chipRxActive : chipRxIdle}
                        onClick={() => updateRow(row.id, { rounds: n })}
                      >
                        {n}
                      </button>
                    ))}
                    <input
                      type="number"
                      min={1}
                      aria-label="Round personalizzati"
                      className="w-14 rounded-full border border-white/15 bg-black/50 px-2 py-1 text-center text-[0.65rem] font-mono text-white"
                      value={row.rounds}
                      onChange={(e) => updateRow(row.id, { rounds: Math.max(1, Number(e.target.value) || 1) })}
                    />
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  <p className="text-[0.6rem] font-bold uppercase tracking-wider text-teal-300/90">Tenute / respiri / durata</p>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
                    value={row.holdOrReps}
                    onChange={(e) => updateRow(row.id, { holdOrReps: e.target.value })}
                    placeholder="es. 90s tenuta · 5 respiri"
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-3">
                  <div className="min-w-[8rem] flex-1 space-y-2">
                    <p className="text-[0.6rem] font-bold uppercase tracking-wider text-cyan-200/90">Recupero (s)</p>
                    <div className="flex flex-wrap gap-1">
                      {REST_CHIP_PRESETS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          className={row.restSec === s ? chipRxActive : chipRxIdle}
                          onClick={() => updateRow(row.id, { restSec: s })}
                        >
                          {s}s
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      min={0}
                      className="w-full max-w-[6rem] rounded-lg border border-white/15 bg-black/50 px-2 py-1.5 text-[0.7rem] font-mono text-white"
                      value={row.restSec}
                      onChange={(e) => updateRow(row.id, { restSec: Math.max(0, Number(e.target.value) || 0) })}
                    />
                  </div>
                  <div className="min-w-[8rem] flex-1 space-y-2">
                    <p className="text-[0.6rem] font-bold uppercase tracking-wider text-emerald-200/90">RPE (opz.)</p>
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        className={row.rpe == null ? chipRxActive : chipRxIdle}
                        onClick={() => updateRow(row.id, { rpe: null })}
                      >
                        —
                      </button>
                      {RPE_CHIP_PRESETS.map((r) => (
                        <button
                          key={r}
                          type="button"
                          className={row.rpe === r ? chipRxActive : chipRxIdle}
                          onClick={() => updateRow(row.id, { rpe: r })}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  <p className="text-[0.6rem] font-bold uppercase tracking-wider text-teal-200/90">Schema respiratorio · scorciatoie</p>
                  <div className="flex flex-wrap gap-1">
                    {BREATH_QUICK_CHIPS.map((label) => (
                      <button
                        key={label}
                        type="button"
                        className={row.breathPattern === label ? chipRxActive : chipRxIdle}
                        onClick={() => updateRow(row.id, { breathPattern: label })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-sm text-white"
                    placeholder="Altro schema…"
                    value={row.breathPattern}
                    onChange={(e) => updateRow(row.id, { breathPattern: e.target.value })}
                  />
                </div>

                <div className="mt-3 space-y-2">
                  <p className="text-[0.6rem] font-bold uppercase tracking-wider text-cyan-200/90">Stile esecuzione · scorciatoie</p>
                  <div className="flex flex-wrap gap-1">
                    {EXECUTION_QUICK_CHIPS.map((label) => (
                      <button
                        key={label}
                        type="button"
                        className={row.executionStyle === label ? chipRxActive : chipRxIdle}
                        onClick={() => updateRow(row.id, { executionStyle: label })}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-sm text-white"
                    placeholder="Esecuzione personalizzata…"
                    value={row.executionStyle}
                    onChange={(e) => updateRow(row.id, { executionStyle: e.target.value })}
                  />
                </div>

                <div className="mt-3 space-y-2">
                  <p className="text-[0.6rem] font-bold uppercase tracking-wider text-emerald-200/90">Blocco / circuito</p>
                  <div className="flex flex-wrap items-center gap-1">
                    {["A", "B", "C", "D"].map((g) => (
                      <button
                        key={g}
                        type="button"
                        className={row.chainLabel === g ? chipRxActive : chipRxIdle}
                        onClick={() => updateRow(row.id, { chainLabel: row.chainLabel === g ? "" : g })}
                      >
                        {g}
                      </button>
                    ))}
                    <input
                      type="text"
                      placeholder="etichetta"
                      className="min-w-[5rem] flex-1 rounded-lg border border-white/15 bg-black/50 px-2 py-1.5 text-[0.7rem] text-white"
                      value={row.chainLabel}
                      onChange={(e) => updateRow(row.id, { chainLabel: e.target.value })}
                    />
                  </div>
                </div>

                <label className="mt-3 flex flex-col gap-1 text-xs text-gray-500">
                  Cue tecnico / attenzione
                  <textarea
                    rows={2}
                    className="rounded-lg border border-white/15 bg-black/50 px-2 py-2 text-sm text-white"
                    value={row.technique}
                    onChange={(e) => updateRow(row.id, { technique: e.target.value })}
                  />
                </label>

                <div className="mt-3">
                  <button
                    type="button"
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[0.7rem] font-bold transition ${
                      extraNotesOpen[row.id]
                        ? "border-cyan-400/50 bg-cyan-500/20 text-cyan-100"
                        : "border-white/15 bg-black/40 text-gray-300 hover:border-cyan-400/35"
                    }`}
                    onClick={() =>
                      setExtraNotesOpen((prev) => ({ ...prev, [row.id]: !prev[row.id] }))
                    }
                  >
                    <FileText className="h-3.5 w-3.5" aria-hidden />
                    Note aggiuntive
                  </button>
                  {extraNotesOpen[row.id] ? (
                    <textarea
                      rows={3}
                      className="mt-2 w-full rounded-lg border border-cyan-400/25 bg-black/50 px-2 py-2 text-sm text-white"
                      placeholder="Note al coach…"
                      value={row.notes}
                      onChange={(e) => updateRow(row.id, { notes: e.target.value })}
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
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
