"use client";

import {
  formatExecutedWorkoutSummary,
  type ExecutedWorkout,
  type PlannedWorkout,
} from "@empathy/domain-training";
import { CalendarDays, ClipboardList, Heart, Wrench } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BuilderDayKpiPanel } from "@/components/training/BuilderDayKpiPanel";
import { CalendarPlannedBuilderDetail } from "@/components/training/CalendarPlannedBuilderDetail";
import { TrainingPlannedWindowContextStrip } from "@/components/training/TrainingPlannedWindowContextStrip";
import { TrainingSubnav } from "@/components/training/TrainingSubnav";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { Pro2Link } from "@/components/ui/empathy";
import { parsePro2BuilderSessionFromNotes } from "@/lib/training/builder/pro2-session-notes";
import type { TrainingPlannedWindowOkViewModel, TrainingTwinContextStripViewModel } from "@/api/training/contracts";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-session";
import type { ReadSpineCoverageSummary } from "@/lib/platform/read-spine-coverage";
import { useActiveAthlete } from "@/lib/use-active-athlete";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type WindowErr = { ok: false; error?: string };

/**
 * Vista giornata: pianificato + eseguito per `date` (stessa API finestra calendario, `from`=`to`=`date`).
 * Completion manuale e patch coach arriveranno con endpoint dedicati Pro 2.
 */
export default function TrainingSessionPageView() {
  const params = useParams<{ date: string }>();
  const date = typeof params?.date === "string" ? params.date : "";
  const dateValid = ISO_DATE.test(date);

  const { athleteId, loading: ctxLoading } = useActiveAthlete();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [planned, setPlanned] = useState<PlannedWorkout[]>([]);
  const [executed, setExecuted] = useState<ExecutedWorkout[]>([]);
  const [readSpineCoverage, setReadSpineCoverage] = useState<ReadSpineCoverageSummary | null>(null);
  const [twinContextStrip, setTwinContextStrip] = useState<TrainingTwinContextStripViewModel | null>(null);

  useEffect(() => {
    if (!dateValid) {
      setLoading(false);
      setErr(null);
      setPlanned([]);
      setExecuted([]);
      setReadSpineCoverage(null);
      setTwinContextStrip(null);
      return;
    }
    if (ctxLoading) return;
    if (!athleteId) {
      setLoading(false);
      setPlanned([]);
      setExecuted([]);
      setReadSpineCoverage(null);
      setTwinContextStrip(null);
      setErr("Nessun atleta attivo.");
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const q = new URLSearchParams({ athleteId, from: date, to: date });
        const res = await fetch(`/api/training/planned-window?${q}`, {
          cache: "no-store",
          headers: await buildSupabaseAuthHeaders(),
        });
        const json = (await res.json()) as TrainingPlannedWindowOkViewModel | WindowErr;
        if (cancelled) return;
        if (!res.ok || !json.ok) {
          setPlanned([]);
          setExecuted([]);
          setReadSpineCoverage(null);
          setTwinContextStrip(null);
          setErr(("error" in json && json.error) || "Lettura non riuscita.");
          return;
        }
        setPlanned(json.planned);
        setExecuted(json.executed);
        setReadSpineCoverage(json.readSpineCoverage ?? null);
        setTwinContextStrip(json.twinContextStrip ?? null);
      } catch {
        if (!cancelled) {
          setErr("Errore di rete.");
          setPlanned([]);
          setExecuted([]);
          setReadSpineCoverage(null);
          setTwinContextStrip(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [athleteId, ctxLoading, date, dateValid]);

  const titleDate = useMemo(() => {
    if (!dateValid) return "—";
    try {
      return new Date(`${date}T12:00:00`).toLocaleDateString("it-IT", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return date;
    }
  }, [date, dateValid]);

  const dayKpi = useMemo(() => {
    if (!planned.length) return null;
    const items = planned
      .slice(0, 2)
      .map((w) => {
        const c = parsePro2BuilderSessionFromNotes(w.notes ?? null);
        if (!c?.summary) return null;
        return {
          label: c.sessionName,
          durationSec: c.summary.durationSec,
          tss: c.summary.tss,
          kcal: c.summary.kcal,
          kj: c.summary.kj,
          avgPowerW: c.summary.avgPowerW,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);
    if (!items.length) return null;
    const head = parsePro2BuilderSessionFromNotes(planned[0]?.notes ?? null);
    return {
      items,
      discipline: head?.discipline ?? String(planned[0]?.type ?? "-"),
      sessionName: head?.sessionName?.trim() || String(planned[0]?.type ?? "Giornata"),
    };
  }, [planned]);

  return (
    <Pro2ModulePageShell
      eyebrow="Training · Giornata"
      eyebrowClassName="text-orange-400"
      title={dateValid ? titleDate : "Data non valida"}
      description={
        dateValid ? (
          <span>
            Riferimento ISO <code className="text-orange-200/80">{date}</code> — stessi dati del calendario operativo.
          </span>
        ) : (
          "Usa un path del tipo /training/session/2025-04-02 (YYYY-MM-DD)."
        )
      }
      headerActions={
        <>
          <Pro2Link
            href={dateValid ? `/training/calendar?date=${encodeURIComponent(date)}` : "/training/calendar"}
            variant="secondary"
            className="justify-center border border-sky-500/35 bg-sky-500/10 hover:bg-sky-500/15"
          >
            Calendar
          </Pro2Link>
          <Pro2Link
            href="/training/builder"
            variant="secondary"
            className="justify-center border border-fuchsia-500/35 bg-fuchsia-500/10 hover:bg-fuchsia-500/15"
          >
            Builder
          </Pro2Link>
          <Pro2Link
            href="/training"
            variant="ghost"
            className="justify-center border border-cyan-500/35 bg-cyan-500/10 hover:bg-cyan-500/15"
          >
            Hub
          </Pro2Link>
          <Pro2Link
            href="/profile"
            variant="secondary"
            className="justify-center border border-fuchsia-500/35 bg-fuchsia-500/10 hover:bg-fuchsia-500/15"
          >
            Profile
          </Pro2Link>
        </>
      }
    >
      <div className="scroll-mt-28">
        <TrainingSubnav />
      </div>

      {dateValid && readSpineCoverage && athleteId ? (
        <TrainingPlannedWindowContextStrip
          className="mb-4"
          label="Giornata"
          readSpineCoverage={readSpineCoverage}
          twinContextStrip={twinContextStrip}
        />
      ) : null}

      {dateValid && dayKpi && !ctxLoading && !loading && !err ? (
        <BuilderDayKpiPanel
          discipline={dayKpi.discipline}
          sessionName={dayKpi.sessionName}
          items={dayKpi.items}
        />
      ) : null}

      {!dateValid ? (
        <Pro2SectionCard accent="slate" title="Path non valido" subtitle="Formato data" icon={CalendarDays}>
          <p className="text-sm text-gray-400">
            La data nell&apos;URL deve essere <strong className="text-gray-200">YYYY-MM-DD</strong>.
          </p>
        </Pro2SectionCard>
      ) : null}

      {dateValid ? (
        <>
          <Pro2SectionCard
            accent="cyan"
            title="Pianificato"
            subtitle={ctxLoading || loading ? "Caricamento…" : err ? undefined : `${planned.length} in questa giornata`}
            icon={CalendarDays}
          >
            {err ? (
              <p className="text-sm text-amber-300/90" role="alert">
                {err}
              </p>
            ) : null}
            {!ctxLoading && !loading && !err && planned.length === 0 ? (
              <p className="text-sm text-gray-500">Nessun workout pianificato per questa data.</p>
            ) : null}
            {!ctxLoading && !loading && !err && planned.length > 0 ? (
              <ul className="space-y-4">
                {planned.map((w) => (
                  <li key={w.id}>
                    <CalendarPlannedBuilderDetail workout={w} />
                  </li>
                ))}
              </ul>
            ) : null}
          </Pro2SectionCard>

          <Pro2SectionCard
            accent="emerald"
            title="Eseguito"
            subtitle={!loading && !err ? `${executed.length} registrazioni` : undefined}
            icon={ClipboardList}
          >
            {!ctxLoading && !loading && !err && executed.length === 0 ? (
              <p className="text-sm text-gray-500">Nessuna esecuzione in questa giornata.</p>
            ) : null}
            {!ctxLoading && !loading && !err && executed.length > 0 ? (
              <ul className="space-y-2">
                {executed.map((w) => (
                  <li
                    key={w.id}
                    className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-gray-200"
                  >
                    {formatExecutedWorkoutSummary(w)}
                  </li>
                ))}
              </ul>
            ) : null}
          </Pro2SectionCard>

          <Pro2SectionCard
            accent="violet"
            title="Twin e recovery"
            subtitle="Stesso athlete memory usato da builder e nutrizione"
            icon={Heart}
          >
            <p className="text-sm text-gray-400">
              Readiness, carico interno e recovery debt vivono nel <strong className="text-gray-200">digital twin</strong> in memoria
              atleta. Apri Profile per lo snapshot; Physiology per le ancore deterministiche.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Pro2Link
                href="/profile"
                variant="secondary"
                className="justify-center border border-fuchsia-500/35 bg-fuchsia-500/10 hover:bg-fuchsia-500/15"
              >
                Profile · twin
              </Pro2Link>
              <Pro2Link
                href="/physiology"
                variant="secondary"
                className="justify-center border border-emerald-500/35 bg-emerald-500/10 hover:bg-emerald-500/15"
              >
                Physiology
              </Pro2Link>
            </div>
          </Pro2SectionCard>

          <Pro2SectionCard accent="amber" title="Prossimi passi" subtitle="API Pro 2" icon={Wrench}>
            <p className="text-sm text-gray-400">
              Registrazione <strong className="text-gray-200">completa sessione</strong>, modifica carico coach e note builder strutturate
              saranno collegate agli stessi endpoint previsti in V1, senza motore parallelo.
            </p>
          </Pro2SectionCard>
        </>
      ) : null}
    </Pro2ModulePageShell>
  );
}
