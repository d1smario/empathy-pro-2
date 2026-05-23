"use client";

import { BookMarked, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Pro2Button } from "@/components/ui/empathy";
import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import type { CoachWorkoutLibraryItemView } from "@/lib/training/library/coach-workout-library-types";
import {
  applyCoachLibraryItem,
  clonePlannedWorkout,
  fetchCoachLibraryItemContract,
  fetchCoachLibraryItems,
  saveCoachLibraryItem,
} from "@/modules/training/services/training-library-api";
import { serializePro2BuilderContractToZwo } from "@/lib/training/planned-structured-export";

export type CoachWorkoutLibraryPanelProps = {
  athleteId: string | null;
  targetDate: string;
  contractToSave?: Pro2BuilderSessionContract | null;
  saveTitle?: string;
  sourcePlannedId?: string | null;
  onApplied?: () => void;
};

export function CoachWorkoutLibraryPanel({
  athleteId,
  targetDate,
  contractToSave,
  saveTitle,
  sourcePlannedId,
  onApplied,
}: CoachWorkoutLibraryPanelProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [items, setItems] = useState<CoachWorkoutLibraryItemView[]>([]);
  const [filter, setFilter] = useState("");
  const [applyScaling, setApplyScaling] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const { items: rows, error } = await fetchCoachLibraryItems({ q: filter.trim() || undefined });
    setLoading(false);
    if (error) {
      setErr(
        error === "coach_only" || error === "coach_not_approved"
          ? "Libreria riservata ai coach approvati."
          : error,
      );
      setItems([]);
      return;
    }
    setItems(rows);
  }, [filter]);

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open, refresh]);

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
            Template riusabili (contratto Builder). Apply inserisce una nuova riga su calendario.
          </p>
          <div className="flex flex-wrap gap-2">
            {contractToSave ? (
              <Pro2Button type="button" variant="secondary" disabled={busy != null} onClick={() => void handleSave()}>
                {busy === "save" ? "Salvo…" : "Salva sessione in libreria"}
              </Pro2Button>
            ) : null}
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
              placeholder="Cerca…"
              className="min-w-[140px] flex-1 rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-xs text-white"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void refresh();
              }}
            />
            <Pro2Button type="button" variant="secondary" disabled={loading} onClick={() => void refresh()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aggiorna"}
            </Pro2Button>
            <label className="flex w-full items-center gap-2 text-[0.65rem] text-slate-400 sm:w-auto">
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
          <div className="max-h-52 overflow-y-auto rounded-xl border border-white/10">
            {loading && items.length === 0 ? (
              <p className="p-3 text-xs text-slate-500">Caricamento…</p>
            ) : items.length === 0 ? (
              <p className="p-3 text-xs text-slate-500">Nessun template in libreria.</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-white">{item.title}</div>
                      <div className="text-[0.65rem] text-slate-500">
                        {item.family} · {item.durationMinutes}′ · TSS {item.tssTarget}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Pro2Button
                        type="button"
                        variant="secondary"
                        className="!px-2 !py-1 text-[0.65rem]"
                        disabled={busy != null}
                        onClick={() => void handleExportZwo(item)}
                      >
                        {busy === `zwo-${item.id}` ? "…" : "ZWO"}
                      </Pro2Button>
                      <Pro2Button
                        type="button"
                        variant="secondary"
                        className="!px-2 !py-1 text-[0.65rem]"
                        disabled={busy != null || !athleteId}
                        onClick={() => void handleApply(item)}
                      >
                        {busy === `apply-${item.id}` ? "…" : "Applica"}
                      </Pro2Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
