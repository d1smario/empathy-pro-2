"use client";

import type { ScaledMealItemNutrients } from "@/lib/nutrition/canonical-food-composition";

export type NutritionMicroLine = { name: string; value: number; unit: string };

export type NutritionMicronutrientGridProps = {
  vitamins: NutritionMicroLine[];
  minerals: NutritionMicroLine[];
  aminoAcids: NutritionMicroLine[];
  fattyAcids: NutritionMicroLine[];
  /** Classe extra sul contenitore (es. nutrition-diary-micro-board senza titoli). */
  className?: string;
};

/** Risposta API diario micronutrienti (USDA). */
export type DiaryMicroRollupPayload = {
  vitamins: Array<{ name: string; total: number; unit: string }>;
  minerals: Array<{ name: string; total: number; unit: string }>;
  aminoAcids: Array<{ name: string; total: number; unit: string }>;
  fattyAcids: Array<{ name: string; total: number; unit: string }>;
};

export function diaryMicroRollupToGridProps(m: DiaryMicroRollupPayload): NutritionMicronutrientGridProps {
  const map = (rows: DiaryMicroRollupPayload["vitamins"]): NutritionMicroLine[] =>
    rows.map((r) => ({ name: r.name, value: r.total, unit: r.unit }));
  return {
    vitamins: map(m.vitamins),
    minerals: map(m.minerals),
    aminoAcids: map(m.aminoAcids),
    fattyAcids: map(m.fattyAcids),
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

export function NutritionMicronutrientGrid({ vitamins, minerals, aminoAcids, fattyAcids, className }: NutritionMicronutrientGridProps) {
  return (
    <div className={className ?? "nutrition-micro-grid-wrap"}>
      <div className="nutrition-diary-micro-grid">
        <MicroCol title="Vitamine" lines={vitamins} />
        <MicroCol title="Minerali" lines={minerals} />
        <MicroCol title="Aminoacidi" lines={aminoAcids} />
        <MicroCol title="Grassi (frazioni)" lines={fattyAcids} />
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
export function NutritionMicronutrientTable({ vitamins, minerals, aminoAcids, fattyAcids, className }: NutritionMicronutrientGridProps) {
  return (
    <div className={className ?? "empathy-micro-table-outer"}>
      <div className="empathy-micro-table-stack">
        <MicronutrientTableSection tone="vitamins" title="Vitamine" lines={vitamins} />
        <MicronutrientTableSection tone="minerals" title="Minerali" lines={minerals} />
        <MicronutrientTableSection tone="amino" title="Aminoacidi essenziali" lines={aminoAcids} />
        <MicronutrientTableSection tone="lipids" title="Grassi · fibra · idratazione target" lines={fattyAcids} />
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

  return { vitamins, minerals, aminoAcids, fattyAcids };
}

/** Tutti i micronutrienti del modello canonico (stima giorno da `dayTotals`), inclusi valori nulli → tabella completa. */
export function mealPlanDayTotalsToMicroLinesComplete(d: ScaledMealItemNutrients): Omit<NutritionMicronutrientGridProps, "className"> {
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
  ];

  const fattyAcids: NutritionMicroLine[] = [
    { name: "Fibra alimentare", value: n1(d.fiberG), unit: "g" },
    { name: "Acidi grassi saturi", value: n2(d.saturatedFatG), unit: "g" },
    { name: "Acidi grassi monoinsaturi", value: n2(d.monoFatG), unit: "g" },
    { name: "Acidi grassi polinsaturi", value: n2(d.polyFatG), unit: "g" },
    { name: "Omega-3 (EPA+DHA appross.)", value: n2(d.omega3G), unit: "g" },
  ];

  return { vitamins, minerals, aminoAcids, fattyAcids };
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

  return { vitamins, minerals, aminoAcids, fattyAcids };
}
