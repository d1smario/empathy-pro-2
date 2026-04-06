import type { UnifiedExerciseRecord } from "@/lib/training/exercise-library/types";

const COLORS = {
  bgTop: "#121E2B",
  bgBottom: "#0B1120",
  support: "#0F494C",
  primary: "#04BE81",
  accent: "#6D3AE8",
  neutral: "#EEEEE3",
  muted: "#97A6B4",
  stroke: "#D7F7EE",
};

function esc(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function canonicalMovementPattern(pattern: string): string {
  const raw = pattern.toLowerCase();
  if (raw.includes("hinge") || raw.includes("deadlift")) return "hinge";
  if (raw.includes("push") || raw.includes("press")) return "push";
  if (raw.includes("pull") || raw.includes("row") || raw.includes("chin")) return "pull";
  if (raw.includes("carry") || raw.includes("farmer") || raw.includes("sled")) return "carry";
  if (
    raw.includes("locomotion") ||
    raw.includes("run") ||
    raw.includes("steady") ||
    raw.includes("change_of_direction") ||
    raw.includes("intermittent_game")
  ) {
    return "locomotion";
  }
  if (raw.includes("jump") || raw.includes("landing") || raw.includes("squat")) return "squat";
  if (raw.includes("strike")) return "striking";
  if (raw.includes("technical")) return "technical";
  if (raw.includes("flow") || raw.includes("mobility")) return "flow";
  if (raw.includes("core")) return "core";
  return "squat";
}

function movementIcon(pattern: string): string {
  const common = `stroke="${COLORS.stroke}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
  switch (canonicalMovementPattern(pattern)) {
    case "hinge":
      return `
        <circle cx="154" cy="72" r="18" fill="${COLORS.stroke}" opacity="0.95" />
        <path ${common} d="M155 93 L140 128 L175 148" />
        <path ${common} d="M140 128 L118 174" />
        <path ${common} d="M175 148 L205 181" />
        <path ${common} d="M141 122 L209 116" />
        <rect x="213" y="106" width="58" height="14" rx="7" fill="${COLORS.primary}" opacity="0.92" />
      `;
    case "push":
      return `
        <circle cx="154" cy="68" r="18" fill="${COLORS.stroke}" opacity="0.95" />
        <path ${common} d="M155 88 L155 142" />
        <path ${common} d="M155 106 L110 94" />
        <path ${common} d="M155 106 L214 82" />
        <path ${common} d="M155 142 L132 190" />
        <path ${common} d="M155 142 L184 189" />
        <rect x="214" y="68" width="16" height="52" rx="8" fill="${COLORS.accent}" opacity="0.92" />
      `;
    case "pull":
      return `
        <rect x="210" y="38" width="10" height="150" rx="5" fill="${COLORS.accent}" opacity="0.9" />
        <path ${common} d="M122 46 H248" />
        <circle cx="154" cy="84" r="17" fill="${COLORS.stroke}" opacity="0.95" />
        <path ${common} d="M154 102 L154 148" />
        <path ${common} d="M154 120 L126 92" />
        <path ${common} d="M154 120 L205 72" />
        <path ${common} d="M154 148 L132 190" />
        <path ${common} d="M154 148 L180 188" />
      `;
    case "carry":
      return `
        <circle cx="154" cy="70" r="18" fill="${COLORS.stroke}" opacity="0.95" />
        <path ${common} d="M154 90 L154 147" />
        <path ${common} d="M154 108 L116 126" />
        <path ${common} d="M154 108 L194 126" />
        <path ${common} d="M154 147 L132 191" />
        <path ${common} d="M154 147 L181 189" />
        <rect x="93" y="123" width="22" height="26" rx="6" fill="${COLORS.primary}" opacity="0.92" />
        <rect x="196" y="123" width="22" height="26" rx="6" fill="${COLORS.primary}" opacity="0.92" />
      `;
    case "locomotion":
      return `
        <circle cx="160" cy="74" r="18" fill="${COLORS.stroke}" opacity="0.95" />
        <path ${common} d="M160 93 L150 138 L188 151" />
        <path ${common} d="M151 135 L117 177" />
        <path ${common} d="M188 151 L222 168" />
        <path ${common} d="M149 114 L190 93" />
        <path ${common} d="M185 92 L223 70" />
        <path d="M95 202 C118 191, 139 191, 162 202" stroke="${COLORS.primary}" stroke-width="6" fill="none" opacity="0.85" />
        <path d="M168 202 C191 191, 212 191, 235 202" stroke="${COLORS.accent}" stroke-width="6" fill="none" opacity="0.85" />
      `;
    case "striking":
      return `
        <circle cx="154" cy="72" r="18" fill="${COLORS.stroke}" opacity="0.95" />
        <path ${common} d="M154 92 L150 138 L180 154" />
        <path ${common} d="M150 112 L122 92" />
        <path ${common} d="M180 114 L228 94" />
        <path ${common} d="M150 138 L126 188" />
        <path ${common} d="M180 154 L212 190" />
        <circle cx="246" cy="88" r="20" fill="${COLORS.accent}" opacity="0.88" />
        <path d="M232 102 L259 75" stroke="${COLORS.neutral}" stroke-width="5" stroke-linecap="round" />
      `;
    case "technical":
      return `
        <circle cx="154" cy="70" r="18" fill="${COLORS.stroke}" opacity="0.95" />
        <path ${common} d="M154 90 L154 146" />
        <path ${common} d="M154 110 L118 136" />
        <path ${common} d="M154 110 L194 90" />
        <path ${common} d="M154 146 L132 188" />
        <path ${common} d="M154 146 L183 190" />
        <circle cx="234" cy="94" r="8" fill="${COLORS.primary}" />
        <circle cx="258" cy="116" r="8" fill="${COLORS.accent}" />
        <circle cx="224" cy="140" r="8" fill="${COLORS.neutral}" opacity="0.88" />
        <path d="M234 94 L258 116 L224 140" stroke="${COLORS.muted}" stroke-width="4" fill="none" opacity="0.9" />
      `;
    case "flow":
      return `
        <circle cx="154" cy="72" r="17" fill="${COLORS.stroke}" opacity="0.95" />
        <path ${common} d="M154 90 C144 110, 144 134, 160 156" />
        <path ${common} d="M160 156 C170 172, 188 183, 212 186" />
        <path ${common} d="M156 112 C128 116, 111 130, 102 152" />
        <path ${common} d="M160 156 C146 176, 133 188, 118 196" />
        <path d="M90 88 C118 64, 150 57, 186 64" stroke="${COLORS.primary}" stroke-width="6" fill="none" opacity="0.78" />
        <path d="M188 62 C217 70, 240 88, 252 116" stroke="${COLORS.accent}" stroke-width="6" fill="none" opacity="0.72" />
      `;
    case "core":
      return `
        <circle cx="154" cy="72" r="18" fill="${COLORS.stroke}" opacity="0.95" />
        <path ${common} d="M154 90 L154 144" />
        <path ${common} d="M154 108 L120 124" />
        <path ${common} d="M154 108 L188 124" />
        <path ${common} d="M154 144 L132 186" />
        <path ${common} d="M154 144 L179 188" />
        <ellipse cx="154" cy="126" rx="26" ry="38" fill="rgba(4,190,129,0.16)" stroke="rgba(4,190,129,0.55)" stroke-width="4" />
      `;
    case "squat":
    default:
      return `
        <circle cx="154" cy="68" r="18" fill="${COLORS.stroke}" opacity="0.95" />
        <path ${common} d="M154 87 L154 132" />
        <path ${common} d="M154 104 L120 118" />
        <path ${common} d="M154 104 L205 95" />
        <path ${common} d="M154 132 L128 166" />
        <path ${common} d="M128 166 L92 190" />
        <path ${common} d="M154 132 L187 162" />
        <path ${common} d="M187 162 L228 162" />
        <rect x="86" y="86" width="162" height="10" rx="5" fill="${COLORS.primary}" opacity="0.92" />
      `;
  }
}

function sportAccent(sportTags: string[]): { fill: string; label: string } {
  const tags = sportTags.map((x) => x.toLowerCase());
  if (tags.includes("hyrox")) return { fill: "#00C9A7", label: "HYROX" };
  if (tags.includes("crossfit")) return { fill: "#6D3AE8", label: "CROSSFIT" };
  if (tags.includes("powerlifting")) return { fill: "#04BE81", label: "POWER" };
  return { fill: "#04BE81", label: "GYM" };
}

function equipmentAccent(equipment: string): string {
  const item = equipment.toLowerCase();
  if (item.includes("barbell") || item.includes("e-z")) return "BARBELL";
  if (item.includes("dumbbell")) return "DUMBBELL";
  if (item.includes("kettlebell")) return "KETTLEBELL";
  if (item.includes("machine")) return "MACHINE";
  if (item.includes("sled")) return "SLED";
  if (item.includes("body")) return "BODYWEIGHT";
  return equipment.replace(/_/g, " ").toUpperCase();
}

function systemAccent(system: string): string {
  const key = system.toLowerCase();
  if (key.includes("phosph")) return "ALACTIC";
  if (key.includes("glyco") || key.includes("lact")) return "LACTATE";
  if (key.includes("oxid") || key.includes("aerob")) return "AEROBIC";
  return system.replace(/_/g, " ").toUpperCase();
}

export function renderExerciseArtSvg(record: UnifiedExerciseRecord): string {
  const accent = sportAccent(record.sportTags);
  const name = esc(record.name);
  const movement = esc(record.movementPattern.replace(/_/g, " "));
  const equipment = esc(equipmentAccent(record.equipment[0] ?? "bodyweight"));
  const difficulty = esc(record.difficulty.toUpperCase());
  const primarySystem = esc(systemAccent(record.physiology.primarySystem));
  const sportLabel = esc(record.sportTags.slice(0, 2).join(" · ").toUpperCase() || "GYM");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${COLORS.bgTop}"/>
      <stop offset="100%" stop-color="${COLORS.bgBottom}"/>
    </linearGradient>
    <linearGradient id="plate" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${COLORS.support}" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="${COLORS.accent}" stop-opacity="0.25"/>
    </linearGradient>
  </defs>

  <rect width="480" height="320" rx="22" fill="url(#bg)"/>
  <rect x="16" y="16" width="448" height="288" rx="18" fill="none" stroke="rgba(238,238,227,0.10)"/>
  <circle cx="378" cy="78" r="72" fill="${COLORS.accent}" opacity="0.11"/>
  <circle cx="100" cy="250" r="84" fill="${COLORS.primary}" opacity="0.08"/>
  <path d="M302 228 C338 176, 395 170, 442 213" stroke="rgba(4,190,129,0.14)" stroke-width="18" fill="none" stroke-linecap="round"/>

  <rect x="28" y="26" width="88" height="26" rx="13" fill="${accent.fill}" opacity="0.95"/>
  <text x="72" y="43" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" font-weight="700" fill="${COLORS.neutral}">${accent.label}</text>

  <rect x="338" y="26" width="106" height="24" rx="12" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.10)"/>
  <text x="391" y="42" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" font-weight="700" fill="${COLORS.muted}">${sportLabel}</text>

  <rect x="28" y="64" width="250" height="150" rx="20" fill="url(#plate)" stroke="rgba(238,238,227,0.10)"/>
  ${movementIcon(record.movementPattern)}

  <text x="28" y="245" font-family="Arial, sans-serif" font-size="26" font-weight="700" fill="${COLORS.neutral}">${name}</text>
  <text x="28" y="268" font-family="Arial, sans-serif" font-size="13" fill="${COLORS.muted}">EMPATHY EXERCISE SYSTEM · ${movement.toUpperCase()}</text>

  <rect x="28" y="283" width="122" height="18" rx="9" fill="rgba(4,190,129,0.16)" stroke="rgba(4,190,129,0.32)"/>
  <text x="89" y="295" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="700" fill="${COLORS.primary}">${equipment}</text>

  <rect x="162" y="283" width="108" height="18" rx="9" fill="rgba(109,58,232,0.16)" stroke="rgba(109,58,232,0.34)"/>
  <text x="216" y="295" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="700" fill="${COLORS.neutral}">${difficulty}</text>

  <rect x="332" y="242" width="116" height="50" rx="16" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.10)"/>
  <text x="390" y="262" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="${COLORS.muted}">PRIMARY SYSTEM</text>
  <text x="390" y="282" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="700" fill="${COLORS.neutral}">${primarySystem}</text>
</svg>`;
}
