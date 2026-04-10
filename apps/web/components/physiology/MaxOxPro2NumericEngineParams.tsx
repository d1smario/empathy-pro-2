"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Droplets,
  Flame,
  Gauge,
  HeartPulse,
  Mountain,
  Scale,
  Target,
  ThermometerSun,
  TrendingUp,
  Wind,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type MaxOxVo2Mode = "device" | "test";

type ParamDef = {
  key: string;
  label: string;
  unit: string;
  gradient: string;
  glow: string;
  Icon: LucideIcon;
  inputStep?: string;
};

const MAXOX_ENGINE_PARAM_DEFS: ParamDef[] = [
  {
    key: "vo2_l_min",
    label: "VO2 test",
    unit: "L/min",
    gradient: "linear-gradient(145deg, #38bdf8, #0284c7)",
    glow: "0 0 22px rgba(56,189,248,0.32)",
    Icon: HeartPulse,
    inputStep: "0.01",
  },
  {
    key: "body_mass_kg",
    label: "Body mass",
    unit: "kg",
    gradient: "linear-gradient(145deg, #ec4899, #db2777)",
    glow: "0 0 22px rgba(236,72,153,0.32)",
    Icon: Scale,
  },
  {
    key: "power_w",
    label: "Power",
    unit: "W",
    gradient: "linear-gradient(145deg, #f97316, #ea580c)",
    glow: "0 0 22px rgba(249,115,22,0.32)",
    Icon: Zap,
  },
  {
    key: "velocity_m_min",
    label: "Velocity",
    unit: "m/min",
    gradient: "linear-gradient(145deg, #06b6d4, #0891b2)",
    glow: "0 0 22px rgba(6,182,212,0.32)",
    Icon: Wind,
    inputStep: "0.01",
  },
  {
    key: "grade_pct",
    label: "Grade",
    unit: "%",
    gradient: "linear-gradient(145deg, #a78bfa, #7c3aed)",
    glow: "0 0 22px rgba(167,139,250,0.32)",
    Icon: Mountain,
    inputStep: "0.01",
  },
  {
    key: "ftp_w",
    label: "FTP",
    unit: "W",
    gradient: "linear-gradient(145deg, #f59e0b, #d97706)",
    glow: "0 0 22px rgba(245,158,11,0.32)",
    Icon: Flame,
  },
  {
    key: "efficiency",
    label: "Efficiency",
    unit: "",
    gradient: "linear-gradient(145deg, #22c55e, #15803d)",
    glow: "0 0 22px rgba(34,197,94,0.32)",
    Icon: Gauge,
    inputStep: "0.01",
  },
  {
    key: "rer",
    label: "RER",
    unit: "",
    gradient: "linear-gradient(145deg, #c084fc, #9333ea)",
    glow: "0 0 22px rgba(192,132,252,0.32)",
    Icon: Target,
    inputStep: "0.01",
  },
  {
    key: "smo2_rest_pct",
    label: "SmO2 rest",
    unit: "%",
    gradient: "linear-gradient(145deg, #14b8a6, #0f766e)",
    glow: "0 0 22px rgba(20,184,166,0.32)",
    Icon: Droplets,
  },
  {
    key: "smo2_work_pct",
    label: "SmO2 work",
    unit: "%",
    gradient: "linear-gradient(145deg, #5eead4, #0d9488)",
    glow: "0 0 22px rgba(94,234,212,0.28)",
    Icon: Droplets,
  },
  {
    key: "lactate_mmol_l",
    label: "Lactate",
    unit: "mmol/L",
    gradient: "linear-gradient(145deg, #fb7185, #e11d48)",
    glow: "0 0 22px rgba(251,113,133,0.28)",
    Icon: Activity,
    inputStep: "0.01",
  },
  {
    key: "lactate_trend_mmol_h",
    label: "Lactate trend",
    unit: "mmol/h",
    gradient: "linear-gradient(145deg, #f97316, #c2410c)",
    glow: "0 0 22px rgba(249,115,22,0.28)",
    Icon: TrendingUp,
    inputStep: "0.01",
  },
  {
    key: "core_temp_c",
    label: "Core temp",
    unit: "°C",
    gradient: "linear-gradient(145deg, #f87171, #dc2626)",
    glow: "0 0 22px rgba(248,113,113,0.28)",
    Icon: ThermometerSun,
    inputStep: "0.1",
  },
  {
    key: "hemoglobin_g_dl",
    label: "Hemoglobin",
    unit: "g/dL",
    gradient: "linear-gradient(145deg, #94a3b8, #475569)",
    glow: "0 0 22px rgba(148,163,184,0.25)",
    Icon: Droplets,
    inputStep: "0.1",
  },
  {
    key: "sao2_pct",
    label: "SaO2",
    unit: "%",
    gradient: "linear-gradient(145deg, #22d3ee, #0891b2)",
    glow: "0 0 22px rgba(34,211,238,0.28)",
    Icon: HeartPulse,
  },
];

function fieldDisabled(key: string, vo2Mode: MaxOxVo2Mode): boolean {
  return key === "vo2_l_min" && vo2Mode === "device";
}

export function MaxOxPro2NumericEngineParams({
  input,
  onInputChange,
  vo2Mode,
}: {
  input: Record<string, string>;
  onInputChange: (key: string, value: string) => void;
  vo2Mode: MaxOxVo2Mode;
}) {
  const [editKey, setEditKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const closeEditor = useCallback(() => {
    setEditKey(null);
    setDraft("");
  }, []);

  useEffect(() => {
    if (!editKey) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeEditor();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editKey, closeEditor]);

  function openEditor(key: string, current: string) {
    setEditKey(key);
    setDraft(current);
  }

  function commitEditor() {
    if (!editKey) return;
    onInputChange(editKey, draft.trim() === "" ? "0" : draft.trim());
    closeEditor();
  }

  const editingDef = editKey ? MAXOX_ENGINE_PARAM_DEFS.find((d) => d.key === editKey) : null;

  return (
    <div className="physiology-pro2-eng-param-shell physiology-pro2-eng-param-shell--maxox">
      <div className="physiology-pro2-lab-banner physiology-pro2-lab-banner--maxox-engine-params">
        <Zap className="physiology-pro2-lab-banner-ico" aria-hidden />
        <span>Parametri numerici motore Max Oxidate</span>
        <Zap className="physiology-pro2-lab-banner-ico" aria-hidden />
      </div>
      <div className="physiology-pro2-eng-param-grid">
        {MAXOX_ENGINE_PARAM_DEFS.map((def) => {
          const disabled = fieldDisabled(def.key, vo2Mode);
          const Ico = def.Icon;
          const raw = input[def.key] ?? "";
          return (
            <div
              key={def.key}
              className={`physiology-pro2-eng-param-tile${disabled ? " physiology-pro2-eng-param-tile--locked" : ""}`}
              style={{
                background: def.gradient,
                boxShadow: `${def.glow}, inset 0 1px 0 rgba(255,255,255,0.12)`,
              }}
            >
              <div className="physiology-pro2-eng-param-tile-head">
                <span className="physiology-pro2-eng-param-tile-label">{def.label}</span>
                <Ico className="physiology-pro2-eng-param-tile-ico" aria-hidden />
              </div>
              {disabled ? (
                <span className="physiology-pro2-eng-param-tile-num">{raw || "—"}</span>
              ) : (
                <button
                  type="button"
                  className="physiology-pro2-eng-param-tile-hit"
                  aria-label={`Modifica ${def.label}`}
                  onClick={() => openEditor(def.key, raw)}
                >
                  <span className="physiology-pro2-eng-param-tile-num">{raw || "—"}</span>
                </button>
              )}
              <span className="physiology-pro2-eng-param-tile-unit">{def.unit || "—"}</span>
            </div>
          );
        })}
      </div>

      {editKey && editingDef ? (
        <div className="physiology-pro2-eng-param-editor-backdrop" role="presentation" onClick={closeEditor}>
          <div
            className="physiology-pro2-eng-param-editor physiology-pro2-eng-param-editor--maxox"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mox-param-editor-title"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="mox-param-editor-title" className="physiology-pro2-eng-param-editor-title physiology-pro2-eng-param-editor-title--maxox">
              {editingDef.label}
              {editingDef.unit ? ` (${editingDef.unit})` : ""}
            </p>
            <input
              className="physiology-pro2-eng-param-editor-input"
              type="number"
              step={editingDef.inputStep ?? "any"}
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitEditor();
                }
              }}
            />
            <div className="physiology-pro2-eng-param-editor-actions">
              <button type="button" className="physiology-pro2-eng-param-editor-btn physiology-pro2-eng-param-editor-btn--ghost" onClick={closeEditor}>
                Annulla
              </button>
              <button type="button" className="physiology-pro2-eng-param-editor-btn physiology-pro2-eng-param-editor-btn--ok-maxox" onClick={commitEditor}>
                Applica
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
