import type { KnowledgeResearchTraceSummary } from "@/api/knowledge/contracts";
import type { NutritionPathwaySupportItem } from "@/api/nutrition/contracts";
import type { AthleteEvidenceMemoryItem } from "@/lib/empathy/schemas/memory";

const NUTRIENT_TAG_PATTERNS: Array<{ regex: RegExp; cofactor: string }> = [
  { regex: /\biron\b|\bferr|\bferro\b/i, cofactor: "Ferro eme/non eme" },
  { regex: /\bb12\b|\bcobalam/i, cofactor: "Vitamina B12" },
  { regex: /\bfolat|\bb9\b/i, cofactor: "Folati (B9)" },
  { regex: /\bvit\s*c\b|\bascorb/i, cofactor: "Vitamina C da alimenti" },
  { regex: /\bvit\s*d\b|\bcholecalcif/i, cofactor: "Vitamina D" },
  { regex: /\bmagnes|\bmg\b/i, cofactor: "Magnesio (chinasi)" },
  { regex: /\bomega|epa|dha/i, cofactor: "Omega-3 EPA/DHA" },
  { regex: /\bpolifen|antioxid|redox/i, cofactor: "Polifenoli alimentari" },
  { regex: /\bglutamin/i, cofactor: "Glutamina alimentare" },
  { regex: /\bzinc|\bzn\b/i, cofactor: "Zinco" },
  { regex: /\bselen/i, cofactor: "Selenio" },
];

function uniq(items: string[]): string[] {
  return Array.from(new Set(items.map((s) => s.trim()).filter(Boolean)));
}

function cofactorsFromText(text: string): string[] {
  const out: string[] = [];
  for (const { regex, cofactor } of NUTRIENT_TAG_PATTERNS) {
    if (regex.test(text)) out.push(cofactor);
  }
  return out;
}

function pathwayFromEvidenceHit(item: AthleteEvidenceMemoryItem, index: number): NutritionPathwaySupportItem | null {
  const tags = [
    ...(item.nutritionTags ?? []),
    ...(item.mechanismTags ?? []),
    item.title ?? "",
    item.summary ?? "",
    item.adaptationTarget ?? "",
  ].join(" ");
  const cofactors = cofactorsFromText(tags);
  if (!cofactors.length) return null;
  const id = `evidence_${String(item.id ?? index).replace(/[^a-zA-Z0-9]/g, "").slice(0, 12)}`;
  return {
    id,
    pathwayLabel: `Evidence · ${(item.title ?? item.summary ?? "nutrition trace").slice(0, 64)}`,
    stimulatedBy: uniq([...(item.mechanismTags ?? []), ...(item.nutritionTags ?? [])]).slice(0, 6),
    substrates: ["Contesto alimentare coerente con evidenza strutturata"],
    cofactors: uniq(cofactors).slice(0, 6),
    inhibitorsToAvoid: [],
    phases: [
      {
        phase: "daily_support",
        windowLabel: "Asse giornaliero (evidence-linked)",
        halfLifeClass: "hours_extended",
        actions: ["Prioritizzare alimenti ricchi dei cofattori mappati da trace/evidence."],
      },
    ],
    systemLevels: ["biochemical"],
    confidence: "session_knowledge",
  };
}

function pathwayFromResearchTrace(trace: KnowledgeResearchTraceSummary, index: number): NutritionPathwaySupportItem | null {
  const text = `${trace.latestResultSummary ?? ""} ${trace.trigger?.module ?? ""} ${trace.trigger?.stimulusLabel ?? ""} ${trace.trigger?.entityLabel ?? ""}`;
  const cofactors = cofactorsFromText(text);
  if (!cofactors.length) return null;
  return {
    id: `trace_${String(trace.traceId ?? index).replace(/[^a-zA-Z0-9]/g, "").slice(0, 12)}`,
    pathwayLabel: `Knowledge trace · ${(trace.trigger?.stimulusLabel ?? trace.latestResultSummary ?? "research").slice(0, 56)}`,
    stimulatedBy: [trace.trigger?.module ?? "knowledge", trace.status].filter(Boolean),
    substrates: ["Pattern alimentare informato da retrieval knowledge"],
    cofactors: uniq(cofactors).slice(0, 5),
    inhibitorsToAvoid: [],
    phases: [
      {
        phase: "daily_support",
        windowLabel: "Contesto interpretativo (non override solver)",
        halfLifeClass: "circadian",
        actions: ["Usare come hint micronutrienti; numeri pasti restano da motori deterministici."],
      },
    ],
    systemLevels: ["biochemical"],
    confidence: "session_knowledge",
  };
}

export type EvidencePathwayBridgeResult = {
  pathwayExtensions: NutritionPathwaySupportItem[];
  cofactorStrings: string[];
  notes: string[];
};

/** Bridge evidence/traces → pathway extensions (Interpretation layer, no parallel meal plan). */
export function buildEvidencePathwayBridge(input: {
  evidenceItems?: readonly AthleteEvidenceMemoryItem[];
  researchTraces?: readonly KnowledgeResearchTraceSummary[];
}): EvidencePathwayBridgeResult {
  const pathwayExtensions: NutritionPathwaySupportItem[] = [];
  const cofactorStrings: string[] = [];
  const notes: string[] = [];

  for (const [i, item] of (input.evidenceItems ?? []).entries()) {
    if (item.module && item.module !== "nutrition" && !(item.domain ?? "").toLowerCase().includes("nutrition")) continue;
    const row = pathwayFromEvidenceHit(item, i);
    if (!row) continue;
    pathwayExtensions.push(row);
    cofactorStrings.push(...row.cofactors);
    notes.push(`Evidence: ${row.pathwayLabel.slice(0, 80)}`);
  }

  for (const [i, trace] of (input.researchTraces ?? []).entries()) {
    const mod = (trace.trigger?.module ?? "").toLowerCase();
    if (mod && mod !== "nutrition" && mod !== "health") continue;
    if (!(trace.latestResultSummary ?? "").trim()) continue;
    const row = pathwayFromResearchTrace(trace, i);
    if (!row) continue;
    pathwayExtensions.push(row);
    cofactorStrings.push(...row.cofactors);
  }

  return {
    pathwayExtensions: pathwayExtensions.slice(0, 4),
    cofactorStrings: uniq(cofactorStrings).slice(0, 10),
    notes: notes.slice(0, 4),
  };
}
