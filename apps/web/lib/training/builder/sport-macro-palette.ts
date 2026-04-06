import type { SportGlyphId } from "@/lib/training/builder/sport-glyph-id";

/** Chip singolo: etichetta IT (Vyria V1), sport motore, glifo disciplina dedicato. */
export type SportPaletteChip = {
  label: string;
  sport: string;
  glyph: SportGlyphId;
  iconRing: string;
};

export type SportMacroId = "aerobic" | "strength" | "technical" | "lifestyle";

export type SportMacroSector = {
  id: SportMacroId;
  shortLabel: string;
  title: string;
  blurb: string;
  macroIdle: string;
  macroActive: string;
  sports: SportPaletteChip[];
};

/**
 * Allineato a Vyria V1. Glifi SVG in `SportDisciplineGlyph` (non icone generiche).
 */
export const SPORT_MACRO_SECTORS: SportMacroSector[] = [
  {
    id: "aerobic",
    shortLabel: "A · Aerobico",
    title: "Sport aerobici / anaerobici",
    blurb: "Ciclismo, corsa, acqua, sci, montagna — stessa lista macro Vyria V1.",
    macroIdle:
      "border-cyan-500/45 bg-gradient-to-br from-cyan-600/35 via-teal-900/40 to-black/80 text-cyan-50 shadow-[0_0_24px_rgba(34,211,238,0.15)]",
    macroActive: "ring-2 ring-cyan-300/70 shadow-[0_0_28px_rgba(34,211,238,0.35)]",
    sports: [
      { label: "Ciclismo", sport: "cycling", glyph: "roadBike", iconRing: "bg-sky-500/30 border-sky-400/60 text-sky-100" },
      { label: "Running", sport: "running", glyph: "runner", iconRing: "bg-rose-500/30 border-rose-400/55 text-rose-100" },
      { label: "MTB", sport: "mountain biking", glyph: "mtb", iconRing: "bg-lime-500/25 border-lime-400/50 text-lime-100" },
      { label: "Gravel", sport: "gravel cycling", glyph: "gravel", iconRing: "bg-amber-500/30 border-amber-400/55 text-amber-100" },
      { label: "Triathlon", sport: "triathlon", glyph: "triathlon", iconRing: "bg-violet-500/30 border-violet-400/55 text-violet-100" },
      { label: "Nuoto", sport: "swimming", glyph: "swim", iconRing: "bg-blue-500/35 border-blue-400/55 text-blue-100" },
      { label: "XC Ski", sport: "cross country ski", glyph: "xcSki", iconRing: "bg-cyan-400/25 border-cyan-300/55 text-cyan-50" },
      { label: "Alpinismo", sport: "mountaineering", glyph: "alpine", iconRing: "bg-stone-500/35 border-stone-400/50 text-stone-100" },
      { label: "Canoa", sport: "canoeing", glyph: "canoe", iconRing: "bg-teal-500/30 border-teal-400/55 text-teal-100" },
    ],
  },
  {
    id: "strength",
    shortLabel: "B · Gym",
    title: "Palestra & performance",
    blurb: "Gym, Hyrox, Crossfit, powerlifting — come famiglia B Vyria.",
    macroIdle:
      "border-orange-500/45 bg-gradient-to-br from-orange-600/35 via-red-950/35 to-black/80 text-orange-50 shadow-[0_0_24px_rgba(251,146,60,0.15)]",
    macroActive: "ring-2 ring-orange-300/70 shadow-[0_0_28px_rgba(251,146,60,0.35)]",
    sports: [
      { label: "Gym", sport: "gym", glyph: "gym", iconRing: "bg-orange-500/35 border-orange-400/55 text-orange-100" },
      { label: "Hyrox", sport: "hyrox", glyph: "hyrox", iconRing: "bg-red-500/30 border-red-400/55 text-red-100" },
      { label: "Crossfit", sport: "crossfit", glyph: "crossfit", iconRing: "bg-yellow-500/30 border-yellow-400/60 text-yellow-950" },
      { label: "Powerlifting", sport: "powerlifting", glyph: "barbell", iconRing: "bg-zinc-500/40 border-zinc-300/50 text-zinc-100" },
    ],
  },
  {
    id: "technical",
    shortLabel: "C · Tecnici",
    title: "Sport tecnici / tattici",
    blurb: "Calcio, volley, racchetta, combattimento — discipline V1.",
    macroIdle:
      "border-fuchsia-500/45 bg-gradient-to-br from-fuchsia-600/30 via-violet-950/40 to-black/80 text-fuchsia-50 shadow-[0_0_24px_rgba(192,132,252,0.15)]",
    macroActive: "ring-2 ring-fuchsia-300/70 shadow-[0_0_28px_rgba(217,70,239,0.35)]",
    sports: [
      { label: "Calcio", sport: "soccer", glyph: "soccer", iconRing: "bg-emerald-600/35 border-emerald-400/55 text-emerald-100" },
      { label: "Pallavolo", sport: "volleyball", glyph: "volleyball", iconRing: "bg-yellow-400/25 border-yellow-300/55 text-yellow-100" },
      { label: "Basket", sport: "basketball", glyph: "basketball", iconRing: "bg-orange-500/35 border-orange-400/55 text-orange-100" },
      { label: "Tennis", sport: "tennis", glyph: "tennis", iconRing: "bg-lime-500/25 border-lime-400/55 text-lime-100" },
      { label: "Boxe", sport: "boxing", glyph: "boxing", iconRing: "bg-red-600/35 border-red-400/50 text-red-100" },
      { label: "Karate", sport: "karate", glyph: "karate", iconRing: "bg-purple-500/30 border-purple-400/55 text-purple-100" },
      { label: "Judo", sport: "judo", glyph: "judo", iconRing: "bg-indigo-500/30 border-indigo-400/55 text-indigo-100" },
      { label: "Muay Thai", sport: "muay thai", glyph: "muay", iconRing: "bg-orange-600/35 border-orange-500/50 text-orange-50" },
    ],
  },
  {
    id: "lifestyle",
    shortLabel: "D · Lifestyle",
    title: "Lifestyle & recovery",
    blurb: "Mind-body, respirazione, mobilità.",
    macroIdle:
      "border-emerald-500/45 bg-gradient-to-br from-emerald-600/30 via-teal-950/40 to-black/80 text-emerald-50 shadow-[0_0_24px_rgba(52,211,153,0.15)]",
    macroActive: "ring-2 ring-emerald-300/70 shadow-[0_0_28px_rgba(52,211,153,0.35)]",
    sports: [
      { label: "Yoga", sport: "yoga", glyph: "yoga", iconRing: "bg-pink-500/30 border-pink-400/55 text-pink-100" },
      { label: "Pilates", sport: "pilates", glyph: "pilates", iconRing: "bg-violet-400/25 border-violet-300/55 text-violet-100" },
      { label: "Meditazione", sport: "meditation", glyph: "meditation", iconRing: "bg-indigo-500/30 border-indigo-400/55 text-indigo-100" },
      { label: "Breathwork", sport: "breathwork", glyph: "breath", iconRing: "bg-cyan-500/25 border-cyan-400/55 text-cyan-100" },
      { label: "Mobility", sport: "mobility", glyph: "mobility", iconRing: "bg-emerald-500/30 border-emerald-400/55 text-emerald-100" },
      { label: "Stretch", sport: "stretching", glyph: "stretch", iconRing: "bg-teal-500/25 border-teal-400/55 text-teal-100" },
    ],
  },
];

export function macroIdForSport(sport: string): SportMacroId {
  const s = sport.trim().toLowerCase();
  for (const macro of SPORT_MACRO_SECTORS) {
    if (macro.sports.some((chip) => chip.sport.toLowerCase() === s)) return macro.id;
  }
  if (/(cycl|bike|cicl|run|swim|ski|canoe|tri|grav|mountaineer)/i.test(s)) return "aerobic";
  if (/(gym|hyrox|crossfit|power)/i.test(s)) return "strength";
  if (/(soccer|volley|basket|tennis|box|karate|judo|muay|calcio|pallavolo)/i.test(s)) return "technical";
  if (/(yoga|pilates|meditat|breath|mobility|stretch)/i.test(s)) return "lifestyle";
  return "aerobic";
}
