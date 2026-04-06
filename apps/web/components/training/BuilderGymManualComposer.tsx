"use client";

import { FileText, Plus, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SessionBlockIntensityChart } from "@/components/training/SessionBlockIntensityChart";
import { GymExerciseMediaThumb } from "@/components/training/GymExerciseMediaThumb";
import { PRO2_GYM_EXECUTION_STYLES } from "@/lib/training/builder/gym-execution-styles";
import {
  defaultPro2GymManualRow,
  type Pro2GymManualRow,
} from "@/lib/training/builder/pro2-gym-manual-plan";
import type { Block1MusclePreset } from "@/lib/training/exercise-library/types";
import { pro2PaletteSportToBlock1SportTag } from "@/lib/training/domain-blocks/block1-strength-functional";
import { MuscleDistrictFilterPopover } from "@/components/training/MuscleDistrictFilterPopover";
import {
  fetchUnifiedBuilderExercises,
  type BuilderCatalogExerciseRow,
} from "@/modules/training/services/training-builder-catalog-api";
import type { ChartSegment } from "@/lib/training/engine/block-chart-segments";
import {
  matchesContractionLibraryFilter,
  matchesLibraryEquipmentFilter,
  PRO2_GYM_CONTRACTION_OPTIONS,
  PRO2_GYM_LIBRARY_EQUIPMENT_OPTIONS,
  type Pro2GymContractionPreset,
  type Pro2GymLibraryEquipmentFilter,
} from "@/lib/training/builder/pro2-gym-library-filters";

const SESSION_DURATION_CHOICES = Array.from({ length: 19 }, (_, i) => 30 + i * 5);

const SET_CHIP_PRESETS = [2, 3, 4, 5, 6] as const;
const REP_CHIP_PRESETS = ["5", "6", "8", "10", "12", "15", "20", "AMRAP"] as const;
const PCT_CHIP_PRESETS = [50, 60, 65, 70, 75, 80, 85, 90] as const;
const REST_CHIP_PRESETS = [45, 60, 90, 120, 180] as const;
/** Scorciatoie stile esecuzione (sottoinsieme V1 / Pro 2). */
const EXECUTION_QUICK_CHIPS: readonly string[] = [
  "Lento controllato",
  "Veloce",
  "Isometrico",
  "Pliometrico",
  "Superserie",
  "Serie composte / triset",
];

const panelShell =
  "rounded-2xl border border-fuchsia-500/40 bg-gradient-to-br from-violet-950/55 via-fuchsia-950/25 to-orange-950/40 shadow-[0_0_40px_-10px_rgba(192,38,211,0.35)]";
const catalogPanel =
  "mt-4 rounded-xl border border-violet-400/35 bg-gradient-to-br from-violet-950/35 via-fuchsia-950/15 to-orange-950/25 p-3";
const chipOff =
  "rounded-full border border-white/15 bg-black/40 px-2.5 py-1 text-[0.65rem] font-bold text-gray-300 transition hover:border-white/25 hover:bg-white/5";
const chipOnEquip =
  "rounded-full border border-violet-300/55 bg-gradient-to-r from-violet-600/95 to-fuchsia-600/90 px-2.5 py-1 text-[0.65rem] font-bold text-white shadow-md shadow-violet-600/25";
const chipOnContract =
  "rounded-full border border-fuchsia-300/55 bg-gradient-to-r from-fuchsia-600/95 to-orange-500/85 px-2.5 py-1 text-[0.65rem] font-bold text-white shadow-md shadow-fuchsia-600/20";
const chipRxActive =
  "rounded-full border border-orange-300/50 bg-gradient-to-r from-orange-500/90 to-pink-600/80 px-2 py-1 text-[0.65rem] font-bold text-white shadow-md shadow-orange-500/25";
const chipRxIdle =
  "rounded-full border border-white/12 bg-black/35 px-2 py-1 text-[0.65rem] font-semibold text-gray-400 transition hover:border-orange-400/30 hover:text-orange-100";

const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-lg transition disabled:opacity-40 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-orange-500 hover:brightness-110 border border-white/10 shadow-fuchsia-500/20";

export type BuilderGymManualComposerProps = {
  athleteId: string | null;
  physioHint: string | null;
  gymRows: Pro2GymManualRow[];
  setGymRows: React.Dispatch<React.SetStateAction<Pro2GymManualRow[]>>;
  manualSessionName: string;
  setManualSessionName: React.Dispatch<React.SetStateAction<string>>;
  manualChartSegments: ChartSegment[];
  manualPlannedDate: string;
  setManualPlannedDate: React.Dispatch<React.SetStateAction<string>>;
  manualSessionDurationMinutes: number;
  setManualSessionDurationMinutes: React.Dispatch<React.SetStateAction<number>>;
  /** Chiave sport palette: gym | hyrox | crossfit | powerlifting */
  paletteSport: string;
  currentSportLabel: string;
  manualSaveBusy: boolean;
  onSaveManual: () => void;
  manualSaveErr: string | null;
  manualSaveOkId: string | null;
  canSave: boolean;
  estimatedTss: number;
};

export function BuilderGymManualComposer({
  athleteId,
  physioHint,
  gymRows,
  setGymRows,
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
}: BuilderGymManualComposerProps) {
  const [catalogMuscle, setCatalogMuscle] = useState<Block1MusclePreset | "">("");
  const [libraryEquipment, setLibraryEquipment] = useState<Pro2GymLibraryEquipmentFilter>("");
  const [libraryContraction, setLibraryContraction] = useState<Pro2GymContractionPreset>("");
  const [catalogRows, setCatalogRows] = useState<BuilderCatalogExerciseRow[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogErr, setCatalogErr] = useState<string | null>(null);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>("");
  const [extraNotesOpen, setExtraNotesOpen] = useState<Record<string, boolean>>({});

  const structureMinutesFromChart = useMemo(
    () => Math.max(0, Math.round(manualChartSegments.reduce((s, seg) => s + seg.durationSeconds, 0) / 60)),
    [manualChartSegments],
  );

  useEffect(() => {
    let cancel = false;
    (async () => {
      setCatalogLoading(true);
      setCatalogErr(null);
      const sportTag = pro2PaletteSportToBlock1SportTag(paletteSport);
      const { rows, error } = await fetchUnifiedBuilderExercises({
        sportTag,
        muscle: catalogMuscle || undefined,
        limit: 400,
      });
      if (cancel) return;
      setCatalogRows(rows);
      setCatalogErr(error ?? null);
      setCatalogLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [paletteSport, catalogMuscle]);

  const visibleCatalogRows = useMemo(() => {
    return catalogRows.filter(
      (r) =>
        matchesLibraryEquipmentFilter(r, libraryEquipment) && matchesContractionLibraryFilter(r, libraryContraction),
    );
  }, [catalogRows, libraryEquipment, libraryContraction]);

  useEffect(() => {
    if (selectedCatalogId && !visibleCatalogRows.some((r) => r.id === selectedCatalogId)) {
      setSelectedCatalogId("");
    }
  }, [visibleCatalogRows, selectedCatalogId]);

  const updateRow = (id: string, partial: Partial<Pro2GymManualRow>) => {
    setGymRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...partial } : r)));
  };

  const removeRow = (id: string) => {
    setGymRows((prev) => prev.filter((r) => r.id !== id));
  };

  const addFromCatalog = (row: BuilderCatalogExerciseRow) => {
    setGymRows((prev) => [
      ...prev,
      defaultPro2GymManualRow({
        exerciseId: row.id,
        name: row.name,
        mediaUrl: row.mediaUrl || undefined,
      }),
    ]);
  };

  const selectedExercise = visibleCatalogRows.find((r) => r.id === selectedCatalogId) ?? null;

  return (
    <section aria-label="Builder manuale scheda palestra" className={`p-4 sm:p-6 ${panelShell}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="bg-gradient-to-r from-violet-200 via-fuchsia-200 to-orange-200 bg-clip-text text-lg font-bold text-transparent">
            Manuale · Scheda palestra
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-gray-400">
            Stesso modello di V1: catalogo EMPATHY per disciplina{" "}
            <span className="font-semibold text-fuchsia-300">{currentSportLabel}</span> (tag {pro2PaletteSportToBlock1SportTag(paletteSport)}), filtri su attrezzi e contrazione, poi prescrizione con chip
            serie / %1RM / superserie — senza blocchi watt/FC da endurance.
          </p>
        </div>
        {physioHint ? (
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-[0.65rem] font-medium text-emerald-200">
            {physioHint}
          </span>
        ) : null}
      </div>

      <div className="mt-4 rounded-2xl border border-violet-500/30 bg-black/45 p-3 shadow-inner">
        <SessionBlockIntensityChart segments={manualChartSegments} title="Anteprima sessione (proxy tempo)" estimatedTss={estimatedTss} />
        <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-fuchsia-500/20 bg-gradient-to-r from-violet-950/40 to-orange-950/25 px-3 py-2.5">
          <label className="flex flex-col gap-1 text-[0.65rem] text-gray-400">
            <span className="font-bold uppercase tracking-wider text-fuchsia-200/90">Durata nel calendario</span>
            <select
              className="min-w-[7.5rem] rounded-lg border border-violet-500/30 bg-black/50 px-2 py-2 text-sm font-mono text-white"
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
            Tempo stimato dal grafico: <span className="font-mono font-semibold text-orange-200/90">~{structureMinutesFromChart} min</span>. Il calendario usa la durata selezionata.
          </p>
        </div>
      </div>

      <div className={catalogPanel}>
        <p className="mb-2 flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-wider text-fuchsia-200">
          <Sparkles className="h-3.5 w-3.5 text-orange-300" aria-hidden />
          Catalogo esercizi (V1 · EMPATHY)
        </p>
        <MuscleDistrictFilterPopover value={catalogMuscle} onChange={setCatalogMuscle} />
        <div className="mt-3 space-y-2">
          <p className="text-[0.6rem] font-bold uppercase tracking-wider text-violet-300/90">Attrezzi · filtro libreria</p>
          <div className="flex flex-wrap gap-1.5">
            {PRO2_GYM_LIBRARY_EQUIPMENT_OPTIONS.map((o) => (
              <button
                key={o.value || "all-eq"}
                type="button"
                className={libraryEquipment === o.value ? chipOnEquip : chipOff}
                onClick={() => setLibraryEquipment(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 space-y-2">
          <p className="text-[0.6rem] font-bold uppercase tracking-wider text-orange-200/90">Contrazione · filtro libreria</p>
          <div className="flex flex-wrap gap-1.5">
            {PRO2_GYM_CONTRACTION_OPTIONS.map((o) => (
              <button
                key={o.value || "all-c"}
                type="button"
                className={libraryContraction === o.value ? chipOnContract : chipOff}
                onClick={() => setLibraryContraction(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        {catalogErr ? (
          <p className="mt-2 text-xs text-amber-300" role="alert">
            {catalogErr}
          </p>
        ) : null}
        {catalogLoading ? <p className="mt-2 text-xs text-gray-500">Caricamento catalogo…</p> : null}

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div className="max-h-[14rem] overflow-y-auto rounded-lg border border-white/10 bg-black/45 p-1">
            {visibleCatalogRows.length === 0 && !catalogLoading ? (
              <p className="px-2 py-6 text-center text-xs text-gray-500">Nessun esercizio in questa selezione.</p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {visibleCatalogRows.map((r) => {
                  const sel = selectedCatalogId === r.id;
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedCatalogId(r.id)}
                        className={`flex w-full flex-col rounded-md px-2 py-1.5 text-left text-xs transition ${
                          sel
                            ? "bg-gradient-to-r from-violet-600/50 to-fuchsia-600/40 text-white ring-1 ring-fuchsia-300/45"
                            : "text-gray-300 hover:bg-white/10"
                        }`}
                      >
                        <span className="font-semibold leading-snug">{r.name}</span>
                        <span className="text-[0.6rem] text-gray-500">
                          {r.equipmentClass || "—"}
                          {r.equipment ? ` · ${r.equipment}` : ""}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="flex flex-col justify-between rounded-lg border border-fuchsia-500/30 bg-gradient-to-br from-violet-950/40 to-orange-950/20 p-3">
            {selectedExercise ? (
              <>
                <div className="flex gap-3">
                  <GymExerciseMediaThumb
                    src={selectedExercise.mediaUrl}
                    alt={selectedExercise.name}
                    catalogExerciseId={selectedExercise.id}
                    fallbackLabel={selectedExercise.name}
                    className="h-24 w-24 shrink-0 rounded-xl border border-fuchsia-400/25"
                  />
                  <div className="min-w-0">
                    <p className="text-[0.65rem] font-bold uppercase tracking-wider text-fuchsia-300/80">Selezionato</p>
                    <p className="mt-1 text-sm font-bold text-white">{selectedExercise.name}</p>
                    <p className="mt-1 text-[0.65rem] text-gray-500">{selectedExercise.primaryDistrict || selectedExercise.muscleGroup}</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="mt-3 w-full rounded-xl border border-orange-400/45 bg-gradient-to-r from-violet-600 to-orange-500 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition hover:brightness-110"
                  onClick={() => {
                    addFromCatalog(selectedExercise);
                  }}
                >
                  <Plus className="mr-1 inline h-4 w-4 align-text-bottom" aria-hidden />
                  Aggiungi alla scheda
                </button>
              </>
            ) : (
              <p className="text-xs text-gray-500">Seleziona un esercizio dalla lista per aggiungerlo.</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-violet-500/25 bg-black/35 p-3">
        <label className="flex max-w-xl flex-col gap-1 text-[0.65rem] text-gray-400">
          Nome sessione
          <input
            type="text"
            className="rounded-lg border border-violet-400/30 bg-black/50 px-2 py-2 text-sm text-white"
            value={manualSessionName}
            onChange={(e) => setManualSessionName(e.target.value)}
          />
        </label>
      </div>

      <div className="mt-4 space-y-3">
        <p className="text-[0.65rem] font-bold uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-violet-300 via-fuchsia-300 to-orange-300">
          Scheda · {gymRows.length} esercizi
        </p>
        {gymRows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-fuchsia-500/30 bg-violet-950/20 px-4 py-8 text-center text-sm text-gray-500">
            Aggiungi esercizi dal catalogo. Nessun blocco “aerobico”: solo scheda strength come in V1.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {gymRows.map((row) => (
              <li
                key={row.id}
                className="rounded-2xl border border-fuchsia-400/35 bg-gradient-to-br from-violet-950/40 via-fuchsia-950/15 to-orange-950/25 p-4 shadow-inner shadow-fuchsia-950/40"
              >
                <div className="mb-3 flex gap-3">
                  <GymExerciseMediaThumb
                    src={row.mediaUrl}
                    alt={row.name}
                    catalogExerciseId={row.exerciseId}
                    fallbackLabel={row.name}
                    className="h-28 w-28 shrink-0 rounded-xl border border-fuchsia-500/25 object-cover"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <input
                        type="text"
                        className="min-w-[10rem] flex-1 rounded-lg border border-violet-400/35 bg-black/45 px-3 py-2 text-base font-semibold text-white"
                        value={row.name}
                        onChange={(e) => updateRow(row.id, { name: e.target.value })}
                      />
                      <button
                        type="button"
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-500/40 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25"
                        onClick={() => removeRow(row.id)}
                        aria-label="Rimuovi esercizio"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <button
                      type="button"
                      className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-[0.65rem] font-bold transition ${
                        row.quickIncomplete
                          ? "border-orange-400/55 bg-orange-500/25 text-orange-100"
                          : "border-white/15 bg-black/35 text-gray-400 hover:border-orange-400/35"
                      }`}
                      onClick={() => updateRow(row.id, { quickIncomplete: !row.quickIncomplete })}
                    >
                      Scheda veloce (incompleta)
                    </button>
                  </div>
                </div>

                <div className="space-y-2 border-t border-white/10 pt-3">
                  <p className="text-[0.6rem] font-bold uppercase tracking-wider text-violet-300/90">Serie</p>
                  <div className="flex flex-wrap gap-1">
                    {SET_CHIP_PRESETS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={row.sets === n ? chipRxActive : chipRxIdle}
                        onClick={() => updateRow(row.id, { sets: n })}
                      >
                        {n}
                      </button>
                    ))}
                    <input
                      type="number"
                      min={1}
                      aria-label="Serie personalizzate"
                      className="w-14 rounded-full border border-white/15 bg-black/50 px-2 py-1 text-center text-[0.65rem] font-mono text-white"
                      value={row.sets}
                      onChange={(e) => updateRow(row.id, { sets: Math.max(1, Number(e.target.value) || 1) })}
                    />
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  <p className="text-[0.6rem] font-bold uppercase tracking-wider text-fuchsia-300/90">Ripetute</p>
                  <div className="flex flex-wrap gap-1">
                    {REP_CHIP_PRESETS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        className={row.reps === r ? chipRxActive : chipRxIdle}
                        onClick={() => updateRow(row.id, { reps: r })}
                      >
                        {r}
                      </button>
                    ))}
                    <input
                      type="text"
                      aria-label="Ripetute personalizzate"
                      className="w-[5rem] rounded-full border border-white/15 bg-black/50 px-2 py-1 text-[0.65rem] text-white"
                      value={row.reps}
                      onChange={(e) => updateRow(row.id, { reps: e.target.value })}
                    />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-3">
                  <div className="min-w-[8rem] flex-1 space-y-2">
                    <p className="text-[0.6rem] font-bold uppercase tracking-wider text-orange-200/90">% 1RM (indicativa)</p>
                    <div className="flex flex-wrap gap-1">
                      {PCT_CHIP_PRESETS.map((p) => (
                        <button
                          key={p}
                          type="button"
                          className={row.pct1Rm === p ? chipRxActive : chipRxIdle}
                          onClick={() => updateRow(row.id, { pct1Rm: p })}
                        >
                          {p}%
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={120}
                      placeholder="— %"
                      className="w-full max-w-[6rem] rounded-lg border border-white/15 bg-black/50 px-2 py-1.5 text-[0.7rem] font-mono text-white"
                      value={row.pct1Rm ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        updateRow(row.id, { pct1Rm: v === "" ? null : Number(v) });
                      }}
                    />
                  </div>
                  <div className="min-w-[8rem] flex-1 space-y-2">
                    <p className="text-[0.6rem] font-bold uppercase tracking-wider text-pink-200/90">Recupero (s)</p>
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
                  <label className="flex min-w-[6rem] flex-1 flex-col gap-1 text-[0.65rem] text-gray-500">
                    Peso (kg)
                    <input
                      type="number"
                      step="0.5"
                      min={0}
                      className="rounded-lg border border-white/15 bg-black/50 px-2 py-1.5 font-mono text-white"
                      value={row.loadKg ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        updateRow(row.id, { loadKg: v === "" ? null : Number(v) });
                      }}
                      placeholder="—"
                    />
                  </label>
                </div>

                <div className="mt-3 space-y-2">
                  <p className="text-[0.6rem] font-bold uppercase tracking-wider text-violet-200/90">Contrazione (prescrizione)</p>
                  <div className="flex flex-wrap gap-1">
                    {PRO2_GYM_CONTRACTION_OPTIONS.filter((o) => o.value !== "").map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        className={row.contractionEmphasis === o.value ? chipOnContract : chipRxIdle}
                        onClick={() =>
                          updateRow(row.id, {
                            contractionEmphasis: row.contractionEmphasis === o.value ? "" : o.value,
                          })
                        }
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  <p className="text-[0.6rem] font-bold uppercase tracking-wider text-fuchsia-200/90">Tipo di esecuzione · scorciatoie</p>
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
                  <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs text-gray-500">
                    Elenco completo
                    <select
                      className="rounded-lg border border-violet-400/30 bg-black/50 px-2 py-2 text-sm text-white"
                      value={row.executionStyle}
                      onChange={(e) => updateRow(row.id, { executionStyle: e.target.value })}
                    >
                      <option value="">Standard / non specificato</option>
                      {PRO2_GYM_EXECUTION_STYLES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-3 space-y-2">
                  <p className="text-[0.6rem] font-bold uppercase tracking-wider text-orange-200/90">Superserie / gruppo</p>
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
                      placeholder="es. SS1"
                      className="min-w-[5rem] flex-1 rounded-lg border border-white/15 bg-black/50 px-2 py-1.5 text-[0.7rem] text-white"
                      value={row.chainLabel}
                      onChange={(e) => updateRow(row.id, { chainLabel: e.target.value })}
                    />
                  </div>
                </div>

                <label className="mt-3 flex flex-col gap-1 text-xs text-gray-500">
                  Tecnica / cue esecuzione
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
                        ? "border-pink-400/50 bg-pink-500/20 text-pink-100"
                        : "border-white/15 bg-black/40 text-gray-300 hover:border-pink-400/35"
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
                      className="mt-2 w-full rounded-lg border border-pink-400/25 bg-black/50 px-2 py-2 text-sm text-white"
                      placeholder="Note al coach, varianti, logging…"
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
