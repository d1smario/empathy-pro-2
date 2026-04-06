/**
 * Schema visivo drill/schemi — stesso modello grafico di V1 (`lib/training/libraries.ts`):
 * SVG data-URI con campo/court + pedine ruoli. Gli asset PNG/WEBP futuri useranno `visualAssetKey` come riferimento.
 */

export type TechnicalSchemaBoardPoint = { x: number; y: number; role: string };

export type TechnicalSchemaCategory =
  | "technical"
  | "tactical"
  | "situational"
  | "offensive_phase"
  | "defensive_phase"
  | "simulation"
  | "motor_control";

/** Mappa chiave palette Pro 2 → etichetta disciplina V1 (colori e campo). */
export function paletteSportKeyToV1Label(sportKey: string): string {
  const k = sportKey.trim().toLowerCase();
  const map: Record<string, string> = {
    soccer: "Calcio",
    volleyball: "Pallavolo",
    basketball: "Basket",
    tennis: "Tennis",
    boxing: "Boxe",
    karate: "Karate",
    judo: "Judo",
    "muay thai": "Muay Thai",
  };
  return map[k] ?? sportKey;
}

const SOCCER_BOARD: TechnicalSchemaBoardPoint[] = [
  { x: 14, y: 20, role: "GK" },
  { x: 22, y: 38, role: "CB1" },
  { x: 22, y: 62, role: "CB2" },
  { x: 40, y: 24, role: "CM1" },
  { x: 40, y: 76, role: "CM2" },
  { x: 62, y: 32, role: "W1" },
  { x: 62, y: 68, role: "W2" },
  { x: 80, y: 50, role: "9" },
];

const BASKET_BOARD: TechnicalSchemaBoardPoint[] = [
  { x: 50, y: 18, role: "1" },
  { x: 28, y: 34, role: "2" },
  { x: 72, y: 34, role: "3" },
  { x: 34, y: 64, role: "4" },
  { x: 66, y: 64, role: "5" },
];

const VOLLEY_BOARD: TechnicalSchemaBoardPoint[] = [
  { x: 22, y: 22, role: "4" },
  { x: 50, y: 22, role: "3" },
  { x: 78, y: 22, role: "2" },
  { x: 22, y: 76, role: "5" },
  { x: 50, y: 76, role: "6" },
  { x: 78, y: 76, role: "1" },
];

const BOXING_BOARD: TechnicalSchemaBoardPoint[] = [
  { x: 34, y: 52, role: "A" },
  { x: 66, y: 52, role: "B" },
  { x: 50, y: 24, role: "C" },
];

const KARATE_BOARD: TechnicalSchemaBoardPoint[] = [
  { x: 36, y: 50, role: "AKA" },
  { x: 64, y: 50, role: "AO" },
  { x: 50, y: 18, role: "R" },
];

const JUDO_BOARD: TechnicalSchemaBoardPoint[] = [
  { x: 38, y: 50, role: "T" },
  { x: 62, y: 50, role: "U" },
  { x: 50, y: 20, role: "C" },
];

const MUAY_BOARD: TechnicalSchemaBoardPoint[] = [
  { x: 34, y: 50, role: "R" },
  { x: 66, y: 50, role: "B" },
  { x: 50, y: 20, role: "P" },
];

const TENNIS_BOARD: TechnicalSchemaBoardPoint[] = [
  { x: 32, y: 42, role: "Sx" },
  { x: 68, y: 58, role: "Dx" },
  { x: 50, y: 30, role: "N" },
];

export function boardPointsForPaletteSportKey(sportKey: string): TechnicalSchemaBoardPoint[] {
  const k = sportKey.trim().toLowerCase();
  if (k === "soccer") return SOCCER_BOARD;
  if (k === "basketball") return BASKET_BOARD;
  if (k === "volleyball") return VOLLEY_BOARD;
  if (k === "boxing") return BOXING_BOARD;
  if (k === "karate") return KARATE_BOARD;
  if (k === "judo") return JUDO_BOARD;
  if (k === "muay thai") return MUAY_BOARD;
  if (k === "tennis") return TENNIS_BOARD;
  return SOCCER_BOARD;
}

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase();
}

function escapeSvgText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function svgDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function accentForDiscipline(discipline: string): string {
  const accents: Record<string, string> = {
    calcio: "#78f0a4",
    pallavolo: "#7dd3fc",
    basket: "#f59e0b",
    tennis: "#a3e635",
    boxe: "#fb7185",
    karate: "#f97316",
    judo: "#a78bfa",
    "muay thai": "#f43f5e",
  };
  return accents[normalizeLabel(discipline)] ?? "#c084fc";
}

function boardPaletteForSport(sport: string): { surface: string; lines: string } {
  const normalized = normalizeLabel(sport);
  if (normalized === "basket") return { surface: "#4a2d16", lines: "#f8d7a5" };
  if (normalized === "pallavolo") return { surface: "#1c4f72", lines: "#c2e6ff" };
  if (normalized === "boxe" || normalized === "muay thai") return { surface: "#34263d", lines: "#f8c7ff" };
  if (normalized === "karate" || normalized === "judo") return { surface: "#45505f", lines: "#e5edf7" };
  if (normalized === "tennis") return { surface: "#365314", lines: "#ecfccb" };
  return { surface: "#29513a", lines: "#bde7c6" };
}

function shortTagLine(tags?: string[], max = 4): string {
  return (tags ?? [])
    .slice(0, max)
    .map((tag) => tag.replace(/_/g, " ").toUpperCase())
    .join(" · ");
}

function renderTechnicalSurface(
  sportLabel: string,
  boardPoints: TechnicalSchemaBoardPoint[],
  accent: string,
  surface: string,
  lines: string,
): string {
  const normalized = normalizeLabel(sportLabel);
  const points = boardPoints
    .map((point) => {
      const x = 24 + point.x * 5.5;
      const y = 104 + point.y * 2.1;
      return `
        <g>
          <circle cx="${x}" cy="${y}" r="13" fill="${accent}" fill-opacity="0.96" stroke="#091018" stroke-width="3" />
          <text x="${x}" y="${y + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="#081017">${escapeSvgText(
            point.role,
          )}</text>
        </g>`;
    })
    .join("");

  if (normalized === "basket") {
    return `
      <rect x="20" y="90" width="380" height="246" rx="18" fill="${surface}" stroke="${lines}" stroke-width="2"/>
      <rect x="60" y="110" width="300" height="206" rx="12" fill="none" stroke="${lines}" stroke-width="2"/>
      <circle cx="210" cy="213" r="34" fill="none" stroke="${lines}" stroke-width="2"/>
      <path d="M84 160 C134 160 154 180 154 213 C154 246 134 266 84 266" fill="none" stroke="${lines}" stroke-width="2"/>
      <path d="M336 160 C286 160 266 180 266 213 C266 246 286 266 336 266" fill="none" stroke="${lines}" stroke-width="2"/>
      <line x1="210" y1="110" x2="210" y2="316" stroke="${lines}" stroke-width="2"/>
      ${points}`;
  }
  if (normalized === "pallavolo") {
    return `
      <rect x="20" y="90" width="380" height="246" rx="18" fill="${surface}" stroke="${lines}" stroke-width="2"/>
      <rect x="46" y="116" width="328" height="194" rx="8" fill="none" stroke="${lines}" stroke-width="2"/>
      <line x1="210" y1="116" x2="210" y2="310" stroke="${lines}" stroke-width="4" stroke-dasharray="6 6"/>
      <line x1="46" y1="180" x2="374" y2="180" stroke="${lines}" stroke-width="1.5" opacity="0.6"/>
      <line x1="46" y1="246" x2="374" y2="246" stroke="${lines}" stroke-width="1.5" opacity="0.6"/>
      ${points}`;
  }
  if (normalized === "boxe" || normalized === "muay thai") {
    return `
      <rect x="20" y="90" width="380" height="246" rx="18" fill="#1b1426" stroke="${lines}" stroke-width="2"/>
      <rect x="68" y="122" width="284" height="182" rx="8" fill="${surface}" stroke="${lines}" stroke-width="3"/>
      <rect x="54" y="108" width="312" height="210" rx="14" fill="none" stroke="${accent}" stroke-opacity="0.35" stroke-width="6"/>
      <line x1="68" y1="152" x2="352" y2="152" stroke="${lines}" stroke-width="1.5" opacity="0.5"/>
      <line x1="68" y1="274" x2="352" y2="274" stroke="${lines}" stroke-width="1.5" opacity="0.5"/>
      ${points}`;
  }
  if (normalized === "karate" || normalized === "judo") {
    return `
      <rect x="20" y="90" width="380" height="246" rx="18" fill="${surface}" stroke="${lines}" stroke-width="2"/>
      <rect x="68" y="122" width="284" height="182" rx="12" fill="none" stroke="${lines}" stroke-width="2"/>
      <rect x="90" y="144" width="240" height="138" rx="6" fill="none" stroke="${accent}" stroke-opacity="0.3" stroke-width="2"/>
      <line x1="210" y1="122" x2="210" y2="304" stroke="${lines}" stroke-width="1.5" opacity="0.7"/>
      <line x1="68" y1="213" x2="352" y2="213" stroke="${lines}" stroke-width="1.5" opacity="0.7"/>
      ${points}`;
  }
  if (normalized === "tennis") {
    return `
      <rect x="20" y="90" width="380" height="246" rx="18" fill="${surface}" stroke="${lines}" stroke-width="2"/>
      <line x1="210" y1="90" x2="210" y2="336" stroke="${lines}" stroke-width="3"/>
      <rect x="46" y="116" width="328" height="194" rx="6" fill="none" stroke="${lines}" stroke-width="1.5" opacity="0.85"/>
      <line x1="46" y1="213" x2="374" y2="213" stroke="${lines}" stroke-width="2" opacity="0.9"/>
      ${points}`;
  }
  return `
    <rect x="20" y="90" width="380" height="246" rx="18" fill="${surface}" stroke="${lines}" stroke-width="2"/>
    <line x1="210" y1="90" x2="210" y2="336" stroke="${lines}" stroke-width="2"/>
    <circle cx="210" cy="213" r="34" fill="none" stroke="${lines}" stroke-width="2"/>
    <rect x="36" y="106" width="348" height="214" rx="14" fill="none" stroke="${lines}" stroke-width="1.5" opacity="0.55"/>
    ${points}`;
}

export type TechnicalSchemaCardInput = {
  /** Es. "Calcio" — da `paletteSportKeyToV1Label`. */
  sportLabelV1: string;
  title: string;
  objective: string;
  methodology?: string;
  category?: TechnicalSchemaCategory;
  boardPoints: TechnicalSchemaBoardPoint[];
  sourceLabel?: string;
  tags?: string[];
};

/**
 * SVG unificato stile V1: header + campo + pannello testo. Usare come preview finché non esiste PNG per `visualAssetKey`.
 */
export function buildTechnicalSchemaDataUrl(input: TechnicalSchemaCardInput): string {
  const accent = accentForDiscipline(input.sportLabelV1);
  const palette = boardPaletteForSport(input.sportLabelV1);
  const category = escapeSvgText((input.category ?? "technical").replace(/_/g, " ").toUpperCase());
  const title = escapeSvgText(input.title);
  const objective = escapeSvgText(input.objective);
  const methodology = escapeSvgText(input.methodology ?? "Schema esecutivo coach · Pro 2");
  const sourceLabel = escapeSvgText(input.sourceLabel ?? input.sportLabelV1);
  const tags = escapeSvgText(shortTagLine(input.tags));

  return svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#121722"/>
          <stop offset="100%" stop-color="#090d14"/>
        </linearGradient>
      </defs>
      <rect width="640" height="360" rx="24" fill="url(#bg)"/>
      <rect x="20" y="20" width="600" height="52" rx="16" fill="#0d131d" stroke="rgba(255,255,255,0.08)"/>
      <text x="36" y="42" font-size="13" font-weight="700" fill="${accent}">${escapeSvgText(input.sportLabelV1.toUpperCase())}</text>
      <text x="36" y="61" font-size="21" font-weight="700" fill="#f8fafc">${title}</text>
      <text x="604" y="43" text-anchor="end" font-size="12" font-weight="700" fill="#cbd5e1">${category}</text>
      ${renderTechnicalSurface(input.sportLabelV1, input.boardPoints, accent, palette.surface, palette.lines)}
      <rect x="420" y="90" width="200" height="246" rx="18" fill="#0d131d" stroke="rgba(255,255,255,0.08)"/>
      <text x="440" y="120" font-size="11" font-weight="700" fill="${accent}">OBJECTIVE</text>
      <text x="440" y="144" font-size="16" font-weight="700" fill="#f8fafc">${objective}</text>
      <text x="440" y="186" font-size="11" font-weight="700" fill="${accent}">METHOD</text>
      <text x="440" y="208" font-size="13" fill="#cbd5e1">${methodology}</text>
      <text x="440" y="252" font-size="11" font-weight="700" fill="${accent}">SOURCE</text>
      <text x="440" y="274" font-size="13" fill="#cbd5e1">${sourceLabel}</text>
      <text x="440" y="304" font-size="10" fill="#94a3b8">IMG: pending · key visualAssetKey</text>
      <text x="440" y="318" font-size="11" fill="#64748b">${tags}</text>
    </svg>`);
}

export function entryTypeToSchemaCategory(entryType: "drill" | "scheme"): TechnicalSchemaCategory {
  return entryType === "scheme" ? "tactical" : "technical";
}
