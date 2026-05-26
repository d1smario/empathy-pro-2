"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { SportDisciplineGlyph } from "@/components/training/SportDisciplineGlyph";
import { Pro2Link } from "@/components/ui/empathy";
import type { SportGlyphId } from "@/lib/training/builder/sport-glyph-id";
import {
  inferViryaPlanFamilyLabel,
  readActiveViryaPlanTag,
  resolveDefaultActiveViryaPlan,
  writeActiveViryaPlanTag,
} from "@/lib/training/virya/virya-active-plan-preference";
import {
  fetchViryaCalendarPlans,
  type ViryaCalendarPlanSummary,
} from "@/modules/training/services/training-planned-api";

function glyphForViryaPlanLabel(label: string): SportGlyphId {
  switch (label) {
    case "Gym":
      return "gym";
    case "Lifestyle":
      return "mobility";
    case "Tecnico":
      return "runner";
    case "Running":
      return "runner";
    case "Ciclismo":
      return "roadBike";
    case "Nuoto":
      return "swim";
    default:
      return "roadBike";
  }
}

export function TrainingViryaActivePlanStrip({
  athleteId,
  selectedDate,
}: {
  athleteId: string | null;
  selectedDate: string;
}) {
  const [plans, setPlans] = useState<ViryaCalendarPlanSummary[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  useEffect(() => {
    if (!athleteId?.trim()) {
      setPlans([]);
      setActiveTag(null);
      return;
    }
    let cancelled = false;
    setLoadErr(null);
    void fetchViryaCalendarPlans(athleteId)
      .then((list) => {
        if (cancelled) return;
        setPlans(list);
        const persisted = readActiveViryaPlanTag(athleteId);
        const resolved = resolveDefaultActiveViryaPlan(list, selectedDate, persisted);
        const tag = resolved?.tag ?? null;
        setActiveTag(tag);
        if (tag && tag !== persisted) writeActiveViryaPlanTag(athleteId, tag);
      })
      .catch((e) => {
        if (!cancelled) setLoadErr(e instanceof Error ? e.message : "Errore piani VIRYA");
      });
    return () => {
      cancelled = true;
    };
  }, [athleteId, selectedDate]);

  const activePlan = useMemo(
    () => plans.find((p) => p.tag === activeTag) ?? null,
    [plans, activeTag],
  );

  const familyLabel = activePlan ? inferViryaPlanFamilyLabel(activePlan.planName) : null;
  const glyph = familyLabel ? glyphForViryaPlanLabel(familyLabel) : null;

  if (!athleteId?.trim()) return null;

  return (
    <div className="mb-4 rounded-2xl border border-cyan-500/25 bg-gradient-to-r from-cyan-950/40 via-violet-950/25 to-fuchsia-950/20 px-4 py-3 shadow-inner shadow-cyan-950/30">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-cyan-200/90">
          <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
          <span className="text-[0.65rem] font-bold uppercase tracking-[0.14em]">Piano VIRYA attivo</span>
        </div>
        {loadErr ? <span className="text-xs text-amber-300/90">{loadErr}</span> : null}
        {!loadErr && plans.length === 0 ? (
          <span className="text-sm text-slate-500">
            Nessun piano VIRYA su Calendar —{" "}
            <Pro2Link href="/training/vyria" variant="ghost" className="!inline text-cyan-200/90">
              crea da VIRYA
            </Pro2Link>
          </span>
        ) : null}
        {!loadErr && plans.length > 0 ? (
          <>
            {glyph ? (
              <SportDisciplineGlyph glyph={glyph} className="h-9 w-9 shrink-0 text-fuchsia-200" />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white">
                {activePlan?.planName ?? "—"}
                {familyLabel ? (
                  <span className="ml-2 text-xs font-normal text-fuchsia-200/80">· {familyLabel}</span>
                ) : null}
              </p>
              {activePlan ? (
                <p className="mt-0.5 font-mono text-[0.65rem] text-slate-500">
                  {activePlan.sessionCount} sedute · {activePlan.dateMin} → {activePlan.dateMax} ·{" "}
                  <span className="text-cyan-300/80">{activePlan.tag}</span>
                </p>
              ) : null}
            </div>
            <label className="flex flex-col gap-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">
              Cambia piano
              <select
                className="min-w-[12rem] rounded-lg border border-white/15 bg-black/50 px-2 py-1.5 text-sm text-white"
                value={activeTag ?? ""}
                onChange={(e) => {
                  const tag = e.target.value.trim();
                  setActiveTag(tag || null);
                  if (athleteId) writeActiveViryaPlanTag(athleteId, tag || null);
                }}
              >
                {plans.map((p) => (
                  <option key={p.tag} value={p.tag}>
                    {p.planName} ({p.sessionCount})
                  </option>
                ))}
              </select>
            </label>
            <Pro2Link
              href="/training/vyria"
              variant="ghost"
              className="border border-fuchsia-500/35 bg-fuchsia-500/10 text-xs"
            >
              VIRYA
            </Pro2Link>
          </>
        ) : null}
        {activeTag && !plans.some((p) => p.tag === activeTag) ? (
          <p className="mt-2 w-full text-xs text-amber-200/90">
            Il piano VIRYA preferito non ha più sedute in calendario (es. sostituito da Builder). Scegli un altro piano o
            ripubblica da VIRYA.
          </p>
        ) : null}
      </div>
    </div>
  );
}
