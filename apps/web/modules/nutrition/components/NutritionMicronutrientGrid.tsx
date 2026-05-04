"use client";

import type { ScaledMealItemNutrients } from "@/lib/nutrition/canonical-food-composition";

export type NutritionMicroLine = { name: string; value: number; unit: string };

export type NutritionMicronutrientGridProps = {
  vitamins: NutritionMicroLine[];
  minerals: NutritionMicroLine[];
  aminoAcids: NutritionMicroLine[];
  fattyAcids: NutritionMicroLine[];
  /** Nutrienti FDC non mappati sui quattro bucket (es. sodio, alcol, composti minori). */
  otherNutrients: NutritionMicroLine[];
  /** Classe extra sul contenitore (es. nutrition-diary-micro-board senza titoli). */
  className?: string;
};

/** Risposta API diario micronutrienti (USDA). */
export type DiaryMicroRollupPayload = {
  vitamins: Array<{ name: string; total: number; unit: string }>;
  minerals: Array<{ name: string; total: number; unit: string }>;
  aminoAcids: Array<{ name: string; total: number; unit: string }>;
  fattyAcids: Array<{ name: string; total: number; unit: string }>;
  otherNutrients?: Array<{ name: string; total: number; unit: string }>;
};

export function diaryMicroRollupToGridProps(m: DiaryMicroRollupPayload): NutritionMicronutrientGridProps {
  const map = (rows: DiaryMicroRollupPayload["vitamins"]): NutritionMicroLine[] =>
    rows.map((r) => ({ name: r.name, value: r.total, unit: r.unit }));
  return {
    vitamins: map(m.vitamins),
    minerals: map(m.minerals),
    aminoAcids: map(m.aminoAcids),
    fattyAcids: map(m.fattyAcids),
    otherNutrients: map(m.otherNutrients ?? []),
  };
}

function MicroCol({ title, lines }: { title: string; lines: NutritionMicroLine[] }) {
  return (
    <div className="nutrition-diary-micro-col">
      <div className="nutrition-diary-micro-col-title">{title}</div>
      <ul className="nutrition-diary-micro-list">
        {lines.length ? (
          lines.map((r) => (
            <li key={r.name}>
              <span>{r.name}</span>
              <span>
                {r.value} {r.unit}
              </span>
            </li>
          ))
        ) : (
          <li className="muted-copy">—</li>
        )}
      </ul>
    </div>
  );
}

export function NutritionMicronutrientGrid({
  vitamins,
  minerals,
  aminoAcids,
  fattyAcids,
  otherNutrients,
  className,
}: NutritionMicronutrientGridProps) {
  return (
    <div className={className ?? "nutrition-micro-grid-wrap"}>
      <div className="nutrition-diary-micro-grid grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MicroCol title="Vitamine" lines={vitamins} />
        <MicroCol title="Minerali" lines={minerals} />
        <MicroCol title="Aminoacidi" lines={aminoAcids} />
        <MicroCol title="Grassi (frazioni)" lines={fattyAcids} />
        <MicroCol title="Altri (FDC)" lines={otherNutrients} />
      </div>
    </div>
  );
}

function formatMicroValue(value: number, unit: string): string {
  if (!Number.isFinite(value) || value === 0) return "—";
  const abs = Math.abs(value);
  const rounded = abs >= 100 ? Math.round(value) : abs >= 10 ? Math.round(value * 10) / 10 : Math.round(value * 100) / 100;
  return `${rounded} ${unit}`;
}

type MicroTargetKind = "min" | "max";

type MicroTarget = {
  target: number;
  unit: string;
  kind?: MicroTargetKind;
};

type MicroChartDatum = NutritionMicroLine & {
  target: number;
  pct: number;
  kind: MicroTargetKind;
};

type MicroBoardLines = Omit<NutritionMicronutrientGridProps, "className">;

const MICRO_TARGETS: Record<string, MicroTarget> = {
  "vitamina a (rae)": { target: 900, unit: "µg" },
  "vitamina c": { target: 90, unit: "mg" },
  "vitamina d": { target: 15, unit: "µg" },
  "vitamina e": { target: 15, unit: "mg" },
  "vitamina k": { target: 120, unit: "µg" },
  "tiamina (b1)": { target: 1.2, unit: "mg" },
  "riboflavina (b2)": { target: 1.3, unit: "mg" },
  "niacina (b3)": { target: 16, unit: "mg" },
  "vitamina b6": { target: 1.7, unit: "mg" },
  "acido pantotenico (b5) stim.": { target: 5, unit: "mg" },
  "folati": { target: 400, unit: "µg" },
  "folati (equivalenti)": { target: 400, unit: "µg" },
  "vitamina b12": { target: 2.4, unit: "µg" },
  calcio: { target: 1000, unit: "mg" },
  ferro: { target: 8, unit: "mg" },
  magnesio: { target: 420, unit: "mg" },
  fosforo: { target: 700, unit: "mg" },
  potassio: { target: 3500, unit: "mg" },
  sodio: { target: 2000, unit: "mg", kind: "max" },
  zinco: { target: 11, unit: "mg" },
  selenio: { target: 55, unit: "µg" },
  "cloruro stim. da sodio": { target: 2300, unit: "mg" },
  "rame stim.": { target: 0.9, unit: "mg" },
  "manganese stim.": { target: 2.3, unit: "mg" },
  "iodio stim.": { target: 150, unit: "µg" },
  leucina: { target: 2.73, unit: "g" },
  lisina: { target: 2.1, unit: "g" },
  metionina: { target: 1.05, unit: "g" },
  fenilalanina: { target: 1.75, unit: "g" },
  treonina: { target: 1.05, unit: "g" },
  triptofano: { target: 0.28, unit: "g" },
  isoleucina: { target: 1.4, unit: "g" },
  valina: { target: 1.82, unit: "g" },
  istidina: { target: 0.7, unit: "g" },
  alanina: { target: 2.5, unit: "g" },
  arginina: { target: 3.5, unit: "g" },
  "acido aspartico": { target: 5, unit: "g" },
  cisteina: { target: 0.7, unit: "g" },
  "acido glutammico": { target: 8, unit: "g" },
  glicina: { target: 2.5, unit: "g" },
  prolina: { target: 3, unit: "g" },
  serina: { target: 2.8, unit: "g" },
  tirosina: { target: 1.7, unit: "g" },
  glutammina: { target: 5, unit: "g" },
  asparagina: { target: 2, unit: "g" },
  "fibra alimentare": { target: 30, unit: "g" },
  "acidi grassi saturi": { target: 20, unit: "g", kind: "max" },
  saturi: { target: 20, unit: "g", kind: "max" },
  "acidi grassi monoinsaturi": { target: 35, unit: "g" },
  "monoinsaturi": { target: 35, unit: "g" },
  "acidi grassi polinsaturi": { target: 18, unit: "g" },
  "polinsaturi": { target: 18, unit: "g" },
  "omega-6 stim.": { target: 14, unit: "g" },
  "omega-3 (epa+dha appross.)": { target: 1.6, unit: "g" },
  "omega-3": { target: 1.6, unit: "g" },
  "rapporto omega-6/omega-3": { target: 4, unit: "ratio", kind: "max" },
  "grassi insaturi": { target: 45, unit: "g" },
  "quota saturi su grassi": { target: 10, unit: "%", kind: "max" },
  "trans stimati": { target: 2, unit: "g", kind: "max" },
  "colesterolo stim.": { target: 300, unit: "mg", kind: "max" },
  "lipidi totali": { target: 80, unit: "g" },
};

function normalizeMicroName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function targetForLine(line: NutritionMicroLine): MicroTarget | null {
  return MICRO_TARGETS[normalizeMicroName(line.name)] ?? null;
}

const MICRO_BOARD_TEMPLATES: MicroBoardLines = {
  vitamins: [
    { name: "Vitamina A (RAE)", value: 0, unit: "µg" },
    { name: "Vitamina C", value: 0, unit: "mg" },
    { name: "Vitamina D", value: 0, unit: "µg" },
    { name: "Vitamina E", value: 0, unit: "mg" },
    { name: "Vitamina K", value: 0, unit: "µg" },
    { name: "Tiamina (B1)", value: 0, unit: "mg" },
    { name: "Riboflavina (B2)", value: 0, unit: "mg" },
    { name: "Niacina (B3)", value: 0, unit: "mg" },
    { name: "Vitamina B6", value: 0, unit: "mg" },
    { name: "Acido pantotenico (B5) stim.", value: 0, unit: "mg" },
    { name: "Folati (equivalenti)", value: 0, unit: "µg" },
    { name: "Vitamina B12", value: 0, unit: "µg" },
  ],
  minerals: [
    { name: "Calcio", value: 0, unit: "mg" },
    { name: "Ferro", value: 0, unit: "mg" },
    { name: "Magnesio", value: 0, unit: "mg" },
    { name: "Fosforo", value: 0, unit: "mg" },
    { name: "Potassio", value: 0, unit: "mg" },
    { name: "Sodio", value: 0, unit: "mg" },
    { name: "Zinco", value: 0, unit: "mg" },
    { name: "Selenio", value: 0, unit: "µg" },
    { name: "Cloruro stim. da sodio", value: 0, unit: "mg" },
    { name: "Rame stim.", value: 0, unit: "mg" },
    { name: "Manganese stim.", value: 0, unit: "mg" },
    { name: "Iodio stim.", value: 0, unit: "µg" },
  ],
  aminoAcids: [
    { name: "Leucina", value: 0, unit: "g" },
    { name: "Lisina", value: 0, unit: "g" },
    { name: "Metionina", value: 0, unit: "g" },
    { name: "Fenilalanina", value: 0, unit: "g" },
    { name: "Treonina", value: 0, unit: "g" },
    { name: "Triptofano", value: 0, unit: "g" },
    { name: "Isoleucina", value: 0, unit: "g" },
    { name: "Valina", value: 0, unit: "g" },
    { name: "Istidina", value: 0, unit: "g" },
    { name: "Alanina", value: 0, unit: "g" },
    { name: "Arginina", value: 0, unit: "g" },
    { name: "Acido aspartico", value: 0, unit: "g" },
    { name: "Cisteina", value: 0, unit: "g" },
    { name: "Acido glutammico", value: 0, unit: "g" },
    { name: "Glicina", value: 0, unit: "g" },
    { name: "Prolina", value: 0, unit: "g" },
    { name: "Serina", value: 0, unit: "g" },
    { name: "Tirosina", value: 0, unit: "g" },
    { name: "Glutammina", value: 0, unit: "g" },
    { name: "Asparagina", value: 0, unit: "g" },
  ],
  fattyAcids: [
    { name: "Fibra alimentare", value: 0, unit: "g" },
    { name: "Acidi grassi saturi", value: 0, unit: "g" },
    { name: "Acidi grassi monoinsaturi", value: 0, unit: "g" },
    { name: "Acidi grassi polinsaturi", value: 0, unit: "g" },
    { name: "Omega-3 (EPA+DHA appross.)", value: 0, unit: "g" },
    { name: "Omega-6 stim.", value: 0, unit: "g" },
    { name: "Rapporto omega-6/omega-3", value: 0, unit: ":1" },
    { name: "Grassi insaturi", value: 0, unit: "g" },
    { name: "Quota saturi su grassi", value: 0, unit: "%" },
    { name: "Trans stimati", value: 0, unit: "g" },
    { name: "Colesterolo stim.", value: 0, unit: "mg" },
    { name: "Lipidi totali", value: 0, unit: "g" },
  ],
  otherNutrients: [],
};

function matchIncomingLine(template: NutritionMicroLine, incoming: NutritionMicroLine[]): NutritionMicroLine | null {
  const key = normalizeMicroName(template.name);
  const exact = incoming.find((line) => normalizeMicroName(line.name) === key);
  if (exact) return exact;
  if (key.startsWith("folati")) return incoming.find((line) => normalizeMicroName(line.name).startsWith("folati")) ?? null;
  if (key.startsWith("omega-3")) return incoming.find((line) => normalizeMicroName(line.name).startsWith("omega-3")) ?? null;
  if (key === "acidi grassi saturi") return incoming.find((line) => normalizeMicroName(line.name) === "saturi") ?? null;
  if (key === "acidi grassi monoinsaturi") return incoming.find((line) => normalizeMicroName(line.name) === "monoinsaturi") ?? null;
  if (key === "acidi grassi polinsaturi") return incoming.find((line) => normalizeMicroName(line.name) === "polinsaturi") ?? null;
  return null;
}

function expandMicroLines(template: NutritionMicroLine[], incoming: NutritionMicroLine[]): NutritionMicroLine[] {
  const templateKeys = new Set(template.map((line) => normalizeMicroName(line.name)));
  const merged = template.map((line) => {
    const match = matchIncomingLine(line, incoming);
    return match ? { ...line, value: match.value, unit: line.unit || match.unit } : line;
  });
  const extras = incoming.filter((line) => !templateKeys.has(normalizeMicroName(line.name)));
  return [...merged, ...extras];
}

function expandMicroBoardLines(lines: MicroBoardLines): MicroBoardLines {
  return {
    vitamins: expandMicroLines(MICRO_BOARD_TEMPLATES.vitamins, lines.vitamins),
    minerals: expandMicroLines(MICRO_BOARD_TEMPLATES.minerals, lines.minerals),
    aminoAcids: expandMicroLines(MICRO_BOARD_TEMPLATES.aminoAcids, lines.aminoAcids),
    fattyAcids: expandMicroLines(MICRO_BOARD_TEMPLATES.fattyAcids, lines.fattyAcids),
    otherNutrients: expandMicroLines([], lines.otherNutrients ?? []),
  };
}

function toChartData(lines: NutritionMicroLine[]): MicroChartDatum[] {
  return lines
    .map((line) => {
      const target = targetForLine(line);
      if (!target || target.target <= 0 || !Number.isFinite(line.value)) return null;
      const pct = Math.round((line.value / target.target) * 100);
      return {
        ...line,
        target: target.target,
        kind: target.kind ?? "min",
        pct,
      };
    })
    .filter((line): line is MicroChartDatum => Boolean(line))
    .slice(0, 20);
}

function polarPoint(index: number, total: number, radius: number): { x: number; y: number } {
  const angle = -Math.PI / 2 + (index / total) * Math.PI * 2;
  return {
    x: 50 + Math.cos(angle) * radius,
    y: 50 + Math.sin(angle) * radius,
  };
}

function polygonPoints(rows: MicroChartDatum[]): string {
  const total = Math.max(3, rows.length);
  return rows
    .map((row, index) => {
      const cappedPct = Math.max(0, Math.min(row.pct, 140));
      const p = polarPoint(index, total, 12 + (cappedPct / 140) * 34);
      return `${p.x},${p.y}`;
    })
    .join(" ");
}

function MicroPercentRadar({
  title,
  subtitle,
  lines,
  tone,
}: {
  title: string;
  subtitle: string;
  lines: NutritionMicroLine[];
  tone: "vitamins" | "minerals" | "amino" | "lipids";
}) {
  const rows = toChartData(lines);
  const axisCount = Math.max(3, rows.length);
  return (
    <article className={`empathy-micro-radar-card empathy-micro-radar-card--${tone}`}>
      <div className="empathy-micro-radar-copy">
        <h5>{title}</h5>
        <p>{subtitle}</p>
      </div>
      {rows.length ? (
        <div className="empathy-micro-radar-layout">
          <svg className="empathy-micro-radar-svg" viewBox="0 0 100 100" role="img" aria-label={`${title}: percentuali su target`}>
            <polygon className="empathy-micro-radar-grid" points={Array.from({ length: axisCount }, (_, i) => {
              const p = polarPoint(i, axisCount, 46);
              return `${p.x},${p.y}`;
            }).join(" ")} />
            <polygon className="empathy-micro-radar-grid empathy-micro-radar-grid--mid" points={Array.from({ length: axisCount }, (_, i) => {
              const p = polarPoint(i, axisCount, 29);
              return `${p.x},${p.y}`;
            }).join(" ")} />
            {Array.from({ length: axisCount }, (_, i) => {
              const p = polarPoint(i, axisCount, 46);
              return <line key={i} className="empathy-micro-radar-axis" x1="50" y1="50" x2={p.x} y2={p.y} />;
            })}
            <polygon className="empathy-micro-radar-fill" points={polygonPoints(rows)} />
          </svg>
          <ul className="empathy-micro-radar-list">
            {rows.map((row) => (
              <li key={row.name}>
                <span>{row.name}</span>
                <strong>
                  {Math.min(row.pct, 999)}% <small>{row.kind === "max" ? "limite" : "target"}</small>
                </strong>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="muted-copy text-xs">Target non disponibile per questo bucket.</p>
      )}
    </article>
  );
}

export function NutritionMicronutrientDailyBoard({
  vitamins,
  minerals,
  aminoAcids,
  fattyAcids,
  otherNutrients,
  className,
}: NutritionMicronutrientGridProps) {
  const boardLines = expandMicroBoardLines({ vitamins, minerals, aminoAcids, fattyAcids, otherNutrients });

  return (
    <div className={className ?? "empathy-micro-daily-board"}>
      <div className="empathy-micro-daily-head">
        <div>
          <p className="empathy-micro-daily-eyebrow">Totali giornalieri · micronutrienti</p>
          <h4>Assunzione stimata e copertura rispetto ai valori consigliati</h4>
        </div>
        <span>Valori dal piano alimentare assemblato; target adulti indicativi.</span>
      </div>
      <div className="empathy-micro-radar-grid-wrap">
        <MicroPercentRadar title="Vitamine" subtitle="12 indicatori vitaminici giornalieri" lines={boardLines.vitamins} tone="vitamins" />
        <MicroPercentRadar title="Minerali" subtitle="12 minerali e proxy elettrolitici" lines={boardLines.minerals} tone="minerals" />
        <MicroPercentRadar title="Aminoacidi" subtitle="20 aminoacidi: EAA diretti + profilo stimato" lines={boardLines.aminoAcids} tone="amino" />
        <MicroPercentRadar title="Grassi e fibra" subtitle="12 indicatori: catene, omega e limiti" lines={boardLines.fattyAcids} tone="lipids" />
      </div>
      <NutritionMicronutrientTable {...boardLines} />
    </div>
  );
}

type MicroTableSectionTone = "vitamins" | "minerals" | "amino" | "lipids";

function MicronutrientTableSection({
  tone,
  title,
  lines,
}: {
  tone: MicroTableSectionTone;
  title: string;
  lines: NutritionMicroLine[];
}) {
  return (
    <div className={`empathy-micro-table-section empathy-micro-table-section--${tone}`}>
      <table className="empathy-micro-table">
        <thead>
          <tr>
            <th scope="colgroup" colSpan={2}>
              {title}
            </th>
          </tr>
          <tr className="empathy-micro-table-subhead">
            <th scope="col">Nutriente</th>
            <th scope="col">Quantità</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((r) => (
            <tr key={r.name}>
              <td>{r.name}</td>
              <td className="empathy-micro-table-val">{formatMicroValue(r.value, r.unit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Vista tabellare (meal plan / report): quattro blocchi colorati, lista completa dai props. */
export function NutritionMicronutrientTable({
  vitamins,
  minerals,
  aminoAcids,
  fattyAcids,
  otherNutrients,
  className,
}: NutritionMicronutrientGridProps) {
  return (
    <div className={className ?? "empathy-micro-table-outer"}>
      <div className="empathy-micro-table-stack">
        <MicronutrientTableSection tone="vitamins" title="Vitamine" lines={vitamins} />
        <MicronutrientTableSection tone="minerals" title="Minerali" lines={minerals} />
        <MicronutrientTableSection tone="amino" title="Aminoacidi · profilo completo" lines={aminoAcids} />
        <MicronutrientTableSection tone="lipids" title="Grassi · catene · fibra" lines={fattyAcids} />
        <MicronutrientTableSection tone="minerals" title="Altri nutrienti (USDA FDC)" lines={otherNutrients} />
      </div>
    </div>
  );
}

function n1(x: number): number {
  return Math.round(x * 10) / 10;
}

function n2(x: number): number {
  return Math.round(x * 100) / 100;
}

function clampMicro(x: number, min = 0): number {
  return Number.isFinite(x) ? Math.max(min, x) : min;
}

function aminoFromProtein(proteinG: number, fraction: number): number {
  return n2(clampMicro(proteinG) * fraction);
}

function fattyPct(part: number, total: number): number {
  return total > 0 ? n1((part / total) * 100) : 0;
}

/** Da totali giornali stimati del piano (banca canonica) → stesso layout del diario. */
export function mealPlanDayTotalsToMicroLines(d: ScaledMealItemNutrients): Omit<NutritionMicronutrientGridProps, "className"> {
  const vitamins: NutritionMicroLine[] = [
    { name: "Vitamina A (RAE)", value: n2(d.vitA_mcg_RAE), unit: "µg" },
    { name: "Vitamina C", value: n1(d.vitC_mg), unit: "mg" },
    { name: "Vitamina D", value: n2(d.vitD_mcg), unit: "µg" },
    { name: "Vitamina E", value: n2(d.vitE_mg), unit: "mg" },
    { name: "Vitamina K", value: n2(d.vitK_mcg), unit: "µg" },
    { name: "Tiamina (B1)", value: n2(d.thiamineB1_mg), unit: "mg" },
    { name: "Riboflavina (B2)", value: n2(d.riboflavinB2_mg), unit: "mg" },
    { name: "Niacina (B3)", value: n2(d.niacinB3_mg), unit: "mg" },
    { name: "Vitamina B6", value: n2(d.vitB6_mg), unit: "mg" },
    { name: "Folati", value: Math.round(d.folate_mcg), unit: "µg" },
    { name: "Vitamina B12", value: n2(d.vitB12_mcg), unit: "µg" },
  ].filter((row) => row.value > 0);

  const minerals: NutritionMicroLine[] = [
    { name: "Calcio", value: Math.round(d.ca_mg), unit: "mg" },
    { name: "Ferro", value: n2(d.fe_mg), unit: "mg" },
    { name: "Magnesio", value: Math.round(d.mg_mg), unit: "mg" },
    { name: "Fosforo", value: Math.round(d.p_mg), unit: "mg" },
    { name: "Potassio", value: Math.round(d.k_mg), unit: "mg" },
    { name: "Sodio", value: Math.round(d.na_mg), unit: "mg" },
    { name: "Zinco", value: n2(d.zn_mg), unit: "mg" },
    { name: "Selenio", value: n2(d.se_mcg), unit: "µg" },
  ].filter((row) => row.value > 0);

  const aminoAcids: NutritionMicroLine[] = [
    { name: "Leucina", value: n2(d.eaa_leu), unit: "g" },
    { name: "Lisina", value: n2(d.eaa_lys), unit: "g" },
    { name: "Metionina", value: n2(d.eaa_met), unit: "g" },
    { name: "Fenilalanina", value: n2(d.eaa_phe), unit: "g" },
    { name: "Treonina", value: n2(d.eaa_thr), unit: "g" },
    { name: "Triptofano", value: n2(d.eaa_trp), unit: "g" },
    { name: "Isoleucina", value: n2(d.eaa_ile), unit: "g" },
    { name: "Valina", value: n2(d.eaa_val), unit: "g" },
    { name: "Istidina", value: n2(d.eaa_his), unit: "g" },
  ].filter((row) => row.value > 0);

  const fattyAcids: NutritionMicroLine[] = [
    { name: "Saturi", value: n2(d.saturatedFatG), unit: "g" },
    { name: "Monoinsaturi", value: n2(d.monoFatG), unit: "g" },
    { name: "Polinsaturi", value: n2(d.polyFatG), unit: "g" },
    { name: "Omega-3", value: n2(d.omega3G), unit: "g" },
  ].filter((row) => row.value > 0);

  return { vitamins, minerals, aminoAcids, fattyAcids, otherNutrients: [] };
}

/** Tutti i micronutrienti del modello canonico (stima giorno da `dayTotals`), inclusi valori nulli → tabella completa. */
export function mealPlanDayTotalsToMicroLinesComplete(d: ScaledMealItemNutrients): Omit<NutritionMicronutrientGridProps, "className"> {
  const omega6G = n2(Math.max(0, d.polyFatG - d.omega3G));
  const unsaturatedFatG = n2(d.monoFatG + d.polyFatG);
  const omegaRatio = d.omega3G > 0 ? n2(omega6G / d.omega3G) : 0;
  const transFatEstimateG = n2(Math.min(2, d.saturatedFatG * 0.025));
  const cholesterolEstimateMg = Math.round(Math.max(0, d.saturatedFatG * 18 + d.proteinG * 2.5));

  const vitamins: NutritionMicroLine[] = [
    { name: "Vitamina A (RAE)", value: n2(d.vitA_mcg_RAE), unit: "µg" },
    { name: "Vitamina C", value: n1(d.vitC_mg), unit: "mg" },
    { name: "Vitamina D", value: n2(d.vitD_mcg), unit: "µg" },
    { name: "Vitamina E", value: n2(d.vitE_mg), unit: "mg" },
    { name: "Vitamina K", value: n2(d.vitK_mcg), unit: "µg" },
    { name: "Tiamina (B1)", value: n2(d.thiamineB1_mg), unit: "mg" },
    { name: "Riboflavina (B2)", value: n2(d.riboflavinB2_mg), unit: "mg" },
    { name: "Niacina (B3)", value: n2(d.niacinB3_mg), unit: "mg" },
    { name: "Vitamina B6", value: n2(d.vitB6_mg), unit: "mg" },
    { name: "Acido pantotenico (B5) stim.", value: n2(Math.max(0, d.niacinB3_mg * 0.28 + d.riboflavinB2_mg * 0.8)), unit: "mg" },
    { name: "Folati (equivalenti)", value: Math.round(d.folate_mcg), unit: "µg" },
    { name: "Vitamina B12", value: n2(d.vitB12_mcg), unit: "µg" },
  ];

  const minerals: NutritionMicroLine[] = [
    { name: "Calcio", value: Math.round(d.ca_mg), unit: "mg" },
    { name: "Ferro", value: n2(d.fe_mg), unit: "mg" },
    { name: "Magnesio", value: Math.round(d.mg_mg), unit: "mg" },
    { name: "Fosforo", value: Math.round(d.p_mg), unit: "mg" },
    { name: "Potassio", value: Math.round(d.k_mg), unit: "mg" },
    { name: "Sodio", value: Math.round(d.na_mg), unit: "mg" },
    { name: "Zinco", value: n2(d.zn_mg), unit: "mg" },
    { name: "Selenio", value: n2(d.se_mcg), unit: "µg" },
    { name: "Cloruro stim. da sodio", value: Math.round(d.na_mg * 1.54), unit: "mg" },
    { name: "Rame stim.", value: n2(Math.max(0, d.zn_mg * 0.09)), unit: "mg" },
    { name: "Manganese stim.", value: n2(Math.max(0, d.mg_mg * 0.006)), unit: "mg" },
    { name: "Iodio stim.", value: Math.round(Math.max(0, d.se_mcg * 1.8)), unit: "µg" },
  ];

  const aminoAcids: NutritionMicroLine[] = [
    { name: "Leucina", value: n2(d.eaa_leu), unit: "g" },
    { name: "Lisina", value: n2(d.eaa_lys), unit: "g" },
    { name: "Metionina", value: n2(d.eaa_met), unit: "g" },
    { name: "Fenilalanina", value: n2(d.eaa_phe), unit: "g" },
    { name: "Treonina", value: n2(d.eaa_thr), unit: "g" },
    { name: "Triptofano", value: n2(d.eaa_trp), unit: "g" },
    { name: "Isoleucina", value: n2(d.eaa_ile), unit: "g" },
    { name: "Valina", value: n2(d.eaa_val), unit: "g" },
    { name: "Istidina", value: n2(d.eaa_his), unit: "g" },
    { name: "Alanina", value: aminoFromProtein(d.proteinG, 0.052), unit: "g" },
    { name: "Arginina", value: aminoFromProtein(d.proteinG, 0.062), unit: "g" },
    { name: "Acido aspartico", value: aminoFromProtein(d.proteinG, 0.094), unit: "g" },
    { name: "Cisteina", value: aminoFromProtein(d.proteinG, 0.018), unit: "g" },
    { name: "Acido glutammico", value: aminoFromProtein(d.proteinG, 0.16), unit: "g" },
    { name: "Glicina", value: aminoFromProtein(d.proteinG, 0.045), unit: "g" },
    { name: "Prolina", value: aminoFromProtein(d.proteinG, 0.055), unit: "g" },
    { name: "Serina", value: aminoFromProtein(d.proteinG, 0.049), unit: "g" },
    { name: "Tirosina", value: aminoFromProtein(d.proteinG, 0.034), unit: "g" },
    { name: "Glutammina", value: aminoFromProtein(d.proteinG, 0.055), unit: "g" },
    { name: "Asparagina", value: aminoFromProtein(d.proteinG, 0.035), unit: "g" },
  ];

  const fattyAcids: NutritionMicroLine[] = [
    { name: "Fibra alimentare", value: n1(d.fiberG), unit: "g" },
    { name: "Acidi grassi saturi", value: n2(d.saturatedFatG), unit: "g" },
    { name: "Acidi grassi monoinsaturi", value: n2(d.monoFatG), unit: "g" },
    { name: "Acidi grassi polinsaturi", value: n2(d.polyFatG), unit: "g" },
    { name: "Omega-3 (EPA+DHA appross.)", value: n2(d.omega3G), unit: "g" },
    { name: "Omega-6 stim.", value: omega6G, unit: "g" },
    { name: "Rapporto omega-6/omega-3", value: omegaRatio, unit: ":1" },
    { name: "Grassi insaturi", value: unsaturatedFatG, unit: "g" },
    { name: "Quota saturi su grassi", value: fattyPct(d.saturatedFatG, d.fatG), unit: "%" },
    { name: "Trans stimati", value: transFatEstimateG, unit: "g" },
    { name: "Colesterolo stim.", value: cholesterolEstimateMg, unit: "mg" },
    { name: "Lipidi totali", value: n2(d.fatG), unit: "g" },
  ];

  return { vitamins, minerals, aminoAcids, fattyAcids, otherNutrients: [] };
}

/** Pathway / solver rollup (prima del piano LLM) → stesso layout del diario. */
export function pathwayNutrientSummaryToMicroLines(
  summary: {
    vitC: number;
    vitD: number;
    b2: number;
    b3: number;
    mg: number;
    fe: number;
    omega3: number;
    leucine: number;
  },
  minDailyMl: number,
): Omit<NutritionMicronutrientGridProps, "className"> {
  const vitamins: NutritionMicroLine[] = [
    { name: "Vitamina C", value: n1(summary.vitC), unit: "mg" },
    { name: "Vitamina D", value: n2(summary.vitD), unit: "µg" },
    { name: "Riboflavina (B2)", value: n2(summary.b2), unit: "mg" },
    { name: "Niacina (B3)", value: n2(summary.b3), unit: "mg" },
  ].filter((row) => row.value > 0);

  const minerals: NutritionMicroLine[] = [
    { name: "Magnesio", value: Math.round(summary.mg), unit: "mg" },
    { name: "Ferro", value: n2(summary.fe), unit: "mg" },
  ].filter((row) => row.value > 0);

  const aminoAcids: NutritionMicroLine[] =
    summary.leucine > 0 ? [{ name: "Leucina", value: n2(summary.leucine), unit: "g" }] : [];

  const fattyAcids: NutritionMicroLine[] = [
    ...(summary.omega3 > 0 ? [{ name: "Omega-3", value: n2(summary.omega3), unit: "g" as const }] : []),
    ...(minDailyMl > 0 ? [{ name: "Idratazione (target)", value: Math.round(minDailyMl), unit: "ml" as const }] : []),
  ];

  return { vitamins, minerals, aminoAcids, fattyAcids, otherNutrients: [] };
}
