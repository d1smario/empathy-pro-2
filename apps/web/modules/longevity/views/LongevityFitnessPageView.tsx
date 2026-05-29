"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Award, HeartPulse, Sparkles } from "lucide-react";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { Pro2AthleteRequiredGate } from "@/components/shell/Pro2AthleteRequiredGate";
import { Pro2Button } from "@/components/ui/empathy";
import { cn } from "@/lib/cn";
import {
  COIN_TIERS,
  DAILY_CHECKIN_SYMPTOMS,
  type DailyCheckin,
  type DailyCheckinSymptom,
  type EmpathyCoinBalance,
  type EpiPillarId,
  type EpiResult,
} from "@/lib/empathy/schemas";

type LongevityFitnessPayload = {
  epi: EpiResult;
  checkin: DailyCheckin | null;
  balance: EmpathyCoinBalance;
  snapshotDate: string;
};

const SCALES: Array<{ key: keyof CheckinForm; label: string; hint: string }> = [
  { key: "energy", label: "Energia", hint: "1 scarica · 5 al top" },
  { key: "mood", label: "Umore", hint: "1 basso · 5 ottimo" },
  { key: "sleepQuality", label: "Qualità sonno", hint: "1 pessima · 5 eccellente" },
  { key: "motivation", label: "Motivazione", hint: "1 nulla · 5 alta" },
  { key: "soreness", label: "Indolenzimento", hint: "1 nessuno · 5 forte" },
  { key: "stress", label: "Stress", hint: "1 nessuno · 5 forte" },
];

const SYMPTOM_LABELS: Record<DailyCheckinSymptom, string> = {
  fever: "Febbre",
  headache: "Mal di testa",
  sore_throat: "Mal di gola",
  gi_upset: "Disturbi GI",
  cold_flu: "Raffreddore/influenza",
  injury: "Infortunio",
  other: "Altro",
};

const PILLAR_LABELS: Record<EpiPillarId, string> = {
  activity_load: "Carico & attività",
  recovery: "Recupero",
  hrv: "HRV",
  sleep: "Sonno",
  nutrition: "Nutrizione",
  body_composition: "Composizione corporea",
  protocol_adherence: "Aderenza protocolli",
  subjective_wellness: "Benessere soggettivo",
};

type CheckinForm = {
  energy: number | null;
  mood: number | null;
  sleepQuality: number | null;
  motivation: number | null;
  soreness: number | null;
  stress: number | null;
};

const EMPTY_FORM: CheckinForm = {
  energy: null,
  mood: null,
  sleepQuality: null,
  motivation: null,
  soreness: null,
  stress: null,
};

function tierColor(tier: EmpathyCoinBalance["tier"]): string {
  if (tier === "gold") return "text-amber-300";
  if (tier === "silver") return "text-slate-200";
  if (tier === "bronze") return "text-orange-300";
  return "text-gray-500";
}

function ScaleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-gray-200">{label}</span>
        <span className="text-[0.65rem] text-gray-500">{hint}</span>
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-pressed={value === n}
            className={cn(
              "h-10 flex-1 rounded-xl border font-mono text-sm font-bold transition",
              value === n
                ? "border-transparent bg-gradient-to-r from-fuchsia-600 to-orange-500 text-white shadow-lg shadow-fuchsia-500/25"
                : "border-white/15 bg-black/40 text-gray-400 hover:border-fuchsia-500/40 hover:text-white",
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function LongevityFitnessPageView() {
  const { athleteId, signedIn } = useActiveAthlete();
  const [data, setData] = useState<LongevityFitnessPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CheckinForm>(EMPTY_FORM);
  const [symptoms, setSymptoms] = useState<DailyCheckinSymptom[]>([]);
  const [note, setNote] = useState("");

  const hydrateFromCheckin = useCallback((checkin: DailyCheckin | null) => {
    setForm({
      energy: checkin?.energy ?? null,
      mood: checkin?.mood ?? null,
      sleepQuality: checkin?.sleepQuality ?? null,
      motivation: checkin?.motivation ?? null,
      soreness: checkin?.soreness ?? null,
      stress: checkin?.stress ?? null,
    });
    setSymptoms(checkin?.illnessFlags ?? []);
    setNote(checkin?.note ?? "");
  }, []);

  const loadIndex = useCallback(
    async (id: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/longevity/index?athleteId=${encodeURIComponent(id)}`, { cache: "no-store" });
        const json = (await res.json()) as LongevityFitnessPayload & { error?: string };
        if (!res.ok) throw new Error(json.error ?? "Errore caricamento");
        setData(json);
        hydrateFromCheckin(json.checkin);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Errore caricamento");
      } finally {
        setLoading(false);
      }
    },
    [hydrateFromCheckin],
  );

  useEffect(() => {
    if (athleteId) void loadIndex(athleteId);
  }, [athleteId, loadIndex]);

  const toggleSymptom = useCallback((s: DailyCheckinSymptom) => {
    setSymptoms((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }, []);

  const saveCheckin = useCallback(async () => {
    if (!athleteId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/longevity/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteId, ...form, illnessFlags: symptoms, note }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Errore salvataggio");
      await loadIndex(athleteId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  }, [athleteId, form, symptoms, note, loadIndex]);

  const epi = data?.epi ?? null;
  const balance = data?.balance ?? null;

  const pillars = useMemo(() => (epi?.pillars ?? []).filter((p) => p.available), [epi]);

  return (
    <Pro2ModulePageShell
      eyebrow="Health-to-Earn · indice fisiologico"
      eyebrowClassName="text-fuchsia-400"
      title="Longevity & Fitness"
      description="Longevity & Fitness Index deterministico dai tuoi dati reali + check-in giornaliero. Ogni giorno efficiente vale Empathy Coin verso Bronze, Silver, Gold."
    >
      <Pro2AthleteRequiredGate enabled={signedIn}>
        {error ? (
          <div className="rounded-xl border border-rose-500/35 bg-rose-950/20 px-4 py-3 text-sm text-rose-200">{error}</div>
        ) : null}

        <Pro2SectionCard accent="fuchsia" title="Longevity & Fitness Index" subtitle="EPI · motore deterministico (AI solo interpretazione)" icon={HeartPulse}>
          {loading && !epi ? (
            <p className="text-sm text-gray-400">Calcolo in corso…</p>
          ) : epi ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
                <div>
                  <span className="font-mono text-5xl font-black tabular-nums text-white">{Math.round(epi.score)}</span>
                  <span className="ml-1 text-sm text-gray-500">/100</span>
                </div>
                <div className="text-xs text-gray-400">
                  <p>Confidenza {Math.round(epi.confidence * 100)}% · copertura {epi.dataTier}</p>
                  <p className="mt-0.5">
                    {epi.efficientDay ? (
                      <span className="text-emerald-300">Giorno efficiente · +{epi.coinAwardForDay} Coin</span>
                    ) : epi.illnessDay ? (
                      <span className="text-amber-300">Giorno di malessere · obiettivo sospeso</span>
                    ) : (
                      <span className="text-gray-500">Giorno non ancora efficiente</span>
                    )}
                  </p>
                </div>
              </div>

              {epi.illnessDay ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-2.5 text-xs text-amber-200">
                  Hai segnalato un malessere: nessuna penalità sull&apos;indice e nessun Coin perso. Priorità al recupero.
                </div>
              ) : null}

              <div className="space-y-2.5">
                {pillars.map((p) => (
                  <div key={p.pillar} className="flex items-center gap-3">
                    <span className="w-44 shrink-0 text-xs text-gray-400">{PILLAR_LABELS[p.pillar]}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-orange-400"
                        style={{ width: `${Math.round(p.score ?? 0)}%` }}
                      />
                    </div>
                    <span className="w-9 shrink-0 text-right font-mono text-xs tabular-nums text-gray-300">
                      {Math.round(p.score ?? 0)}
                    </span>
                  </div>
                ))}
                {!pillars.length ? (
                  <p className="text-xs text-gray-500">
                    Nessun segnale ancora disponibile. Compila il check-in e collega un device per alimentare l&apos;indice.
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Indice non disponibile.</p>
          )}
        </Pro2SectionCard>

        <Pro2SectionCard accent="violet" title="Check-in di oggi" subtitle="Come ti senti · segnala eventuali malesseri" icon={Activity}>
          <div className="grid gap-4 sm:grid-cols-2">
            {SCALES.map((s) => (
              <ScaleRow
                key={s.key}
                label={s.label}
                hint={s.hint}
                value={form[s.key]}
                onChange={(v) => setForm((prev) => ({ ...prev, [s.key]: v }))}
              />
            ))}
          </div>

          <div className="mt-5">
            <p className="mb-2 text-sm font-medium text-gray-200">Malessere (opzionale)</p>
            <div className="flex flex-wrap gap-2">
              {DAILY_CHECKIN_SYMPTOMS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSymptom(s)}
                  aria-pressed={symptoms.includes(s)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                    symptoms.includes(s)
                      ? "border-amber-400/50 bg-amber-500/20 text-amber-100"
                      : "border-white/15 bg-black/30 text-gray-400 hover:border-amber-500/40 hover:text-amber-100",
                  )}
                >
                  {SYMPTOM_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <label htmlFor="longevity-note" className="mb-1.5 block text-xs font-medium text-gray-400">
              Nota (opzionale)
            </label>
            <textarea
              id="longevity-note"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              rows={2}
              placeholder="Es. notte agitata, dolore al ginocchio…"
              className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <div className="mt-5 flex justify-end">
            <Pro2Button onClick={saveCheckin} disabled={saving || !athleteId}>
              {saving ? "Salvataggio…" : "Salva check-in"}
            </Pro2Button>
          </div>
        </Pro2SectionCard>

        <Pro2SectionCard accent="amber" title="Empathy Coin" subtitle="Certificazione Bronze · Silver · Gold" icon={Award}>
          {balance ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
                <div>
                  <span className="font-mono text-4xl font-black tabular-nums text-white">{balance.totalCoins.toLocaleString("it-IT")}</span>
                  <span className="ml-1 text-sm text-gray-500">Coin</span>
                </div>
                <div className={cn("flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide", tierColor(balance.tier))}>
                  <Sparkles className="h-4 w-4" aria-hidden />
                  {balance.tier ?? "Nessun tier"}
                </div>
                <span className="text-xs text-gray-500">{balance.efficientDays} giorni efficienti</span>
              </div>

              {balance.nextTier ? (
                <div>
                  <div className="mb-1 flex justify-between text-[0.65rem] text-gray-500">
                    <span>Verso {balance.nextTier.next}</span>
                    <span>
                      {balance.totalCoins.toLocaleString("it-IT")} / {COIN_TIERS[balance.nextTier.next].toLocaleString("it-IT")}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-orange-400 to-amber-300"
                      style={{
                        width: `${Math.min(100, Math.round((balance.totalCoins / COIN_TIERS[balance.nextTier.next]) * 100))}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-gray-500">
                    Mancano {balance.nextTier.remaining.toLocaleString("it-IT")} Coin a {balance.nextTier.next}.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-amber-200">Hai raggiunto il livello massimo: Gold.</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Saldo non disponibile.</p>
          )}
        </Pro2SectionCard>
      </Pro2AthleteRequiredGate>
    </Pro2ModulePageShell>
  );
}
