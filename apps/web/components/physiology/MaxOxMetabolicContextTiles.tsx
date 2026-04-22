"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, ChevronDown, HeartPulse, Layers } from "lucide-react";
import type { SupportedSport } from "@/lib/engines/vo2-estimator";
import type { Vo2InputMode } from "@/components/physiology/LactateMetabolicContextTiles";

type OpenKey = "sport" | "vo2" | null;

const SPORT_OPTS: { v: SupportedSport; label: string }[] = [
  { v: "cycling", label: "Cycling" },
  { v: "running", label: "Running" },
  { v: "swimming", label: "Swimming" },
  { v: "xc_ski", label: "Sci di fondo" },
];

function sportLabel(s: SupportedSport) {
  return SPORT_OPTS.find((o) => o.v === s)?.label ?? s;
}

export function MaxOxMetabolicContextTiles({
  maxOxSport,
  setMaxOxSport,
  maxOxVo2Mode,
  setMaxOxVo2Mode,
  maxOxVo2Used,
  maxOxVo2EstL,
  maxOxVo2MlKg,
  vo2CapacitySource,
  segmentVo2LMin,
  segmentO2TotalL,
  segmentDurationMin,
}: {
  maxOxSport: SupportedSport;
  setMaxOxSport: (v: SupportedSport) => void;
  maxOxVo2Mode: Vo2InputMode;
  setMaxOxVo2Mode: (v: Vo2InputMode) => void;
  maxOxVo2Used: number;
  maxOxVo2EstL: number;
  maxOxVo2MlKg: number;
  vo2CapacitySource: "metabolic_engine_vo2max" | "power_estimate" | "test_manual";
  /** Stima VO₂ sul segmento applicato (informativo; capacità motore = profilo). */
  segmentVo2LMin?: number | null;
  segmentO2TotalL?: number | null;
  segmentDurationMin?: number | null;
}) {
  const [open, setOpen] = useState<OpenKey>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (shellRef.current && !shellRef.current.contains(e.target as Node)) {
        setOpen(null);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function toggle(k: OpenKey) {
    setOpen((cur) => (cur === k ? null : k));
  }

  const vo2Label =
    maxOxVo2Mode === "test"
      ? "VO₂ da test"
      : vo2CapacitySource === "metabolic_engine_vo2max"
        ? "VO₂max (modello CP)"
        : "Stima potenza";

  return (
    <div className="physiology-pro2-ctx-shell physiology-pro2-ctx-shell--maxox" ref={shellRef}>
      <div className="physiology-pro2-lab-banner physiology-pro2-lab-banner--maxox-context">
        <Activity className="physiology-pro2-lab-banner-ico" aria-hidden />
        <span>Contesto test · fonte VO₂</span>
        <Activity className="physiology-pro2-lab-banner-ico" aria-hidden />
      </div>

      <div className="physiology-pro2-ctx-grid physiology-pro2-ctx-grid--maxox">
        <button
          type="button"
          className={`physiology-pro2-ctx-tile physiology-pro2-ctx-tile--indigo${open === "sport" ? " physiology-pro2-ctx-tile--open" : ""}`}
          onClick={() => toggle("sport")}
        >
          <div className="physiology-pro2-ctx-tile-head">
            <span className="physiology-pro2-ctx-tile-ico-wrap">
              <Layers className="physiology-pro2-ctx-tile-ico" aria-hidden />
            </span>
            <ChevronDown className="physiology-pro2-ctx-tile-chev" aria-hidden />
          </div>
          <span className="physiology-pro2-ctx-tile-k">Sport</span>
          <span className="physiology-pro2-ctx-tile-v">{sportLabel(maxOxSport)}</span>
        </button>

        <button
          type="button"
          className={`physiology-pro2-ctx-tile physiology-pro2-ctx-tile--cyan${open === "vo2" ? " physiology-pro2-ctx-tile--open" : ""}`}
          onClick={() => toggle("vo2")}
        >
          <div className="physiology-pro2-ctx-tile-head">
            <span className="physiology-pro2-ctx-tile-ico-wrap">
              <HeartPulse className="physiology-pro2-ctx-tile-ico" aria-hidden />
            </span>
            <ChevronDown className="physiology-pro2-ctx-tile-chev" aria-hidden />
          </div>
          <span className="physiology-pro2-ctx-tile-k">Fonte VO₂</span>
          <span className="physiology-pro2-ctx-tile-v">{vo2Label}</span>
        </button>
      </div>

      {open === "sport" ? (
        <div className="physiology-pro2-ctx-options">
          {SPORT_OPTS.map((o) => (
            <button
              key={o.v}
              type="button"
              className={`physiology-pro2-ctx-opt physiology-pro2-ctx-opt--maxox${maxOxSport === o.v ? " physiology-pro2-ctx-opt--on" : ""}`}
              onClick={() => {
                setMaxOxSport(o.v);
                setOpen(null);
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      ) : null}

      {open === "vo2" ? (
        <div className="physiology-pro2-ctx-options">
          <button
            type="button"
            className={`physiology-pro2-ctx-opt physiology-pro2-ctx-opt--maxox${maxOxVo2Mode === "device" ? " physiology-pro2-ctx-opt--on" : ""}`}
            onClick={() => {
              setMaxOxVo2Mode("device");
              setOpen(null);
            }}
          >
            {vo2CapacitySource === "test_manual"
              ? "Device: VO₂max da curva CP → stima al carico"
              : vo2CapacitySource === "metabolic_engine_vo2max"
                ? "Capacità da Metabolic Profile (VO₂max da curva CP)"
                : "Solo stima potenza (compila la curva CP per il tetto)"}
          </button>
          <button
            type="button"
            className={`physiology-pro2-ctx-opt physiology-pro2-ctx-opt--maxox${maxOxVo2Mode === "test" ? " physiology-pro2-ctx-opt--on" : ""}`}
            onClick={() => {
              setMaxOxVo2Mode("test");
              setOpen(null);
            }}
          >
            Valore da test
          </button>
        </div>
      ) : null}

      <div className="physiology-pro2-ctx-vo2-card physiology-pro2-ctx-vo2-card--maxox">
        <HeartPulse className="physiology-pro2-ctx-vo2-ico" aria-hidden />
        <div className="physiology-pro2-ctx-vo2-copy">
          <span className="physiology-pro2-ctx-vo2-k">VO₂ usato nel modello</span>
          <span className="physiology-pro2-ctx-vo2-main">{maxOxVo2Used.toFixed(2)} L/min</span>
          <span className="physiology-pro2-ctx-vo2-sub">
            stimato {maxOxVo2EstL.toFixed(2)} L/min · {maxOxVo2MlKg.toFixed(1)} ml/kg/min
          </span>
          {segmentVo2LMin != null ? (
            <span className="mt-2 block text-[0.7rem] leading-snug text-slate-400">
              Segmento (stima al carico): <strong className="text-rose-300">{segmentVo2LMin.toFixed(2)} L/min</strong>
              {segmentO2TotalL != null && segmentDurationMin != null ? (
                <>
                  {" "}
                  · O₂ cumulativo ~<strong className="text-cyan-300">{segmentO2TotalL.toFixed(2)} L</strong> / {segmentDurationMin.toFixed(1)} min
                </>
              ) : null}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
