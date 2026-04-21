"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  Beaker,
  Bug,
  Droplets,
  Flame,
  Gauge,
  HeartPulse,
  Leaf,
  Mountain,
  Percent,
  PieChart,
  Scale,
  Target,
  ThermometerSun,
  Timer,
  UtensilsCrossed,
  Wind,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type LactateVo2Mode = "device" | "test";
export type LactateRerMode = "auto" | "manual";
export type LactateMicrobiotaSourceMode = "health_bio" | "preset" | "manual";

type ParamDef = {
  key: string;
  label: string;
  unit: string;
  gradient: string;
  glow: string;
  Icon: LucideIcon;
  inputStep?: string;
};

const LACTATE_ENGINE_PARAM_DEFS: ParamDef[] = [
  {
    key: "duration_min",
    label: "Duration",
    unit: "min",
    gradient: "linear-gradient(145deg, #6366f1, #4f46e5)",
    glow: "0 0 22px rgba(99,102,241,0.32)",
    Icon: Timer,
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
    key: "ftp_w",
    label: "FTP",
    unit: "W",
    gradient: "linear-gradient(145deg, #f59e0b, #d97706)",
    glow: "0 0 22px rgba(245,158,11,0.32)",
    Icon: Flame,
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
    key: "velocity_m_min",
    label: "Velocity",
    unit: "m/min",
    gradient: "linear-gradient(145deg, #06b6d4, #0891b2)",
    glow: "0 0 22px rgba(6,182,212,0.32)",
    Icon: Wind,
  },
  {
    key: "grade_pct",
    label: "Grade",
    unit: "%",
    gradient: "linear-gradient(145deg, #a78bfa, #7c3aed)",
    glow: "0 0 22px rgba(167,139,250,0.32)",
    Icon: Mountain,
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
    key: "vo2_l_min",
    label: "VO2",
    unit: "L/min",
    gradient: "linear-gradient(145deg, #38bdf8, #0284c7)",
    glow: "0 0 22px rgba(56,189,248,0.32)",
    Icon: HeartPulse,
    inputStep: "0.01",
  },
  {
    key: "vco2_l_min",
    label: "VCO2",
    unit: "L/min",
    gradient: "linear-gradient(145deg, #2dd4bf, #0d9488)",
    glow: "0 0 22px rgba(45,212,191,0.32)",
    Icon: Activity,
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
    key: "smo2_rest",
    label: "SmO2 rest",
    unit: "%",
    gradient: "linear-gradient(145deg, #14b8a6, #0f766e)",
    glow: "0 0 22px rgba(20,184,166,0.32)",
    Icon: Droplets,
  },
  {
    key: "smo2_work",
    label: "SmO2 work",
    unit: "%",
    gradient: "linear-gradient(145deg, #5eead4, #0d9488)",
    glow: "0 0 22px rgba(94,234,212,0.28)",
    Icon: Droplets,
  },
  {
    key: "lactate_oxidation_pct",
    label: "Lactate oxidation",
    unit: "%",
    gradient: "linear-gradient(145deg, #4ade80, #16a34a)",
    glow: "0 0 22px rgba(74,222,128,0.3)",
    Icon: Percent,
  },
  {
    key: "cori_pct",
    label: "Cori",
    unit: "%",
    gradient: "linear-gradient(145deg, #60a5fa, #2563eb)",
    glow: "0 0 22px rgba(96,165,250,0.3)",
    Icon: ArrowLeftRight,
  },
  {
    key: "cho_ingested_g_h",
    label: "CHO ingested",
    unit: "g/h",
    gradient: "linear-gradient(145deg, #3b82f6, #1d4ed8)",
    glow: "0 0 22px rgba(59,130,246,0.32)",
    Icon: UtensilsCrossed,
    inputStep: "0.1",
  },
  {
    key: "gut_absorption_pct",
    label: "Gut absorption",
    unit: "%",
    gradient: "linear-gradient(145deg, #34d399, #059669)",
    glow: "0 0 22px rgba(52,211,153,0.28)",
    Icon: PieChart,
  },
  {
    key: "microbiota_sequestration_pct",
    label: "Microbiota seq.",
    unit: "%",
    gradient: "linear-gradient(145deg, #fb7185, #e11d48)",
    glow: "0 0 22px rgba(251,113,133,0.3)",
    Icon: AlertTriangle,
  },
  {
    key: "gut_training_pct",
    label: "Gut training",
    unit: "%",
    gradient: "linear-gradient(145deg, #fbbf24, #ca8a04)",
    glow: "0 0 22px rgba(251,191,36,0.28)",
    Icon: Gauge,
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
    key: "glucose_mmol_l",
    label: "Glucose",
    unit: "mmol/L",
    gradient: "linear-gradient(145deg, #22d3ee, #0e7490)",
    glow: "0 0 22px rgba(34,211,238,0.28)",
    Icon: Beaker,
    inputStep: "0.1",
  },
  {
    key: "candida_overgrowth_pct",
    label: "Candida",
    unit: "%",
    gradient: "linear-gradient(145deg, #a855f7, #7e22ce)",
    glow: "0 0 22px rgba(168,85,247,0.28)",
    Icon: Bug,
  },
  {
    key: "bifidobacteria_pct",
    label: "Bifidobacteria",
    unit: "%",
    gradient: "linear-gradient(145deg, #4ade80, #166534)",
    glow: "0 0 22px rgba(74,222,128,0.25)",
    Icon: Leaf,
  },
  {
    key: "akkermansia_pct",
    label: "Akkermansia",
    unit: "%",
    gradient: "linear-gradient(145deg, #818cf8, #4338ca)",
    glow: "0 0 22px rgba(129,140,248,0.28)",
    Icon: Droplets,
  },
  {
    key: "butyrate_producers_pct",
    label: "Butyrate prod.",
    unit: "%",
    gradient: "linear-gradient(145deg, #fcd34d, #b45309)",
    glow: "0 0 22px rgba(252,211,77,0.28)",
    Icon: Leaf,
  },
  {
    key: "endotoxin_risk_pct",
    label: "Endotoxin risk",
    unit: "%",
    gradient: "linear-gradient(145deg, #ef4444, #991b1b)",
    glow: "0 0 22px rgba(239,68,68,0.32)",
    Icon: AlertTriangle,
  },
];

const MICROBIOTA_MANUAL_KEYS = new Set([
  "candida_overgrowth_pct",
  "bifidobacteria_pct",
  "akkermansia_pct",
  "butyrate_producers_pct",
  "endotoxin_risk_pct",
]);

/** Con fonte microbiota ≠ manuale il motore deriva questi tre valori dai taxa (Health&Bio / preset). */
const GUT_DERIVED_FROM_MICROBIOTA_KEYS = new Set([
  "gut_absorption_pct",
  "microbiota_sequestration_pct",
  "gut_training_pct",
]);

function fieldDisabled(
  key: string,
  vo2Mode: LactateVo2Mode,
  rerMode: LactateRerMode,
  microbiotaSourceMode: LactateMicrobiotaSourceMode,
): boolean {
  if (key === "vo2_l_min" && vo2Mode === "device") return true;
  if (key === "rer" && rerMode === "auto") return true;
  if (MICROBIOTA_MANUAL_KEYS.has(key) && microbiotaSourceMode !== "manual") return true;
  if (GUT_DERIVED_FROM_MICROBIOTA_KEYS.has(key) && microbiotaSourceMode !== "manual") return true;
  return false;
}

export function LactatePro2NumericEngineParams({
  input,
  onInputChange,
  vo2Mode,
  rerMode,
  microbiotaSourceMode,
}: {
  input: Record<string, string>;
  onInputChange: (key: string, value: string) => void;
  vo2Mode: LactateVo2Mode;
  rerMode: LactateRerMode;
  microbiotaSourceMode: LactateMicrobiotaSourceMode;
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

  const editingDef = editKey ? LACTATE_ENGINE_PARAM_DEFS.find((d) => d.key === editKey) : null;

  return (
    <div className="physiology-pro2-eng-param-shell">
      <div className="physiology-pro2-lab-banner physiology-pro2-lab-banner--lactate-engine-params">
        <Zap className="physiology-pro2-lab-banner-ico" aria-hidden />
        <span>Parametri numerici motore lattato · v1.2</span>
        <Zap className="physiology-pro2-lab-banner-ico" aria-hidden />
      </div>
      <div className="physiology-pro2-eng-param-grid">
        {LACTATE_ENGINE_PARAM_DEFS.map((def) => {
          const disabled = fieldDisabled(def.key, vo2Mode, rerMode, microbiotaSourceMode);
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
            className="physiology-pro2-eng-param-editor"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lac-param-editor-title"
            onClick={(e) => e.stopPropagation()}
          >
            <p id="lac-param-editor-title" className="physiology-pro2-eng-param-editor-title">
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
              <button type="button" className="physiology-pro2-eng-param-editor-btn physiology-pro2-eng-param-editor-btn--ok" onClick={commitEditor}>
                Applica
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
