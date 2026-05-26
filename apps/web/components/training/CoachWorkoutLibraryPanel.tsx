"use client";

import { BookMarked, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { CoachLibraryContractEditor } from "@/components/training/CoachLibraryContractEditor";
import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import { Pro2Button } from "@/components/ui/empathy";
import type { CoachWorkoutLibraryItemView } from "@/lib/training/library/coach-workout-library-types";
import {
  applyCoachLibraryItem,
  clonePlannedWorkout,
  fetchCoachLibraryItemContract,
  fetchCoachLibraryItems,
  importEmpathyAerobicStarterPack,
  saveCoachLibraryItem,
  updateCoachLibraryItem,
} from "@/modules/training/services/training-library-api";
import { serializePro2BuilderContractToZwo } from "@/lib/training/planned-structured-export";
import { STARTER_PACK_TEMPLATE_COUNT } from "@/lib/training/library/starter-pack-aerobic";
import {
  LIBRARY_DISCIPLINE_OPTIONS,
  LIBRARY_FAMILY_OPTIONS,
  LIBRARY_METHODOLOGY_TAG_OPTIONS,
  LIBRARY_VIRYA_PHASE_OPTIONS,
} from "@/lib/training/library/library-item-filters";

export type CoachWorkoutLibraryPanelProps = {
  athleteId: string | null;
  targetDate: string;
  contractToSave?: Pro2BuilderSessionContract | null;
  saveTitle?: string;
  sourcePlannedId?: string | null;
  onApplied?: () => void;
  /** Carica il template (anche bozza modificata) nel composer manuale del Builder. */
  onLoadInBuilder?: (contract: Pro2BuilderSessionContract) => void;
};

export function CoachWorkoutLibraryPanel({
  athleteId,
  targetDate,
  contractToSave,
  saveTitle,
  sourcePlannedId,
  onApplied,
  onLoadInBuilder,
}: CoachWorkoutLibraryPanelProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [items, setItems] = useState<CoachWorkoutLibraryItemView[]>([]);
  const [resultTotal, setResultTotal] = useState(0);
  const [filter, setFilter] = useState("");
  const [familyFilter, setFamilyFilter] = useState("");
  const [disciplineFilter, setDisciplineFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [viryaPhaseFilter, setViryaPhaseFilter] = useState("");
  const [applyScaling, setApplyScaling] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [previewContract, setPreviewContract] = useState<Pro2BuilderSessionContract | null>(null);
  const [draftContract, setDraftContract] = useState<Pro2BuilderSessionContract | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const hasActiveFilters =
    Boolean(filter.trim()) ||
    Boolean(familyFilter) ||
    Boolean(disciplineFilter) ||
    Boolean(tagFilter) ||
    Boolean(viryaPhaseFilter);

  useEffect(() => {
    if (!open || items.length === 0) {
      setSelectedItemId(null);
      setPreviewContract(null);
      setDraftContract(null);
      return;
    }
    if (!selectedItemId || !items.some((i) => i.id === selectedItemId)) {
      setSelectedItemId(items[0]!.id);
    }
  }, [open, items, selectedItemId]);

  useEffect(() => {
    if (!selectedItemId) {
      setPreviewContract(null);
      setDraftContract(null);
      setPreviewLoading(false);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    setDraftContract(null);
    void fetchCoachLibraryItemContract(selectedItemId).then((r) => {
      if (cancelled) return;
      setPreviewLoading(false);
      const c = r.ok && r.contract ? r.contract : null;
      setPreviewContract(c);
      setDraftContract(c ? structuredClone(c) : null);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedItemId]);

  const contractDirty =
    Boolean(draftContract && previewContract) &&
    JSON.stringify(draftContract) !== JSON.stringify(previewContract);

  const activeContract = draftContract ?? previewContract;

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const { items: rows, total, error } = await fetchCoachLibraryItems({
      q: filter.trim() || undefined,
      family: familyFilter || undefined,
      discipline: disciplineFilter || undefined,
      tag: tagFilter || undefined,
      viryaPhase: viryaPhaseFilter || undefined,
    });
    setLoading(false);
    if (error) {
      setErr(
        error === "coach_only" || error === "coach_not_approved"
          ? "Libreria riservata ai coach approvati."
          : error,
      );
      setItems([]);
      setResultTotal(0);
      return;
    }
    setItems(rows);
    setResultTotal(total ?? rows.length);
  }, [filter, familyFilter, disciplineFilter, tagFilter, viryaPhaseFilter]);

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open, refresh]);

  function clearFilters() {
    setFilter("");
    setFamilyFilter("");
    setDisciplineFilter("");
    setTagFilter("");
    setViryaPhaseFilter("");
  }

  async function handleSave() {
    if (!contractToSave) {
      setErr("Nessun contratto seduta da salvare.");
      return;
    }
    setBusy("save");
    setErr(null);
    setOkMsg(null);
    const title = (saveTitle ?? contractToSave.sessionName ?? "Seduta").trim().slice(0, 200);
    const r = await saveCoachLibraryItem({ title, contract: contractToSave });
    setBusy(null);
    if (!r.ok) {
      setErr(r.error ?? "Salvataggio fallito");
      return;
    }
    setOkMsg(`Salvata in libreria: ${title}`);
    void refresh();
  }

  async function handleApply(item: CoachWorkoutLibraryItemView) {
    if (!athleteId) {
      setErr("Seleziona un atleta.");
      return;
    }
    setBusy(`apply-${item.id}`);
    setErr(null);
    setOkMsg(null);
    const r = await applyCoachLibraryItem({
      itemId: item.id,
      athleteId,
      date: targetDate,
      applyScaling,
      contract: item.id === selectedItemId && draftContract ? draftContract : undefined,
    });
    setBusy(null);
    if (!r.ok) {
      setErr(r.error ?? "Apply fallito");
      return;
    }
    const scaleHint =
      applyScaling && r.loadScalePct != null ? ` (carico ~${r.loadScalePct}%)` : "";
    setOkMsg(`Applicata «${item.title}» al ${targetDate}${scaleHint}`);
    onApplied?.();
  }

  async function handleImportStarterPack() {
    setBusy("starter");
    setErr(null);
    setOkMsg(null);
    const r = await importEmpathyAerobicStarterPack();
    setBusy(null);
    if (!r.ok) {
      setErr(r.error ?? "Import pack fallito");
      return;
    }
    setOkMsg(
      `Pack Empathy: ${r.imported ?? 0} nuovi, ${r.updated ?? 0} aggiornati, ${r.skipped ?? 0} saltati (${r.total ?? STARTER_PACK_TEMPLATE_COUNT} totali).`,
    );
    void refresh();
  }

  async function handleExportZwo(item: CoachWorkoutLibraryItemView) {
    setBusy(`zwo-${item.id}`);
    setErr(null);
    const r = await fetchCoachLibraryItemContract(item.id);
    setBusy(null);
    if (!r.ok || !r.contract) {
      setErr(r.error ?? "Export fallito");
      return;
    }
    try {
      const zwo = serializePro2BuilderContractToZwo(r.contract);
      const blob = new Blob([zwo], { type: "application/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(r.title ?? item.title).replace(/[^\w\-]+/g, "_").slice(0, 80)}.zwo`;
      a.click();
      URL.revokeObjectURL(url);
      setOkMsg(`Export ZWO: ${item.title}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Export ZWO fallito");
    }
  }

  async function handleSaveDraft() {
    if (!selectedItemId || !draftContract) return;
    setBusy("save-draft");
    setErr(null);
    setOkMsg(null);
    const item = items.find((i) => i.id === selectedItemId);
    const r = await updateCoachLibraryItem({
      itemId: selectedItemId,
      contract: draftContract,
      title: item?.title,
    });
    setBusy(null);
    if (!r.ok) {
      setErr(r.error ?? "Salvataggio modifiche fallito");
      return;
    }
    setPreviewContract(structuredClone(draftContract));
    setOkMsg("Template aggiornato in libreria.");
    void refresh();
  }

  async function handleCloneSource() {
    if (!athleteId || !sourcePlannedId) return;
    setBusy("clone");
    setErr(null);
    setOkMsg(null);
    const r = await clonePlannedWorkout({ sourceId: sourcePlannedId, athleteId, date: targetDate });
    setBusy(null);
    if (!r.ok) {
      setErr(r.error ?? "Copia fallita");
      return;
    }
    setOkMsg(`Seduta copiata al ${targetDate}`);
    onApplied?.();
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-violet-200">
          <BookMarked className="h-4 w-4" aria-hidden />
          Libreria sedute coach
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
      </button>
      {open ? (
        <div className="space-y-3 border-t border-white/10 px-4 pb-4 pt-3">
          <p className="text-xs text-slate-500">
            Template riusabili (contratto Builder). Clicca un template per modificarne intervalli, serie e durata; Apply usa le modifiche (salva il template per tenerle in libreria).
          </p>
          <div className="flex flex-wrap gap-2">
            {contractToSave ? (
              <Pro2Button type="button" variant="secondary" disabled={busy != null} onClick={() => void handleSave()}>
                {busy === "save" ? "Salvo…" : "Salva sessione in libreria"}
              </Pro2Button>
            ) : null}
            <Pro2Button
              type="button"
              variant="secondary"
              disabled={busy != null}
              onClick={() => void handleImportStarterPack()}
            >
              {busy === "starter" ? "Importo…" : `Importa / aggiorna catalogo (${STARTER_PACK_TEMPLATE_COUNT})`}
            </Pro2Button>
            {sourcePlannedId ? (
              <Pro2Button
                type="button"
                variant="secondary"
                disabled={busy != null}
                onClick={() => void handleCloneSource()}
              >
                {busy === "clone" ? "Copio…" : "Copia seduta selezionata"}
              </Pro2Button>
            ) : null}
            <input
              type="search"
              placeholder="Cerca titolo, disciplina…"
              className="min-w-[140px] flex-1 rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-xs text-white"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void refresh();
              }}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <select
              className="rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-xs text-white"
              value={disciplineFilter}
              onChange={(e) => setDisciplineFilter(e.target.value)}
              aria-label="Filtro disciplina"
            >
              {LIBRARY_DISCIPLINE_OPTIONS.map((o) => (
                <option key={o.value || "all"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-xs text-white"
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              aria-label="Filtro metodologia"
            >
              {LIBRARY_METHODOLOGY_TAG_OPTIONS.map((o) => (
                <option key={o.value || "all"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-xs text-white"
              value={familyFilter}
              onChange={(e) => setFamilyFilter(e.target.value)}
              aria-label="Filtro famiglia"
            >
              {LIBRARY_FAMILY_OPTIONS.map((o) => (
                <option key={o.value || "all"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-xs text-white"
              value={viryaPhaseFilter}
              onChange={(e) => setViryaPhaseFilter(e.target.value)}
              aria-label="Filtro fase VIRYA"
            >
              {LIBRARY_VIRYA_PHASE_OPTIONS.map((o) => (
                <option key={o.value || "all"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Pro2Button type="button" variant="secondary" disabled={loading} onClick={() => void refresh()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Applica filtri"}
            </Pro2Button>
            {hasActiveFilters ? (
              <button
                type="button"
                className="text-xs font-semibold text-slate-400 underline decoration-white/20 hover:text-violet-200"
                onClick={clearFilters}
              >
                Reset filtri
              </button>
            ) : null}
            <span className="text-[0.65rem] text-slate-500">
              {loading ? "…" : `${resultTotal} template`}
            </span>
            <label className="ml-auto flex items-center gap-2 text-[0.65rem] text-slate-400">
              <input
                type="checkbox"
                checked={applyScaling}
                onChange={(e) => setApplyScaling(e.target.checked)}
              />
              Adatta carico (twin/recovery)
            </label>
          </div>
          {err ? (
            <p className="text-xs text-amber-300" role="alert">
              {err}
            </p>
          ) : null}
          {okMsg ? (
            <p className="text-xs text-emerald-300" role="status">
              {okMsg}
            </p>
          ) : null}
          <div className="max-h-[min(32rem,70vh)] overflow-y-auto rounded-xl border border-white/10">
            {loading && items.length === 0 ? (
              <p className="p-3 text-xs text-slate-500">Caricamento…</p>
            ) : items.length === 0 ? (
              <p className="p-3 text-xs text-slate-500">Nessun template in libreria.</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {items.map((item) => {
                  const selected = item.id === selectedItemId;
                  return (
                    <li key={item.id}>
                      <div
                        className={`flex items-center justify-between gap-2 px-3 py-2 transition ${
                          selected
                            ? "border-l-2 border-fuchsia-400/80 bg-gradient-to-r from-violet-950/50 to-transparent"
                            : "border-l-2 border-transparent hover:bg-white/[0.03]"
                        }`}
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => setSelectedItemId(item.id)}
                        >
                          <div className="truncate text-xs font-semibold text-white">{item.title}</div>
                          <div className="text-[0.65rem] text-slate-500">
                            {item.discipline} · {item.family} · {item.durationMinutes}′ · TSS {item.tssTarget}
                            {formatItemTags(item.metadata)}
                          </div>
                        </button>
                        <div className="flex shrink-0 gap-1">
                          <Pro2Button
                            type="button"
                            variant="secondary"
                            className="!px-2 !py-1 text-[0.65rem]"
                            disabled={busy != null}
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleExportZwo(item);
                            }}
                          >
                            {busy === `zwo-${item.id}` ? "…" : "ZWO"}
                          </Pro2Button>
                          {onLoadInBuilder && activeContract && item.id === selectedItemId ? (
                            <Pro2Button
                              type="button"
                              variant="secondary"
                              className="!px-2 !py-1 text-[0.65rem]"
                              disabled={busy != null}
                              onClick={(e) => {
                                e.stopPropagation();
                                onLoadInBuilder(activeContract);
                                setOkMsg(`«${item.title}» caricata nel Builder — modifica serie, intervalli e durata.`);
                              }}
                            >
                              Builder
                            </Pro2Button>
                          ) : null}
                          <Pro2Button
                            type="button"
                            variant="secondary"
                            className="!px-2 !py-1 text-[0.65rem]"
                            disabled={busy != null || !athleteId}
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleApply(item);
                            }}
                          >
                            {busy === `apply-${item.id}` ? "…" : "Applica"}
                          </Pro2Button>
                        </div>
                      </div>
                      {selected ? (
                        <div className="border-t border-fuchsia-500/15 bg-gradient-to-b from-violet-950/30 via-black/40 to-black/60 px-3 py-3">
                          {previewLoading ? (
                            <div className="flex items-center justify-center gap-2 py-6 text-xs text-slate-400">
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                              Carico grafico a blocchi…
                            </div>
                          ) : activeContract ? (
                            <CoachLibraryContractEditor
                              contract={activeContract}
                              title={item.title}
                              tssFallback={item.tssTarget}
                              durationFallback={item.durationMinutes}
                              dirty={contractDirty}
                              saveBusy={busy === "save-draft"}
                              onChange={setDraftContract}
                              onSave={() => void handleSaveDraft()}
                              onReset={() => {
                                if (previewContract) setDraftContract(structuredClone(previewContract));
                              }}
                              onOpenInBuilder={
                                onLoadInBuilder
                                  ? () => {
                                      onLoadInBuilder(activeContract);
                                      setOkMsg(`«${item.title}» caricata nel Builder.`);
                                    }
                                  : undefined
                              }
                            />
                          ) : (
                            <p className="py-4 text-center text-xs text-amber-200/90">
                              Struttura non disponibile per questo template.
                            </p>
                          )}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatItemTags(metadata: Record<string, unknown>): string {
  const tags = metadata.tags;
  if (!Array.isArray(tags) || tags.length === 0) return "";
  const slice = tags
    .filter((t): t is string => typeof t === "string")
    .slice(0, 3)
    .join(" · ");
  return slice ? ` · ${slice}` : "";
}
