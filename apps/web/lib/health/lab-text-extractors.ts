import "server-only";

function parseEuNumber(raw: string): number | null {
  const n = Number(raw.replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n)) return null;
  if (n <= 0 || n > 1e7) return null;
  return n;
}

/** Cerca la prima occorrenza di una label e un numero entro `window` caratteri. */
function numberAfterLabels(text: string, labels: string[], window = 140): number | null {
  const norm = text.replace(/\r\n/g, "\n");
  const lower = norm.toLowerCase();
  for (const label of labels) {
    const L = label.toLowerCase();
    let from = 0;
    for (;;) {
      const i = lower.indexOf(L, from);
      if (i < 0) break;
      const slice = norm.slice(i, i + window);
      const m = slice.match(/(\d+[.,]\d+|\d{2,})/);
      if (m) {
        const v = parseEuNumber(m[1]);
        if (v != null) return v;
      }
      from = i + L.length;
    }
  }
  return null;
}

export type HealthPanelTypeForParse =
  | "blood"
  | "microbiota"
  | "epigenetics"
  | "hormones"
  | "inflammation"
  | "oxidative_stress";

/**
 * Estrae numeri da testo laboratorio (IT/EN) in chiavi compatibili con i grafici Health.
 * Euristica: nessuna garanzia clinica; serve a pre-compilare `values` per trend/radar.
 */
export function extractStructuredValuesFromLabText(
  rawText: string,
  panelType: HealthPanelTypeForParse,
): Record<string, number> {
  const text = rawText.replace(/\u00a0/g, " ");
  const out: Record<string, number> = {};

  const set = (key: string, v: number | null) => {
    if (v == null) return;
    if (out[key] == null) out[key] = v;
  };

  if (panelType === "blood") {
    set("emoglobina", numberAfterLabels(text, ["emoglobina", "emoglobin", "hb ", "hgb", "hb:"]));
    set("ferritina", numberAfterLabels(text, ["ferritina", "ferritin", "ferritine"]));
    set(
      "vit_d",
      numberAfterLabels(text, [
        "25-oh",
        "25 oh",
        "vitamina d",
        "vitamin d",
        "25-hydroxy",
        "calcidiolo",
      ]),
    );
    set("b12", numberAfterLabels(text, ["vitamina b12", "vit b12", "cobalamin", "b12", "ciano-cobalamina"]));
    set("glicemia", numberAfterLabels(text, ["glicemia", "glucose", "glucosio", "glycemia", "fasting glucose"]));
    set("hba1c", numberAfterLabels(text, ["hba1c", "emoglobina glicata", "glycated hemoglobin", "a1c"]));
    return out;
  }

  if (panelType === "inflammation") {
    set("crp_mg_l", numberAfterLabels(text, ["pcr-us", "pcr us", "hs-crp", "hscrp", "crp", "c reactive", "proteina c reattiva"]));
    set("il6", numberAfterLabels(text, ["il-6", "il 6", "interleukin 6", "interleuchina 6"]));
    set("tnf_alpha", numberAfterLabels(text, ["tnf-", "tnfα", "tnf alpha", "tumor necrosis"]));
    set("homocysteine", numberAfterLabels(text, ["omocisteina", "homocysteine", "hcy"]));
    set("oxidized_ldl", numberAfterLabels(text, ["ldl ossidat", "oxidized ldl", "ox-ldl", "oxldl"]));
    return out;
  }

  if (panelType === "microbiota") {
    set("firmicutes_pct", numberAfterLabels(text, ["firmicutes", "firmicuti"]));
    set("bacteroidetes_pct", numberAfterLabels(text, ["bacteroidetes", "batteroideti"]));
    set("proteobacteria_pct", numberAfterLabels(text, ["proteobacteria", "proteobatteri"]));
    set("actinobacteria_pct", numberAfterLabels(text, ["actinobacteria", "attinobatteri"]));
    set("diversity_shannon", numberAfterLabels(text, ["shannon", "diversità", "diversity alpha", "alpha diversity"]));
    set("scfa_total_mmol", numberAfterLabels(text, ["scfa", "acidi grassi a catena corta", "short chain fatty"]));
    return out;
  }

  if (panelType === "hormones") {
    set("cortisol_am", numberAfterLabels(text, ["cortisolo mattutino", "cortisol morning", "cortisol 8", "cortisol am"]));
    set("cortisol_pm", numberAfterLabels(text, ["cortisolo serale", "cortisol evening", "cortisol pm"]));
    set("testosterone", numberAfterLabels(text, ["testosterone", "testosteron", "tt ", "t totale"]));
    set("tsh", numberAfterLabels(text, ["tsh", "tirotropina", "thyrotropin"]));
    set("t3", numberAfterLabels(text, ["t3 libera", "free t3", "triiodotironina", "ft3"]));
    set("t4", numberAfterLabels(text, ["t4 libera", "free t4", "ft4", "tiroxina libera"]));
    set("dhea", numberAfterLabels(text, ["dhea", "deidroepiandrosterone", "dehydroepiandrosterone"]));
    set("igf1", numberAfterLabels(text, ["igf-1", "igf 1", "igf1", "somatomedina c", "somatomedin"]));
    return out;
  }

  if (panelType === "oxidative_stress") {
    set("roms_carr", numberAfterLabels(text, ["d-rom", "d rom", "roms", "diacron"]));
    set("bap_umol", numberAfterLabels(text, ["bap", "potenziale antiossidante"]));
    set("glutathione", numberAfterLabels(text, ["glutatione", "glutathione", "gsh"]));
    set("sod", numberAfterLabels(text, ["sod", "superoxide dismutase", "dismutasi"]));
    set("catalase", numberAfterLabels(text, ["catalasi", "catalase", "cat "])); 
    return out;
  }

  if (panelType === "epigenetics") {
    set("methylation_score", numberAfterLabels(text, ["metilazione", "methylation", "dna methylation"]));
    set("biological_age_delta", numberAfterLabels(text, ["età biologica", "biological age", "epigenetic age"]));
    set("epigenetic_detox", numberAfterLabels(text, ["detox", "detossificazione", "xenobiotic"]));
    set("epigenetic_repair", numberAfterLabels(text, ["riparazione dna", "dna repair", "repair pathway"]));
    set("epigenetic_oxidative_stress", numberAfterLabels(text, ["stress ossidativo", "oxidative stress", "ros "])); 
    return out;
  }

  return out;
}
