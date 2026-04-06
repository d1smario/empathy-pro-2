/** Stile pill allineato a `TrainingSubnav` (bordo, fill idle, gradient/ring attivo, icon tint). */
export type ModulePillStyle = {
  idleBorder: string;
  idleBg: string;
  activeGradient: string;
  activeRing: string;
  iconIdle: string;
  iconActive: string;
};

export const MODULE_PILL_CYAN: ModulePillStyle = {
  idleBorder: "border-cyan-500/35",
  idleBg: "bg-cyan-500/10",
  activeGradient: "bg-gradient-to-br from-cyan-500/45 via-teal-500/35 to-cyan-600/25",
  activeRing: "ring-2 ring-cyan-400/50 shadow-[0_0_20px_rgba(34,211,238,0.2)]",
  iconIdle: "text-cyan-400",
  iconActive: "text-cyan-100 drop-shadow-[0_0_10px_rgba(34,211,238,0.65)]",
};

export const MODULE_PILL_FUCHSIA: ModulePillStyle = {
  idleBorder: "border-fuchsia-500/35",
  idleBg: "bg-fuchsia-500/10",
  activeGradient: "bg-gradient-to-br from-fuchsia-600/50 via-violet-600/40 to-purple-700/30",
  activeRing: "ring-2 ring-fuchsia-400/55 shadow-[0_0_22px_rgba(217,70,239,0.25)]",
  iconIdle: "text-fuchsia-400",
  iconActive: "text-fuchsia-100 drop-shadow-[0_0_10px_rgba(232,121,249,0.55)]",
};

export const MODULE_PILL_SKY: ModulePillStyle = {
  idleBorder: "border-sky-500/35",
  idleBg: "bg-sky-500/10",
  activeGradient: "bg-gradient-to-br from-sky-500/45 via-cyan-500/35 to-sky-700/25",
  activeRing: "ring-2 ring-sky-400/50 shadow-[0_0_20px_rgba(56,189,248,0.2)]",
  iconIdle: "text-sky-400",
  iconActive: "text-sky-100 drop-shadow-[0_0_10px_rgba(56,189,248,0.55)]",
};

export const MODULE_PILL_AMBER: ModulePillStyle = {
  idleBorder: "border-amber-500/35",
  idleBg: "bg-amber-500/10",
  activeGradient: "bg-gradient-to-br from-amber-500/45 via-orange-500/35 to-amber-700/25",
  activeRing: "ring-2 ring-amber-400/50 shadow-[0_0_20px_rgba(251,191,36,0.2)]",
  iconIdle: "text-amber-400",
  iconActive: "text-amber-100 drop-shadow-[0_0_10px_rgba(251,191,36,0.55)]",
};

export const MODULE_PILL_ROSE: ModulePillStyle = {
  idleBorder: "border-rose-500/35",
  idleBg: "bg-rose-500/10",
  activeGradient: "bg-gradient-to-br from-rose-500/45 via-pink-500/35 to-rose-800/25",
  activeRing: "ring-2 ring-rose-400/45 shadow-[0_0_18px_rgba(244,63,94,0.18)]",
  iconIdle: "text-rose-400",
  iconActive: "text-rose-100 drop-shadow-[0_0_10px_rgba(251,113,133,0.5)]",
};

export const MODULE_PILL_EMERALD: ModulePillStyle = {
  idleBorder: "border-emerald-500/35",
  idleBg: "bg-emerald-500/10",
  activeGradient: "bg-gradient-to-br from-emerald-500/45 via-teal-500/35 to-emerald-800/25",
  activeRing: "ring-2 ring-emerald-400/45 shadow-[0_0_18px_rgba(52,211,153,0.18)]",
  iconIdle: "text-emerald-400",
  iconActive: "text-emerald-100 drop-shadow-[0_0_10px_rgba(52,211,153,0.5)]",
};

export const MODULE_PILL_ORANGE: ModulePillStyle = {
  idleBorder: "border-orange-500/35",
  idleBg: "bg-orange-500/10",
  activeGradient: "bg-gradient-to-br from-orange-500/45 via-amber-500/35 to-orange-800/25",
  activeRing: "ring-2 ring-orange-400/50 shadow-[0_0_20px_rgba(251,146,60,0.2)]",
  iconIdle: "text-orange-400",
  iconActive: "text-orange-100 drop-shadow-[0_0_10px_rgba(251,191,36,0.55)]",
};
