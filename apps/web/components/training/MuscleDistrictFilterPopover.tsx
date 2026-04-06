"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { BLOCK1_MUSCLE_FILTERS } from "@/lib/training/domain-blocks/block1-strength-functional";
import type { Block1MusclePreset } from "@/lib/training/exercise-library/types";

const INACTIVE = "rgba(67, 56, 122, 0.42)";
const STROKE = "rgba(167, 139, 250, 0.38)";

export function muscleSegmentsForPreset(p: Block1MusclePreset | ""): Set<string> {
  const keys: string[] = [];
  switch (p) {
    case "":
      break;
    case "lower":
      keys.push("quad_l", "quad_r", "ham_l", "ham_r", "calf_l", "calf_r", "glute", "hip");
      break;
    case "upper_push":
      keys.push("chest", "shoulder_l", "shoulder_r", "tri_l", "tri_r", "fore_l", "fore_r");
      break;
    case "upper_pull":
      keys.push("lat_l", "lat_r", "trap", "bicep_l", "bicep_r", "fore_l", "fore_r");
      break;
    case "quadriceps":
      keys.push("quad_l", "quad_r");
      break;
    case "hamstrings":
      keys.push("ham_l", "ham_r");
      break;
    case "glutes":
      keys.push("glute");
      break;
    case "calves":
      keys.push("calf_l", "calf_r");
      break;
    case "chest":
      keys.push("chest");
      break;
    case "lats":
      keys.push("lat_l", "lat_r");
      break;
    case "upper_back":
      keys.push("trap", "lat_l", "lat_r");
      break;
    case "shoulders":
      keys.push("shoulder_l", "shoulder_r");
      break;
    case "biceps":
      keys.push("bicep_l", "bicep_r");
      break;
    case "triceps":
      keys.push("tri_l", "tri_r");
      break;
    case "forearms":
      keys.push("fore_l", "fore_r");
      break;
    case "core":
      keys.push("core");
      break;
    case "hip_flexors":
      keys.push("hip");
      break;
    case "posterior_chain":
      keys.push("ham_l", "ham_r", "glute", "low_back");
      break;
    case "full":
      keys.push(
        "head",
        "chest",
        "core",
        "trap",
        "lat_l",
        "lat_r",
        "shoulder_l",
        "shoulder_r",
        "bicep_l",
        "bicep_r",
        "tri_l",
        "tri_r",
        "fore_l",
        "fore_r",
        "glute",
        "hip",
        "quad_l",
        "quad_r",
        "ham_l",
        "ham_r",
        "calf_l",
        "calf_r",
        "low_back",
      );
      break;
    default:
      break;
  }
  return new Set(keys);
}

/** Silhouette stilizzata (vista frontale): regione evidenziata secondo il preset Blocco 1. */
export function MuscleDistrictGlyph({
  preset,
  className = "",
}: {
  preset: Block1MusclePreset | "";
  className?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const gradId = `muscle-hi-${uid}`;
  const on = muscleSegmentsForPreset(preset);
  const f = (id: string) => (on.has(id) ? `url(#${gradId})` : INACTIVE);

  return (
    <svg viewBox="0 0 72 132" className={className} aria-hidden>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.98" />
          <stop offset="48%" stopColor="#e879f9" stopOpacity="0.98" />
          <stop offset="100%" stopColor="#fb923c" stopOpacity="0.98" />
        </linearGradient>
      </defs>
      <circle cx={36} cy={11} r={6.8} fill={f("head")} stroke={STROKE} strokeWidth={0.75} />
      <ellipse cx={36} cy={53} rx={3} ry={13.5} fill={f("low_back")} stroke={STROKE} strokeWidth={0.45} />
      <path d="M23 22 L28 51 L34 48 Z" fill={f("lat_l")} stroke={STROKE} strokeWidth={0.45} strokeLinejoin="round" />
      <path d="M49 22 L44 51 L38 48 Z" fill={f("lat_r")} stroke={STROKE} strokeWidth={0.45} strokeLinejoin="round" />
      <path
        d="M36 18 L31 20 L32 27 L40 27 L41 20 Z"
        fill={f("trap")}
        stroke={STROKE}
        strokeWidth={0.45}
        strokeLinejoin="round"
      />
      <path d="M30 26 L42 26 L41 45 L31 45 Z" fill={f("chest")} stroke={STROKE} strokeWidth={0.45} strokeLinejoin="round" />
      <rect x={31} y={46} width={10} height={17} rx={2.5} fill={f("core")} stroke={STROKE} strokeWidth={0.45} />
      <circle cx={22} cy={28} r={3.7} fill={f("shoulder_l")} stroke={STROKE} strokeWidth={0.45} />
      <circle cx={50} cy={28} r={3.7} fill={f("shoulder_r")} stroke={STROKE} strokeWidth={0.45} />
      <ellipse cx={17} cy={44} rx={3.1} ry={10.5} fill={f("bicep_l")} stroke={STROKE} strokeWidth={0.45} />
      <ellipse cx={55} cy={44} rx={3.1} ry={10.5} fill={f("bicep_r")} stroke={STROKE} strokeWidth={0.45} />
      <ellipse cx={18.4} cy={54} rx={2.7} ry={8.8} fill={f("tri_l")} stroke={STROKE} strokeWidth={0.45} />
      <ellipse cx={53.6} cy={54} rx={2.7} ry={8.8} fill={f("tri_r")} stroke={STROKE} strokeWidth={0.45} />
      <ellipse cx={14.8} cy={70} rx={2.5} ry={9.5} fill={f("fore_l")} stroke={STROKE} strokeWidth={0.45} />
      <ellipse cx={57.2} cy={70} rx={2.5} ry={9.5} fill={f("fore_r")} stroke={STROKE} strokeWidth={0.45} />
      <ellipse cx={36} cy={69} rx={12} ry={5} fill={f("hip")} stroke={STROKE} strokeWidth={0.45} />
      <ellipse cx={36} cy={74} rx={13} ry={6} fill={f("glute")} stroke={STROKE} strokeWidth={0.45} />
      <ellipse cx={27.8} cy={100} rx={5} ry={14.5} fill={f("ham_l")} stroke={STROKE} strokeWidth={0.45} />
      <ellipse cx={44.2} cy={100} rx={5} ry={14.5} fill={f("ham_r")} stroke={STROKE} strokeWidth={0.45} />
      <ellipse cx={29} cy={100} rx={6} ry={15} fill={f("quad_l")} stroke={STROKE} strokeWidth={0.45} />
      <ellipse cx={43} cy={100} rx={6} ry={15} fill={f("quad_r")} stroke={STROKE} strokeWidth={0.45} />
      <ellipse cx={28.6} cy={123} rx={4.4} ry={9.5} fill={f("calf_l")} stroke={STROKE} strokeWidth={0.45} />
      <ellipse cx={43.4} cy={123} rx={4.4} ry={9.5} fill={f("calf_r")} stroke={STROKE} strokeWidth={0.45} />
    </svg>
  );
}

const btnBase =
  "flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-fuchsia-400/55 focus:ring-offset-2 focus:ring-offset-black/80";

export type MuscleDistrictFilterPopoverProps = {
  value: Block1MusclePreset | "";
  onChange: (v: Block1MusclePreset | "") => void;
  id?: string;
};

export function MuscleDistrictFilterPopover({ value, onChange, id }: MuscleDistrictFilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const currentLabel = useMemo(
    () => BLOCK1_MUSCLE_FILTERS.find((o) => o.value === value)?.label ?? "Distretto",
    [value],
  );

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const el = wrapRef.current;
      if (el && !el.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={wrapRef} className="relative inline-flex flex-col gap-1" id={id}>
      <span className="text-[0.65rem] font-medium text-violet-200/80">Filtro distretto</span>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        className="inline-flex min-w-[12rem] max-w-[20rem] items-center justify-between gap-2 rounded-xl border border-violet-500/35 bg-gradient-to-r from-violet-950/50 to-black/55 px-3 py-2.5 text-left text-sm font-semibold text-white shadow-inner shadow-violet-900/20 transition hover:border-fuchsia-400/45 hover:from-violet-900/55"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="flex min-w-0 items-center gap-2">
          <MuscleDistrictGlyph
            preset={value}
            className="h-9 w-9 shrink-0 rounded-lg border border-fuchsia-400/30 bg-violet-950/40 p-0.5"
          />
          <span className="truncate bg-gradient-to-r from-violet-100 via-fuchsia-100 to-orange-100 bg-clip-text text-transparent">
            {currentLabel}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-fuchsia-300/90 transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label="Seleziona distretto muscolare"
          className="absolute left-0 top-full z-50 mt-1 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-fuchsia-500/35 bg-gradient-to-b from-violet-950/[0.97] via-gray-950/95 to-black/95 py-3 shadow-2xl shadow-fuchsia-950/50 backdrop-blur-md"
        >
          <div className="flex items-start gap-3 border-b border-violet-500/20 px-3 pb-3">
            <MuscleDistrictGlyph
              preset={value}
              className="h-[7.5rem] w-[4.25rem] shrink-0 rounded-xl border border-fuchsia-400/35 bg-gradient-to-br from-violet-950/60 to-orange-950/30 p-1"
            />
            <div className="min-w-0 pt-0.5">
              <p className="text-[0.65rem] font-bold uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-violet-300 to-orange-200">
                Anteprima regione
              </p>
              <p className="mt-1 text-sm font-semibold leading-snug text-white">{currentLabel}</p>
              <p className="mt-1 text-[0.65rem] leading-relaxed text-gray-500">
                Gradient viola → fucsia → arancio = distretto attivo. Stessi preset di catalogo V1.
              </p>
            </div>
          </div>
          <div className="max-h-[min(55vh,22rem)] overflow-y-auto px-2 pt-2">
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {BLOCK1_MUSCLE_FILTERS.map((o) => {
                const sel = o.value === value;
                return (
                  <button
                    key={o.value || "all"}
                    type="button"
                    role="option"
                    aria-selected={sel}
                    className={`${btnBase} ${
                      sel
                        ? "border-violet-400/50 bg-gradient-to-r from-violet-600/35 via-fuchsia-600/25 to-orange-600/20 text-white shadow-md shadow-violet-900/30"
                        : "border-white/10 bg-black/40 text-gray-300 hover:border-violet-400/25 hover:bg-violet-950/25"
                    }`}
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                  >
                    <MuscleDistrictGlyph
                      preset={o.value}
                      className="h-8 w-8 shrink-0 rounded-md border border-fuchsia-500/25 bg-violet-950/35"
                    />
                    <span className="min-w-0 flex-1 text-[0.72rem] font-semibold leading-tight">{o.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
