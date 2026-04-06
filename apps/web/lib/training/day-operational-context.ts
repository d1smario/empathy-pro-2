import type { AdaptationTrafficLight } from "@/lib/empathy/schemas";
import type { RecoveryStatus } from "@/lib/reality/recovery-summary";

export type TrainingDayOperationalMode = "normal" | "cautious" | "protective";

export type TrainingDayOperationalContext = {
  mode: TrainingDayOperationalMode;
  /** 0–1: suggested fraction of planned external load (TSS / duration proxy) for this day */
  loadScale: number;
  loadScalePct: number;
  headline: string;
  guidance: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function recoveryScale(status: RecoveryStatus | null | undefined): number {
  if (status === "poor") return 0.72;
  if (status === "moderate") return 0.88;
  if (status === "good") return 1;
  return 1;
}

function adaptationScale(input: {
  trafficLight: AdaptationTrafficLight;
  keepProgramUnchanged: boolean;
  reductionMinPct: number;
  reductionMaxPct: number;
}): number {
  if (input.keepProgramUnchanged || input.trafficLight === "green") return 1;
  const avgReduction = (input.reductionMinPct + input.reductionMaxPct) / 2;
  return clamp(1 - avgReduction / 100, 0.35, 1);
}

export function buildTrainingDayOperationalContext(input: {
  recoveryStatus?: RecoveryStatus | null;
  trafficLight?: AdaptationTrafficLight | null;
  keepProgramUnchanged?: boolean | null;
  reductionMinPct?: number | null;
  reductionMaxPct?: number | null;
}): TrainingDayOperationalContext {
  const rScale = recoveryScale(input.recoveryStatus ?? "unknown");
  const aScale = adaptationScale({
    trafficLight: input.trafficLight ?? "green",
    keepProgramUnchanged: input.keepProgramUnchanged ?? true,
    reductionMinPct: input.reductionMinPct ?? 0,
    reductionMaxPct: input.reductionMaxPct ?? 0,
  });
  const loadScale = round(clamp(rScale * aScale, 0.35, 1), 2);
  const loadScalePct = Math.round(loadScale * 100);

  let mode: TrainingDayOperationalMode = "normal";
  if (loadScale < 0.72) mode = "protective";
  else if (loadScale < 0.94) mode = "cautious";

  const headline =
    mode === "protective"
      ? "Modalita protettiva"
      : mode === "cautious"
        ? "Modalita cauta"
        : "Modalita standard";

  const parts: string[] = [];
  if (input.recoveryStatus === "poor") {
    parts.push("Recovery bassa: riduci densita' e aggressivita' del carico esterno oggi.");
  } else if (input.recoveryStatus === "moderate") {
    parts.push("Recovery intermedia: mantieni margine sulla intensita' e sui volumi aggiuntivi.");
  }
  if (input.trafficLight === "yellow" && !input.keepProgramUnchanged) {
    parts.push("Adattamento sotto atteso: applica riduzione carico in linea con il semaforo giallo.");
  }
  if (input.trafficLight === "red" && !input.keepProgramUnchanged) {
    parts.push("Adattamento critico: priorita' a ripristino e riduzione carico forte.");
  }
  if (!parts.length) {
    parts.push("Carico pianificato coerente con recovery e adattamento attuali.");
  }
  parts.push(`Target operativo stimato: circa ${loadScalePct}% del carico pianificato (TSS/durata come proxy).`);

  return {
    mode,
    loadScale,
    loadScalePct,
    headline,
    guidance: parts.join(" "),
  };
}
