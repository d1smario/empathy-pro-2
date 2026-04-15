import type {
  Pro2BlockChart,
  Pro2BuilderBlockContract,
  Pro2BuilderSessionContract,
  Pro2RenderProfile,
} from "@/lib/training/builder/pro2-session-contract";

/**
 * Allinea un contratto VIRYA al formato “file Builder” Pro 2: `source: "builder"`, `renderProfile`,
 * blocchi con `chart` usabile. Le note di contesto (structure tag, methodology, `origin=virya_planner`)
 * restano responsabilità del chiamante sul primo blocco, dopo il finalize.
 */
function zoneFromIntensityCue(cue: string | undefined, kind: string): string {
  const c = cue ?? "";
  const m = c.match(/\b(Z[1-7]|LT1|LT2|FatMax)\b/i);
  if (m) {
    const z = m[1]!;
    return z.toLowerCase() === "fatmax" ? "FatMax" : z.toUpperCase();
  }
  if (/recovery|Z1-Z2|easy spin/i.test(c)) return "Z2";
  if (/VO2|Z5 short|Z5-focused/i.test(c)) return "Z5";
  if (/threshold|Z4|soglia/i.test(c)) return "Z4";
  if (/glycolytic|Z5-Z6|anaerobic/i.test(c)) return "Z6";
  if (/torque|neuromuscular/i.test(c)) return "Z3";
  if (/mitochondrial|fat oxidation|Z2 sustained|aerobic volume/i.test(c)) return "Z2";
  if (kind === "strength_sets") return "Z4";
  if (kind === "technical_drill") return "Z3";
  if (kind === "flow_recovery") return "Z2";
  return "Z3";
}

function blockHasUsableChart(block: Pro2BuilderBlockContract): boolean {
  const ch = block.chart;
  if (!ch || typeof ch !== "object") return false;
  const minutes = Number(ch.minutes) || 0;
  const seconds = Number(ch.seconds) || 0;
  return minutes > 0 || seconds > 0;
}

function stubSteadyChart(block: Pro2BuilderBlockContract, zone: string): Pro2BlockChart {
  const minutes = Math.max(1, Math.round(block.durationMinutes || 1));
  return {
    minutes,
    seconds: 0,
    intensity: zone,
    startIntensity: zone,
    endIntensity: zone,
    intensity2: zone,
    intensity3: zone,
    repeats: 1,
    workSeconds: 0,
    recoverSeconds: 0,
    step1Seconds: 0,
    step2Seconds: 0,
    step3Seconds: 0,
    pyramidSteps: 1,
    pyramidStepSeconds: 0,
    pyramidStartTarget: 0,
    pyramidEndTarget: 0,
    distanceKm: 0,
    gradePercent: 0,
    elevationMeters: 0,
    cadence: "",
    frequencyHint: "",
    loadFactor: 1,
  };
}

export function finalizeViryaPro2ContractAsBuilderFile(input: {
  contract: Pro2BuilderSessionContract;
  ftpW: number;
  hrMax: number;
  intensityUnit: "watt" | "hr";
  lengthMode?: "time" | "distance";
  speedRefKmh?: number;
}): Pro2BuilderSessionContract {
  const lengthMode = input.lengthMode ?? "time";
  const speedRefKmh = Math.max(8, Number(input.speedRefKmh) || 32);
  const renderProfile: Pro2RenderProfile = {
    intensityUnit: input.intensityUnit,
    ftpW: Math.max(1, Math.round(input.ftpW || 200)),
    hrMax: Math.max(1, Math.round(input.hrMax || 185)),
    lengthMode,
    speedRefKmh,
  };

  const blocksIn = input.contract.blocks ?? [];
  const blocks: Pro2BuilderBlockContract[] = blocksIn.map((b) => {
    if (blockHasUsableChart(b)) return b;
    const zone = zoneFromIntensityCue(b.intensityCue, b.kind);
    return {
      ...b,
      kind: "steady",
      durationMinutes: Math.max(1, Math.round(b.durationMinutes || 1)),
      chart: stubSteadyChart(b, zone),
    };
  });

  return {
    ...input.contract,
    source: "builder",
    renderProfile,
    blocks,
  };
}
