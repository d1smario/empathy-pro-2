"use client";

import { useState } from "react";
import { Activity, Route } from "lucide-react";
import { Pro2Button } from "@/components/ui/empathy";

export type MaxOxSegmentForm = {
  duration_min: string;
  distance_km: string;
  elevation_m: string;
  power_w: string;
  velocity_m_min: string;
  grade_pct: string;
  smo2_work: string;
  smo2_rest: string;
  lactate_mmol: string;
  core_temp_c: string;
};

const EMPTY: MaxOxSegmentForm = {
  duration_min: "20",
  distance_km: "",
  elevation_m: "",
  power_w: "",
  velocity_m_min: "",
  grade_pct: "",
  smo2_work: "",
  smo2_rest: "",
  lactate_mmol: "",
  core_temp_c: "",
};

const inputClass =
  "w-full rounded-lg border border-white/15 bg-black/35 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-rose-400/50 focus:outline-none focus:ring-1 focus:ring-rose-500/30";

export function MaxOxSegmentPanelPro2({
  onSyncProfile,
  onSyncLactate,
  onApplySegment,
  lastSegmentVo2LMin,
  lastSegmentO2TotalL,
  lastSegmentDurationMin,
}: {
  onSyncProfile: () => void;
  onSyncLactate: () => void;
  onApplySegment: (form: MaxOxSegmentForm) => void;
  lastSegmentVo2LMin: number | null;
  lastSegmentO2TotalL: number | null;
  lastSegmentDurationMin: number | null;
}) {
  const [form, setForm] = useState<MaxOxSegmentForm>(EMPTY);

  const set =
    (key: keyof MaxOxSegmentForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((s) => ({ ...s, [key]: e.target.value }));

  return (
    <div className="physiology-pro2-lab-page-panel">
      <div className="physiology-pro2-lab-banner physiology-pro2-lab-banner--maxox-inputs">
        <Route className="physiology-pro2-lab-banner-ico" aria-hidden />
        <span>Segmento a carico stabile · profilo / lactate</span>
        <Activity className="physiology-pro2-lab-banner-ico" aria-hidden />
      </div>
      <p className="mb-3 max-w-[62ch] text-xs leading-relaxed text-slate-500">
        La <strong className="text-slate-300">capacità ossidativa</strong> nel motore resta la{" "}
        <strong className="text-slate-300">VO₂max da Metabolic Profile</strong> (fonte device). Qui stimiamo il{" "}
        <strong className="text-slate-300">VO₂ al carico del segmento</strong> (L/min) e l’<strong className="text-slate-300">O₂ cumulativo</strong>{" "}
        (L/min × minuti). Usa un tratto omogeneo (es. salita costante).
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        <Pro2Button
          type="button"
          variant="secondary"
          className="border border-rose-500/35 bg-rose-500/10 text-rose-100 hover:bg-rose-500/16"
          onClick={onSyncProfile}
        >
          Prendi da Metabolic Profile
        </Pro2Button>
        <Pro2Button
          type="button"
          variant="secondary"
          className="border border-rose-500/35 bg-rose-500/10 text-rose-100 hover:bg-rose-500/16"
          onClick={onSyncLactate}
        >
          Prendi da Lactate lab
        </Pro2Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">
          Durata (min)
          <input className={`${inputClass} mt-1`} type="number" min={0} step={0.5} value={form.duration_min} onChange={set("duration_min")} />
        </label>
        <label className="block text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">
          Potenza media (W)
          <input className={`${inputClass} mt-1`} type="number" min={0} value={form.power_w} onChange={set("power_w")} placeholder="es. 280" />
        </label>
        <label className="block text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">
          Dislivello (m)
          <input className={`${inputClass} mt-1`} type="number" value={form.elevation_m} onChange={set("elevation_m")} placeholder="opz." />
        </label>
        <label className="block text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">
          Distanza orizz. (km)
          <input
            className={`${inputClass} mt-1`}
            type="number"
            min={0}
            step={0.01}
            value={form.distance_km}
            onChange={set("distance_km")}
            placeholder="per pendenza %"
          />
        </label>
        <label className="block text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">
          Pendenza manuale (%)
          <input className={`${inputClass} mt-1`} type="number" value={form.grade_pct} onChange={set("grade_pct")} placeholder="opz." />
        </label>
        <label className="block text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">
          Velocità (m/min)
          <input className={`${inputClass} mt-1`} type="number" min={0} value={form.velocity_m_min} onChange={set("velocity_m_min")} placeholder="run/ski" />
        </label>
        <label className="block text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">
          SmO₂ lavoro (%)
          <input className={`${inputClass} mt-1`} type="number" value={form.smo2_work} onChange={set("smo2_work")} placeholder="opz." />
        </label>
        <label className="block text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">
          SmO₂ riposo (%)
          <input className={`${inputClass} mt-1`} type="number" value={form.smo2_rest} onChange={set("smo2_rest")} placeholder="opz." />
        </label>
        <label className="block text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">
          Lattato (mmol/L)
          <input className={`${inputClass} mt-1`} type="number" min={0} step={0.1} value={form.lactate_mmol} onChange={set("lactate_mmol")} placeholder="opz." />
        </label>
        <label className="block text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">
          Temp. core (°C)
          <input className={`${inputClass} mt-1`} type="number" step={0.1} value={form.core_temp_c} onChange={set("core_temp_c")} placeholder="opz." />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Pro2Button type="button" variant="primary" className="bg-gradient-to-r from-rose-600 to-fuchsia-700 hover:opacity-95" onClick={() => onApplySegment(form)}>
          Applica segmento a Max Oxidate
        </Pro2Button>
        {lastSegmentVo2LMin != null && lastSegmentDurationMin != null ? (
          <span className="text-xs text-slate-500">
            Ultimo: VO₂ al carico <strong className="text-rose-300">{lastSegmentVo2LMin.toFixed(2)} L/min</strong>
            {lastSegmentO2TotalL != null ? (
              <>
                {" "}
                · O₂ cumulativo ~<strong className="text-cyan-300">{lastSegmentO2TotalL.toFixed(2)} L</strong> / {lastSegmentDurationMin.toFixed(1)} min
              </>
            ) : null}
          </span>
        ) : null}
      </div>
    </div>
  );
}
