"use client";

import { Activity, Beaker, CalendarDays, Heart, LineChart, Moon } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { Pro2Link } from "@/components/ui/empathy";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-session";
import { moduleEyebrowClass } from "@/core/navigation/module-ui-accent";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import type { PhysiologyDailyPanelOk } from "@/lib/physiology/daily-wellness-panel";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function fmtNum(n: number | null | undefined, digits = 0): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("it-IT", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function MetricCell({
  label,
  value,
  unit,
  hint,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-black/35 p-4">
      <p className="font-mono text-[0.6rem] font-bold uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-1 truncate text-xl font-bold text-white">
        {value}
        {unit ? <span className="ml-1 text-sm font-semibold text-gray-400">{unit}</span> : null}
      </p>
      {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}

function TimeSeriesPlaceholder({
  title,
  subtitle,
  unitHint,
}: {
  title: string;
  subtitle: string;
  unitHint: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-white">{title}</p>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
        <span className="font-mono text-[0.6rem] uppercase text-gray-500">{unitHint}</span>
      </div>
      <div className="relative mt-4 h-32 w-full overflow-hidden rounded-lg border border-white/10 bg-gradient-to-b from-zinc-900/80 to-black/90">
        <svg viewBox="0 0 400 120" className="h-full w-full text-cyan-400/50" preserveAspectRatio="none" aria-hidden>
          <line x1="0" y1="100" x2="400" y2="100" stroke="currentColor" strokeWidth="0.5" strokeDasharray="4 4" />
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            points="0,90 40,88 80,72 120,60 160,55 200,48 240,52 280,40 320,38 360,30 400,28"
          />
        </svg>
        <p className="pointer-events-none absolute bottom-2 left-3 right-3 text-center text-[0.65rem] text-gray-500">
          Asse tempo · placeholder finché la serie continua non è ingestita per questa giornata
        </p>
      </div>
    </div>
  );
}

/** Fascia fissa: utente vede quali canali “extra” il modulo supporta, anche se oggi sono vuoti. */
function AdvancedPhysiologyChannelsStrip({ panel }: { panel: PhysiologyDailyPanelOk | null }) {
  const lab = panel?.labTracksAvailability;
  const bio = panel?.biomarkers;
  const gasLine =
    bio?.vo2LMin != null || bio?.vco2LMin != null
      ? `VO₂ ${fmtNum(bio.vo2LMin, 2)} · VCO₂ ${fmtNum(bio.vco2LMin, 2)} L/min`
      : "—";

  const slots: Array<{ title: string; value: string; unit?: string; foot: string; warm?: boolean }> = [
    {
      title: "Glucosio",
      value: fmtNum(bio?.glucoseMmolL ?? null, 2),
      unit: bio?.glucoseMmolL != null ? "mmol/L" : undefined,
      foot: "Puntuale da biomarker · serie CGM sotto quando ingestita.",
      warm: Boolean(lab?.glucoseCgm),
    },
    {
      title: "Lattato",
      value: fmtNum(bio?.lactateMmolL ?? null, 2),
      unit: bio?.lactateMmolL != null ? "mmol/L" : undefined,
      foot: "Flash / panel · monitoraggio continuo (serie) sotto.",
      warm: Boolean(lab?.lactateContinuous),
    },
    {
      title: "SmO₂ muscolare (NIRS)",
      value: "—",
      foot: "Saturazione ossigeno muscolo · device NIRS / laboratorio (non SpO₂ polso).",
      warm: Boolean(lab?.muscleSmo2Continuous),
    },
    {
      title: "Gas · VO₂ / VCO₂",
      value: gasLine,
      foot: "Spirometria / metabolic cart · stessa riga espone entrambi se presenti.",
      warm: Boolean(lab?.gasExchangeLab),
    },
    {
      title: "Temperatura core",
      value: "—",
      foot: "Continua (belt, pill, lab) · valore puntuale + grafico quando collegati.",
      warm: Boolean(lab?.coreTempContinuous),
    },
    {
      title: "Ormoni / metabolomics",
      value: "—",
      foot: "Panel seriali o upload Health: compariranno qui con chiavi mappate.",
      warm: Boolean(lab?.hormonePanels),
    },
  ];

  return (
    <div className="rounded-2xl border border-amber-500/35 bg-gradient-to-br from-amber-950/20 via-black/40 to-black/60 p-4 shadow-inner sm:p-5">
      <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-amber-400/95">
        Canali dati avanzati
      </p>
      <p className="mt-2 max-w-3xl text-sm text-gray-300">
        Oltre a passi, sonno e recovery: predisponiamo slot per laboratorio e wearable tecnici. Se non hai ancora
        sorgenti collegate, le celle restano vuote (—) ma il perimetro del prodotto è chiaro.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {slots.map((s) => (
          <div
            key={s.title}
            className={`rounded-xl border p-3 ${
              s.warm ? "border-emerald-500/40 bg-emerald-500/10" : "border-white/12 bg-black/35"
            }`}
          >
            <p className="text-[0.65rem] font-bold uppercase tracking-wider text-gray-500">{s.title}</p>
            <p className="mt-1 font-mono text-lg font-bold text-white">
              {s.value}
              {s.unit ? <span className="ml-1 text-sm font-semibold text-gray-400">{s.unit}</span> : null}
            </p>
            <p className="mt-2 text-[0.7rem] leading-snug text-gray-500">{s.foot}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function HypnogramChart({ points }: { points: Array<{ t: number; stage: number }> }) {
  if (!points.length) {
    return (
      <TimeSeriesPlaceholder
        title="Sonno · fasi"
        subtitle="Nessuna serie fasi nel payload: quando il vendor espone segmenti o minuti per stadio, comparirà qui."
        unitHint="stadio · h"
      />
    );
  }
  const maxT = Math.max(...points.map((p) => p.t), 0.01);
  const maxS = Math.max(...points.map((p) => p.stage), 1);
  const w = 400;
  const h = 120;
  const poly = points
    .map((p, i) => {
      const x = (p.t / maxT) * w;
      const y = h - (p.stage / maxS) * (h - 16) - 8;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <div className="rounded-xl border border-violet-500/25 bg-violet-950/10 p-4">
      <p className="text-sm font-bold text-white">Sonno · ipnogramma (semplificato)</p>
      <p className="text-xs text-gray-500">Costruito da segmenti/minuti nel payload device quando presenti.</p>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 h-36 w-full text-violet-300" role="img" aria-label="Ipnotogramma sonno">
        <rect width={w} height={h} fill="rgba(0,0,0,0.25)" rx="6" />
        <path d={poly} fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

export default function PhysiologyDailyWellnessPageView() {
  const params = useParams();
  const dateRaw = params?.date;
  const date = (Array.isArray(dateRaw) ? dateRaw[0] : dateRaw ?? "").slice(0, 10);
  const dateValid = ISO_DATE.test(date);

  const { athleteId, loading: ctxLoading } = useActiveAthlete();
  const [panel, setPanel] = useState<PhysiologyDailyPanelOk | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!athleteId || !dateValid) {
      setPanel(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const q = new URLSearchParams({ athleteId, date });
      const res = await fetch(`/api/physiology/daily-panel?${q}`, {
        cache: "no-store",
        credentials: "same-origin",
        headers: await buildSupabaseAuthHeaders(),
      });
      const json = (await res.json()) as PhysiologyDailyPanelOk | { ok: false; error?: string };
      if (!res.ok || !json || typeof json !== "object" || !("ok" in json) || json.ok !== true) {
        setPanel(null);
        setErr((json as { error?: string }).error || "Lettura pannello non riuscita.");
        return;
      }
      setPanel(json);
    } catch {
      setPanel(null);
      setErr("Errore di rete.");
    } finally {
      setLoading(false);
    }
  }, [athleteId, dateValid, date]);

  useEffect(() => {
    void load();
  }, [load]);

  const dayLabel = useMemo(() => {
    if (!dateValid) return "";
    return new Date(`${date}T12:00:00`).toLocaleDateString("it-IT", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, [date, dateValid]);

  if (ctxLoading || (loading && athleteId && dateValid)) {
    return (
      <Pro2ModulePageShell
        eyebrow="Physiology · Giornata"
        eyebrowClassName={moduleEyebrowClass("physiology")}
        title="Caricamento…"
        description="Aggregazione device e biomarker per la data selezionata."
      >
        <p className="text-sm text-slate-500">Caricamento contesto atleta…</p>
      </Pro2ModulePageShell>
    );
  }

  if (!athleteId) {
    return (
      <Pro2ModulePageShell
        eyebrow="Physiology · Giornata"
        eyebrowClassName={moduleEyebrowClass("physiology")}
        title="Wellness giornaliero"
        description="Seleziona un atleta attivo per vedere il pannello."
        headerActions={
          <Pro2Link href="/access" variant="secondary" className="border border-emerald-500/35 bg-emerald-500/10">
            Accesso
          </Pro2Link>
        }
      >
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-slate-400">
          Nessun atleta attivo. Da coach apri Athletes; da atleta privato collega il profilo in Accesso.
        </div>
      </Pro2ModulePageShell>
    );
  }

  if (!dateValid) {
    return (
      <Pro2ModulePageShell
        eyebrow="Physiology · Giornata"
        eyebrowClassName={moduleEyebrowClass("physiology")}
        title="Data non valida"
        description="Usa una chiave ISO YYYY-MM-DD nel path."
        headerActions={
          <Pro2Link href="/physiology" variant="ghost" className="border border-orange-500/35 bg-orange-500/10">
            Metabolic Lab
          </Pro2Link>
        }
      >
        <p className="text-sm text-amber-200/90">Path attuale non è una data ISO.</p>
      </Pro2ModulePageShell>
    );
  }

  const r = panel?.recovery;

  return (
    <Pro2ModulePageShell
      eyebrow="Physiology · Giornata"
      eyebrowClassName={moduleEyebrowClass("physiology")}
      title="Wellness giornaliero"
      description={
        <>
          Allineato al calendario operativo (<span className="text-orange-200/90">stessa data ISO</span> di Training).
          Celle per KPI; grafici classici per serie dense e laboratorio quando i dati sono disponibili.
        </>
      }
      headerActions={
        <>
          <Pro2Link
            href={`/training/calendar?date=${encodeURIComponent(date)}`}
            variant="secondary"
            className="justify-center border border-cyan-500/35 bg-cyan-500/10 hover:bg-cyan-500/15"
          >
            <CalendarDays className="mr-1 inline h-4 w-4" aria-hidden />
            Calendar
          </Pro2Link>
          <Pro2Link
            href={`/training/session/${encodeURIComponent(date)}`}
            variant="secondary"
            className="justify-center border border-fuchsia-500/35 bg-fuchsia-500/10 hover:bg-fuchsia-500/15"
          >
            <LineChart className="mr-1 inline h-4 w-4" aria-hidden />
            Training giornata
          </Pro2Link>
          <Pro2Link href="/physiology" variant="ghost" className="border border-orange-500/35 bg-orange-500/10">
            Metabolic Lab
          </Pro2Link>
        </>
      }
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
        <div>
          <p className="font-mono text-xs text-gray-500">{date}</p>
          <p className="mt-1 text-lg font-bold capitalize text-white">{dayLabel}</p>
        </div>
      </div>

      {err ? (
        <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{err}</div>
      ) : null}

      {panel?.notes?.length ? (
        <div className="mb-6 space-y-2 rounded-2xl border border-slate-500/30 bg-slate-500/10 px-4 py-3 text-sm text-slate-200">
          {panel.notes.map((n) => (
            <p key={n}>{n}</p>
          ))}
        </div>
      ) : null}

      <div className="mb-8">
        <AdvancedPhysiologyChannelsStrip panel={panel} />
      </div>

      <Pro2SectionCard accent="cyan" title="Profilo e attività" subtitle="Peso profilo, passi, energia, vitale" icon={Activity}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCell label="Peso (profilo)" value={fmtNum(panel?.profileWeightKg ?? null, 1)} unit="kg" />
          <MetricCell label="Passi" value={fmtNum(panel?.activity.steps ?? null, 0)} />
          <MetricCell label="Kcal attive" value={fmtNum(panel?.activity.activeCaloriesKcal ?? null, 0)} unit="kcal" />
          <MetricCell label="Kcal totali (stima)" value={fmtNum(panel?.activity.totalCaloriesKcal ?? null, 0)} unit="kcal" />
          <MetricCell
            label="Freq. respiratoria"
            value={fmtNum(panel?.activity.respiratoryRateRpm ?? null, 1)}
            unit="rpm"
          />
          <MetricCell label="Temperatura cute" value={fmtNum(panel?.activity.skinTempC ?? null, 2)} unit="°C" />
          <MetricCell label="Temperatura / polso" value={fmtNum(panel?.activity.bodyTempC ?? null, 2)} unit="°C" />
          <MetricCell label="SpO₂ (media)" value={fmtNum(panel?.activity.spo2Pct ?? null, 1)} unit="%" />
          <MetricCell
            label="ECG (flag)"
            value={panel?.activity.ecgCaptured == null ? "—" : panel.activity.ecgCaptured ? "Sì" : "No"}
            hint="Da payload device quando esposto"
          />
        </div>
      </Pro2SectionCard>

      <Pro2SectionCard accent="violet" title="Recovery e sonno" subtitle="HRV, FC notturna, durata, score" icon={Moon}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCell label="HRV" value={fmtNum(r?.hrvMs ?? null, 0)} unit="ms" />
          <MetricCell label="FC a riposo / notte" value={fmtNum(r?.restingHrBpm ?? null, 0)} unit="bpm" />
          <MetricCell label="Ore sonno" value={fmtNum(r?.sleepDurationHours ?? null, 2)} unit="h" />
          <MetricCell label="Sleep score" value={fmtNum(r?.sleepScore ?? null, 0)} />
          <MetricCell label="Readiness" value={fmtNum(r?.readinessScore ?? null, 0)} />
          <MetricCell label="Recovery" value={fmtNum(r?.recoveryScore ?? null, 0)} />
          <MetricCell label="Strain" value={fmtNum(r?.strainScore ?? null, 1)} />
          <MetricCell label="Stato sintetico" value={r?.status === "unknown" || !r ? "—" : r.status} hint={r?.guidance} />
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <HypnogramChart points={panel?.sleepHypnogram ?? []} />
          <div className="space-y-3 rounded-xl border border-white/10 bg-black/30 p-4">
            <p className="text-sm font-bold text-white">Fasi sonno (ore)</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <MetricCell label="Deep" value={fmtNum(panel?.sleepStages.deepHours ?? null, 2)} unit="h" />
              <MetricCell label="Light" value={fmtNum(panel?.sleepStages.lightHours ?? null, 2)} unit="h" />
              <MetricCell label="REM" value={fmtNum(panel?.sleepStages.remHours ?? null, 2)} unit="h" />
              <MetricCell label="Awake" value={fmtNum(panel?.sleepStages.awakeHours ?? null, 2)} unit="h" />
            </div>
            {panel?.sleepStages.summaryLabel ? (
              <p className="text-xs text-gray-400">Vendor: {panel.sleepStages.summaryLabel}</p>
            ) : null}
          </div>
        </div>
      </Pro2SectionCard>

      <Pro2SectionCard accent="emerald" title="Laboratorio e serie continue" subtitle="Glucosio, lattato, gas, NIRS…" icon={Beaker}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCell
            label="Glucosio (panel)"
            value={fmtNum(panel?.biomarkers.glucoseMmolL ?? null, 2)}
            unit="mmol/L"
            hint={`Pannelli biomarker con sample_date = ${date}`}
          />
          <MetricCell label="Lattato (panel)" value={fmtNum(panel?.biomarkers.lactateMmolL ?? null, 2)} unit="mmol/L" />
          <MetricCell label="VO₂ (panel)" value={fmtNum(panel?.biomarkers.vo2LMin ?? null, 2)} unit="L/min" />
          <MetricCell label="VCO₂ (panel)" value={fmtNum(panel?.biomarkers.vco2LMin ?? null, 2)} unit="L/min" />
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Pannelli trovati: <span className="font-mono text-gray-300">{panel?.biomarkers.panelCount ?? 0}</span> — le serie
          continue (CGM, core temp, ormoni, SmO₂ muscolare) richiedono ingest dedicata; qui sotto il segnaposto grafico
          allineato al canone Pro 2.
        </p>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <TimeSeriesPlaceholder
            title="Glucosio interstiziale / CGM"
            subtitle={panel?.labTracksAvailability.glucoseCgm ? "Chiavi glucose presenti nei panel." : "Nessuna chiave CGM rilevata nei panel di oggi."}
            unitHint="mmol/L · t"
          />
          <TimeSeriesPlaceholder
            title="Lattato ematico continuo"
            subtitle={panel?.labTracksAvailability.lactateContinuous ? "Riferimenti lattato in values." : "Da integrare con stream lab."}
            unitHint="mmol/L · t"
          />
          <TimeSeriesPlaceholder
            title="Core temperature"
            subtitle={panel?.labTracksAvailability.coreTempContinuous ? "Segnali temperatura core in values." : "Da belt / pill / lab."}
            unitHint="°C · t"
          />
          <TimeSeriesPlaceholder
            title="Ormoni · panel seriali"
            subtitle={panel?.labTracksAvailability.hormonePanels ? "Chiavi ormonali rilevate." : "Upload documenti Health / lab."}
            unitHint="unità · t"
          />
          <TimeSeriesPlaceholder
            title="SmO₂ muscolare / NIRS"
            subtitle={panel?.labTracksAvailability.muscleSmo2Continuous ? "Segnali SmO₂/NIRS in values." : "Sessione + wearables NIRS."}
            unitHint="% · t"
          />
          <TimeSeriesPlaceholder
            title="VO₂ / VCO₂ · spirometria"
            subtitle={panel?.labTracksAvailability.gasExchangeLab ? "Gas exchange in values." : "Cardiopolmonare / lab metabolic."}
            unitHint="L/min · t"
          />
        </div>
      </Pro2SectionCard>

      <Pro2SectionCard accent="slate" title="Fonti merge" subtitle="Export device mappati a questa data" icon={Heart}>
        {panel?.sources?.length ? (
          <ul className="space-y-2 font-mono text-xs text-gray-300">
            {panel.sources.map((s, i) => (
              <li key={`${s.provider}-${s.created_at}-${i}`}>
                {s.provider} · {s.created_at ? new Date(s.created_at).toLocaleString("it-IT") : "—"}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">Nessuna riga device_sync_exports associata a questa data.</p>
        )}
        <p className="mt-4 text-xs text-gray-500">
          Overlay dei segnali sul grafico allenamento (stessa giornata) è previsto come passo successivo: stessa chiave data
          ISO tra Training session e questa vista.
        </p>
      </Pro2SectionCard>
    </Pro2ModulePageShell>
  );
}
