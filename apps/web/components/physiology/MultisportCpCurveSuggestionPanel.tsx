"use client";

import { useCallback, useMemo, useState } from "react";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-session";
import type { MultisportCpCurveSuggestionMode, MultisportCpCurveSuggestionOutput } from "@/lib/engines/multisport-cp-curve-suggestion";
import { MULTISPORT_CP_CURVE_LABELS } from "@/lib/engines/multisport-cp-curve-suggestion";
import type { MultisportEngineSport } from "@/lib/engines/multisport-energy-engine";
import { Pro2Button } from "@/components/ui/empathy";

const SPORTS: { id: MultisportEngineSport; label: string }[] = [
  { id: "cycling", label: "Ciclismo" },
  { id: "running", label: "Running" },
  { id: "swimming", label: "Nuoto" },
  { id: "xc_ski", label: "Sci di fondo" },
  { id: "ski_alpine", label: "Sci alpino" },
  { id: "soccer", label: "Calcio" },
  { id: "team_court", label: "Squadra (campo / parquet)" },
];

const MODES: { id: MultisportCpCurveSuggestionMode; label: string; hint: string }[] = [
  {
    id: "cycling_power_anchors",
    label: "Ciclismo · anchor potenza",
    hint: "Almeno 2 coppie durata (s) / W da test o file.",
  },
  {
    id: "running_race_riegel",
    label: "Running / campo · gara (Riegel)",
    hint: "Distanza (m) e tempo (s) — anche una sola gara.",
  },
  {
    id: "swimming_pace_riegel",
    label: "Nuoto · passo (Riegel)",
    hint: "Stesso schema gara; stimatore drag-cubico.",
  },
  {
    id: "velocity_sport_riegel",
    label: "Sci · gara / passo (Riegel)",
    hint: "Usa distanza/tempo; modello velocità + pendenza opzionale.",
  },
  {
    id: "reference_w_phenotype",
    label: "W di riferimento + fenotipo",
    hint: "Un solo W equivalente (tipo soglia) e forma curva template.",
  },
];

function parseNum(raw: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export type MultisportCpCurveSuggestionPanelProps = {
  athleteId: string;
  bodyMassKg: number;
  /** Dopo aver riempito i campi CP in anteprima (non salva Supabase). */
  onApplyToCpInputs: (wByLabel: Partial<Record<string, number>>) => void;
  onAfterApply?: () => void;
};

export function MultisportCpCurveSuggestionPanel({
  athleteId,
  bodyMassKg,
  onApplyToCpInputs,
  onAfterApply,
}: MultisportCpCurveSuggestionPanelProps) {
  const [sport, setSport] = useState<MultisportEngineSport>("running");
  const [mode, setMode] = useState<MultisportCpCurveSuggestionMode>("running_race_riegel");
  const [efficiencyStr, setEfficiencyStr] = useState("0.24");
  const [gradePctStr, setGradePctStr] = useState("0");

  const [cD1, setCD1] = useState("300");
  const [cP1, setCP1] = useState("280");
  const [cD2, setCD2] = useState("1200");
  const [cP2, setCP2] = useState("220");

  const [raceD1, setRaceD1] = useState("5000");
  const [raceT1, setRaceT1] = useState("1200");
  const [raceD2, setRaceD2] = useState("");
  const [raceT2, setRaceT2] = useState("");

  const [refW, setRefW] = useState("240");
  const [phenotype, setPhenotype] = useState<"oxidative" | "balanced" | "glycolytic">("balanced");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<MultisportCpCurveSuggestionOutput | null>(null);

  const massOk = useMemo(() => bodyMassKg >= 35 && bodyMassKg <= 120, [bodyMassKg]);

  const buildRequestBody = useCallback(() => {
    const efficiency = parseNum(efficiencyStr);
    const gradePct = parseNum(gradePctStr);
    const gradeFraction = gradePct != null ? gradePct / 100 : undefined;

    const effectiveSport: MultisportEngineSport =
      mode === "swimming_pace_riegel" ? "swimming" : mode === "cycling_power_anchors" ? "cycling" : sport;

    const base = {
      athleteId,
      sport: effectiveSport,
      bodyMassKg,
      mode,
      efficiency: efficiency ?? undefined,
      gradeFraction,
    };

    if (mode === "cycling_power_anchors") {
      const d1 = parseNum(cD1);
      const p1 = parseNum(cP1);
      const d2 = parseNum(cD2);
      const p2 = parseNum(cP2);
      const powerAnchors = [
        ...(d1 != null && p1 != null && d1 > 0 && p1 > 0 ? [{ durationSec: d1, powerW: p1 }] : []),
        ...(d2 != null && p2 != null && d2 > 0 && p2 > 0 ? [{ durationSec: d2, powerW: p2 }] : []),
      ];
      return { ...base, sport: "cycling" as const, powerAnchors };
    }

    if (mode === "reference_w_phenotype") {
      const rw = parseNum(refW);
      return { ...base, referenceWatts: rw ?? undefined, phenotype };
    }

    const rd1 = parseNum(raceD1);
    const rt1 = parseNum(raceT1);
    const rd2 = parseNum(raceD2);
    const rt2 = parseNum(raceT2);
    const raceAnchors = [
      ...(rd1 != null && rt1 != null && rd1 > 0 && rt1 > 0 ? [{ distanceM: rd1, timeSec: rt1 }] : []),
      ...(rd2 != null && rt2 != null && rd2 > 0 && rt2 > 0 ? [{ distanceM: rd2, timeSec: rt2 }] : []),
    ];
    return { ...base, raceAnchors };
  }, [
    athleteId,
    sport,
    bodyMassKg,
    mode,
    efficiencyStr,
    gradePctStr,
    cD1,
    cP1,
    cD2,
    cP2,
    raceD1,
    raceT1,
    raceD2,
    raceT2,
    refW,
    phenotype,
  ]);

  const runSuggest = useCallback(async () => {
    setErr(null);
    setResult(null);
    if (!massOk) {
      setErr("Imposta un peso atleta valido (35–120 kg) nel lab prima di calcolare.");
      return;
    }
    setLoading(true);
    try {
      const headers = await buildSupabaseAuthHeaders({ "Content-Type": "application/json" });
      const res = await fetch("/api/physiology/multisport-cp-curve", {
        method: "POST",
        headers,
        body: JSON.stringify(buildRequestBody()),
      });
      const json = (await res.json().catch(() => ({}))) as MultisportCpCurveSuggestionOutput & { error?: string };
      if (!res.ok) {
        setErr(json.error ?? `Errore HTTP ${res.status}`);
        return;
      }
      if (json.error) {
        setErr(json.error);
        return;
      }
      setResult(json as MultisportCpCurveSuggestionOutput);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Errore di rete");
    } finally {
      setLoading(false);
    }
  }, [buildRequestBody, massOk]);

  const applyPreview = useCallback(() => {
    if (!result?.cpCurveInputsW) return;
    const out: Partial<Record<string, number>> = {};
    for (const label of MULTISPORT_CP_CURVE_LABELS) {
      const w = result.cpCurveInputsW[label];
      if (typeof w === "number" && w > 0) out[label] = w;
    }
    if (Object.keys(out).length === 0) {
      setErr("Nessun punto W da applicare: ricalcola o controlla gli input.");
      return;
    }
    onApplyToCpInputs(out);
    onAfterApply?.();
    setErr(null);
  }, [result, onApplyToCpInputs, onAfterApply]);

  const modeMeta = MODES.find((m) => m.id === mode);

  return (
    <div className="rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-slate-900/90 via-black/40 to-black/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold tracking-wide text-cyan-100/95">Multisport · suggerimento curva CP</h3>
          <p className="mt-1 max-w-prose text-xs leading-relaxed text-slate-500">
            W equivalenti ciclismo sugli 8 punti del lab + VO₂ deterministico (stesso stack <code className="text-slate-400">estimateVo2FromDevice</code>). Calcolo
            server; <strong className="text-slate-300">applica solo in anteprima</strong> ai campi sotto — poi &quot;Salva snapshot&quot; come sempre.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Sport
          <select
            className="rounded-lg border border-white/15 bg-black/40 px-2 py-2 text-sm text-slate-100"
            value={sport}
            onChange={(e) => setSport(e.target.value as MultisportEngineSport)}
          >
            {SPORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-400 sm:col-span-2">
          Modalità
          <select
            className="rounded-lg border border-white/15 bg-black/40 px-2 py-2 text-sm text-slate-100"
            value={mode}
            onChange={(e) => setMode(e.target.value as MultisportCpCurveSuggestionMode)}
          >
            {MODES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          η (efficienza)
          <input
            className="rounded-lg border border-white/15 bg-black/40 px-2 py-2 font-mono text-sm text-slate-100"
            value={efficiencyStr}
            onChange={(e) => setEfficiencyStr(e.target.value)}
            inputMode="decimal"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          Pendenza %
          <input
            className="rounded-lg border border-white/15 bg-black/40 px-2 py-2 font-mono text-sm text-slate-100"
            value={gradePctStr}
            onChange={(e) => setGradePctStr(e.target.value)}
            inputMode="decimal"
            placeholder="0"
          />
        </label>
      </div>

      {modeMeta ? <p className="mt-2 text-[0.65rem] text-slate-500">{modeMeta.hint}</p> : null}

      {mode === "cycling_power_anchors" ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-400">
              Durata 1 (s)
              <input className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-sm" value={cD1} onChange={(e) => setCD1(e.target.value)} />
            </label>
            <label className="text-xs text-slate-400">
              W 1
              <input className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-sm" value={cP1} onChange={(e) => setCP1(e.target.value)} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-400">
              Durata 2 (s)
              <input className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-sm" value={cD2} onChange={(e) => setCD2(e.target.value)} />
            </label>
            <label className="text-xs text-slate-400">
              W 2
              <input className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-sm" value={cP2} onChange={(e) => setCP2(e.target.value)} />
            </label>
          </div>
        </div>
      ) : null}

      {mode === "reference_w_phenotype" ? (
        <div className="mt-3 flex flex-wrap gap-3">
          <label className="text-xs text-slate-400">
            W riferimento
            <input
              className="mt-1 block w-32 rounded border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-sm"
              value={refW}
              onChange={(e) => setRefW(e.target.value)}
            />
          </label>
          <label className="text-xs text-slate-400">
            Fenotipo
            <select
              className="mt-1 block rounded border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-slate-100"
              value={phenotype}
              onChange={(e) => setPhenotype(e.target.value as "oxidative" | "balanced" | "glycolytic")}
            >
              <option value="oxidative">Ossidativo</option>
              <option value="balanced">Bilanciato</option>
              <option value="glycolytic">Glicolitico</option>
            </select>
          </label>
        </div>
      ) : null}

      {mode === "running_race_riegel" ||
      mode === "swimming_pace_riegel" ||
      mode === "velocity_sport_riegel" ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-400">
              Distanza 1 (m)
              <input className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-sm" value={raceD1} onChange={(e) => setRaceD1(e.target.value)} />
            </label>
            <label className="text-xs text-slate-400">
              Tempo 1 (s)
              <input className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-sm" value={raceT1} onChange={(e) => setRaceT1(e.target.value)} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-400">
              Distanza 2 (m) opz.
              <input className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-sm" value={raceD2} onChange={(e) => setRaceD2(e.target.value)} />
            </label>
            <label className="text-xs text-slate-400">
              Tempo 2 (s) opz.
              <input className="mt-1 w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-sm" value={raceT2} onChange={(e) => setRaceT2(e.target.value)} />
            </label>
          </div>
        </div>
      ) : null}

      <p className="mt-2 text-[0.65rem] text-slate-600">
        Peso usato: <span className="font-mono text-slate-400">{bodyMassKg.toFixed(1)}</span> kg
        {!massOk ? " — imposta peso nel lab (campi massa / profilo)." : null}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Pro2Button type="button" variant="secondary" className="border border-cyan-500/35 bg-cyan-500/10" disabled={loading} onClick={() => void runSuggest()}>
          {loading ? "Calcolo…" : "Calcola suggerimento"}
        </Pro2Button>
        <Pro2Button type="button" variant="primary" disabled={!result || loading} onClick={applyPreview}>
          Applica in anteprima alla curva CP
        </Pro2Button>
      </div>

      {err ? (
        <p className="mt-2 text-sm text-amber-300/95" role="alert">
          {err}
        </p>
      ) : null}

      {result ? (
        <div className="mt-4 space-y-2 rounded-xl border border-white/10 bg-black/25 p-3">
          <p className="text-xs text-slate-400">{result.handoffHintIt}</p>
          {result.notes.length ? (
            <ul className="list-inside list-disc text-[0.65rem] text-slate-500">
              {result.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-500">
                  <th className="py-1 pr-2">Durata</th>
                  <th className="py-1 pr-2">W eq.</th>
                  <th className="py-1">VO₂ ml/kg/min</th>
                </tr>
              </thead>
              <tbody>
                {MULTISPORT_CP_CURVE_LABELS.map((label) => (
                  <tr key={label} className="border-b border-white/5 font-mono text-slate-200">
                    <td className="py-1 pr-2">{label}</td>
                    <td className="py-1 pr-2">{result.cpCurveInputsW[label] != null ? `${Math.round(result.cpCurveInputsW[label]!)}` : "—"}</td>
                    <td className="py-1">{result.vo2MlKgMinByLabel[label] != null ? result.vo2MlKgMinByLabel[label]!.toFixed(1) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
