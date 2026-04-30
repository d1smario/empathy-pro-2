import test from "node:test";
import assert from "node:assert/strict";
import { extractStructuredValuesFromLabText } from "@/lib/health/lab-text-extractors";

test("blood parser recognizes RBC/WBC and core markers aliases", () => {
  const text = `
    CBC
    HGB 15.8 g/dL
    RBC 5.10
    WBC 6.4
    HCT 46.2
    PLT 245
    HbA1c 5.2
  `;
  const out = extractStructuredValuesFromLabText(text, "blood");
  assert.equal(out.emoglobina, 15.8);
  assert.equal(out.rbc, 5.1);
  assert.equal(out.wbc, 6.4);
  assert.equal(out.hct, 46.2);
  assert.equal(out.plt, 245);
  assert.equal(out.hba1c, 5.2);
});

test("hormones parser recognizes endocrine aliases", () => {
  const text = `
    Cortisol AM 18.2
    Cortisol PM 7.9
    Testosterone totale 520
    TSH 1.8
    FT3 3.5
    FT4 1.2
    IGF-1 198
  `;
  const out = extractStructuredValuesFromLabText(text, "hormones");
  assert.equal(out.cortisol_am, 18.2);
  assert.equal(out.cortisol_pm, 7.9);
  assert.equal(out.testosterone, 520);
  assert.equal(out.tsh, 1.8);
  assert.equal(out.t3, 3.5);
  assert.equal(out.t4, 1.2);
  assert.equal(out.igf1, 198);
});

test("microbiota parser returns taxa structure and fungi flag", () => {
  const text = `
    Firmicutes 52.4
    Bacteroidetes 33.1
    Proteobacteria 8.2
    Candida albicans 2.4
    Shannon 3.8
  `;
  const out = extractStructuredValuesFromLabText(text, "microbiota");
  const taxa = Array.isArray(out.microbiota_taxa) ? out.microbiota_taxa : [];
  assert.ok(taxa.length >= 3);
  assert.equal(out.microbiota_fungi_present, 1);
  assert.equal(out.diversity_shannon, 3.8);
});

test("epigenetics parser detects gene hits and methylation flags", () => {
  const text = `
    Genetic panel:
    MTHFR heterozygous variant
    COMT low activity
    Hypermethylation signature on stress pathways
  `;
  const out = extractStructuredValuesFromLabText(text, "epigenetics");
  const genes = Array.isArray(out.epigenetic_gene_hits) ? out.epigenetic_gene_hits : [];
  const flags = Array.isArray(out.epigenetic_methylation_flags) ? out.epigenetic_methylation_flags : [];
  assert.ok(genes.includes("MTHFR"));
  assert.ok(genes.includes("COMT"));
  assert.ok(flags.some((f) => String(f).toLowerCase().includes("hypermethyl")));
});
