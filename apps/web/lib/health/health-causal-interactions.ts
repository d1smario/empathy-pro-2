import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

type DbClient = SupabaseClient;

type CausalInsertSummary = {
  nodesInserted: number;
  edgesInserted: number;
  responsesInserted: number;
  lineageInserted: number;
  nodeIds: string[];
  edgeIds: string[];
  responseIds: string[];
};

function hasPositive(parsed: Record<string, unknown>, key: string): boolean {
  const v = parsed[key];
  if (typeof v === "number" && v > 0) return true;
  if (typeof v === "string" && v.trim() !== "" && Number(v) > 0) return true;
  return false;
}

export async function buildAndPersistHealthCausalInteractions(input: {
  db: DbClient;
  athleteId: string;
  sampleDate: string;
  parsed: Record<string, unknown>;
  extractionRunId: string | null;
  panelId: string;
}): Promise<CausalInsertSummary> {
  const observedAt = `${input.sampleDate}T00:00:00.000Z`;
  const nodes: Array<{ athlete_id: string; node_key: string; area: string; label: string; state: Record<string, unknown>; observed_at: string }> =
    [];
  const edges: Array<Record<string, unknown>> = [];
  const responses: Array<Record<string, unknown>> = [];

  if (hasPositive(input.parsed, "hba1c") || hasPositive(input.parsed, "glicemia")) {
    nodes.push({
      athlete_id: input.athleteId,
      node_key: "glycemic_environment",
      area: "biochimica",
      label: "Ambiente glicemico",
      state: { hba1c: input.parsed.hba1c ?? null, glicemia: input.parsed.glicemia ?? null },
      observed_at: observedAt,
    });
  }

  if (hasPositive(input.parsed, "crp_mg_l") || hasPositive(input.parsed, "il6") || hasPositive(input.parsed, "tnf_alpha")) {
    nodes.push({
      athlete_id: input.athleteId,
      node_key: "inflammatory_pressure",
      area: "biochimica",
      label: "Pressione infiammatoria",
      state: {
        crp_mg_l: input.parsed.crp_mg_l ?? null,
        il6: input.parsed.il6 ?? null,
        tnf_alpha: input.parsed.tnf_alpha ?? null,
      },
      observed_at: observedAt,
    });
  }

  if (hasPositive(input.parsed, "cortisol_am") || hasPositive(input.parsed, "cortisol_pm")) {
    nodes.push({
      athlete_id: input.athleteId,
      node_key: "hpa_axis_load",
      area: "neuroendocrino",
      label: "Carico asse HPA",
      state: { cortisol_am: input.parsed.cortisol_am ?? null, cortisol_pm: input.parsed.cortisol_pm ?? null },
      observed_at: observedAt,
    });
  }

  const taxa = Array.isArray(input.parsed.microbiota_taxa) ? input.parsed.microbiota_taxa : [];
  const hasFungi = taxa.some((t) => {
    if (!t || typeof t !== "object" || Array.isArray(t)) return false;
    const kind = String((t as Record<string, unknown>).kind ?? "").toLowerCase();
    return kind === "fungi";
  });
  if (taxa.length > 0) {
    nodes.push({
      athlete_id: input.athleteId,
      node_key: "microbiota_profile",
      area: "microbiotica",
      label: "Profilo microbiotico",
      state: { taxa_count: taxa.length, fungi_present: hasFungi },
      observed_at: observedAt,
    });
  }

  const epigeneticGenes = Array.isArray(input.parsed.epigenetic_gene_hits) ? input.parsed.epigenetic_gene_hits : [];
  if (epigeneticGenes.length > 0) {
    nodes.push({
      athlete_id: input.athleteId,
      node_key: "epigenetic_susceptibility",
      area: "genetica",
      label: "Suscettibilita epigenetica",
      state: { genes: epigeneticGenes },
      observed_at: observedAt,
    });
  }

  if (nodes.some((n) => n.node_key === "microbiota_profile") && nodes.some((n) => n.node_key === "glycemic_environment")) {
    edges.push({
      athlete_id: input.athleteId,
      from_node_key: "glycemic_environment",
      to_node_key: "microbiota_profile",
      effect_sign: "modulate",
      confidence: 0.66,
      evidence_refs: [{ panel_id: input.panelId, extraction_run_id: input.extractionRunId }],
      rule_key: "slow_carb_sulfur_aa_microbiota_risk",
      rule_version: "v1",
      time_window: "post_recovery_0_24h",
      metadata: { source: "phase_c_baseline" },
      observed_at: observedAt,
    });
  }

  if (nodes.some((n) => n.node_key === "hpa_axis_load") && nodes.some((n) => n.node_key === "inflammatory_pressure")) {
    edges.push({
      athlete_id: input.athleteId,
      from_node_key: "hpa_axis_load",
      to_node_key: "inflammatory_pressure",
      effect_sign: "risk_up",
      confidence: 0.62,
      evidence_refs: [{ panel_id: input.panelId, extraction_run_id: input.extractionRunId }],
      rule_key: null,
      rule_version: "v1",
      time_window: "acute_0_72h",
      metadata: { source: "phase_c_baseline" },
      observed_at: observedAt,
    });
  }

  if (hasFungi && nodes.some((n) => n.node_key === "glycemic_environment")) {
    responses.push({
      athlete_id: input.athleteId,
      response_key: "fungal_overgrowth_energy_sequestration_risk",
      category: "risk",
      title: "Rischio sequestro energetico microbiotico",
      description:
        "Pattern combinato glicemico + presenza fungina nel profilo microbiota: possibile aumento inefficienza metabolica in recupero.",
      trigger_refs: [{ node: "glycemic_environment" }, { node: "microbiota_profile", fungi_present: true }],
      mitigation_refs: [{ lever: "timing_cho" }, { lever: "fermentation_tolerance_review" }, { lever: "recovery_window_nutrition" }],
      severity: "moderate",
      confidence: 0.64,
      observed_at: observedAt,
    });
  }

  const nodeIds: string[] = [];
  const edgeIds: string[] = [];
  const responseIds: string[] = [];
  if (nodes.length) {
    const { data, error } = await input.db.from("athlete_system_nodes").insert(nodes).select("id");
    if (error) throw new Error(error.message);
    nodeIds.push(...((data ?? []) as Array<{ id: string }>).map((row) => row.id));
  }
  if (edges.length) {
    const { data, error } = await input.db.from("athlete_system_edges").insert(edges).select("id");
    if (error) throw new Error(error.message);
    edgeIds.push(...((data ?? []) as Array<{ id: string }>).map((row) => row.id));
  }
  if (responses.length) {
    const { data, error } = await input.db.from("bioenergetics_responses").insert(responses).select("id");
    if (error) throw new Error(error.message);
    responseIds.push(...((data ?? []) as Array<{ id: string }>).map((row) => row.id));
  }

  const lineageRows = [
    ...nodeIds.map((id) => ({
      athlete_id: input.athleteId,
      extraction_run_id: input.extractionRunId,
      source_table: "extraction_runs",
      source_id: input.extractionRunId,
      target_table: "athlete_system_nodes",
      target_id: id,
      relation: "derived_system_node",
      metadata: { panel_id: input.panelId },
    })),
    ...edgeIds.map((id) => ({
      athlete_id: input.athleteId,
      extraction_run_id: input.extractionRunId,
      source_table: "extraction_runs",
      source_id: input.extractionRunId,
      target_table: "athlete_system_edges",
      target_id: id,
      relation: "derived_system_edge",
      metadata: { panel_id: input.panelId },
    })),
    ...responseIds.map((id) => ({
      athlete_id: input.athleteId,
      extraction_run_id: input.extractionRunId,
      source_table: "extraction_runs",
      source_id: input.extractionRunId,
      target_table: "bioenergetics_responses",
      target_id: id,
      relation: "derived_bioenergetics_response",
      metadata: { panel_id: input.panelId },
    })),
  ];
  let lineageInserted = 0;
  if (lineageRows.length) {
    const { error } = await input.db.from("observation_lineage").insert(lineageRows);
    if (error) throw new Error(error.message);
    lineageInserted = lineageRows.length;
  }

  return {
    nodesInserted: nodes.length,
    edgesInserted: edges.length,
    responsesInserted: responses.length,
    lineageInserted,
    nodeIds,
    edgeIds,
    responseIds,
  };
}
