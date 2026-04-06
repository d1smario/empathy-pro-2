export type SignalPresenceInput = {
  key: string;
  present: boolean;
  recommendedInput?: string | null;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function summarizeSignalPresence(signals: SignalPresenceInput[]) {
  const total = signals.length;
  const availableSignals = signals.filter((signal) => signal.present).map((signal) => signal.key);
  const missingSignals = signals.filter((signal) => !signal.present).map((signal) => signal.key);
  const recommendedInputs = signals
    .filter((signal) => !signal.present && signal.recommendedInput)
    .map((signal) => String(signal.recommendedInput))
    .filter((value, index, list) => Boolean(value) && list.indexOf(value) === index);
  const coveragePct = total > 0 ? round((availableSignals.length / total) * 100, 1) : 100;
  const inputUncertaintyPct = round(clamp(100 - coveragePct, 0, 100), 1);

  return {
    coveragePct,
    inputUncertaintyPct,
    availableSignals,
    missingSignals,
    recommendedInputs,
  };
}

export function summarizeCoverageMap(
  coverage: Record<string, number> | null | undefined,
  recommendedInputsByChannel?: Record<string, string>,
) {
  const map = coverage ?? {};
  const entries = Object.entries(map)
    .filter(([, value]) => typeof value === "number" && Number.isFinite(value))
    .map(([key, value]) => [key, clamp(value, 0, 100)] as const);

  if (!entries.length) {
    return {
      coveragePct: null,
      missingChannels: [] as string[],
      recommendedInputs: [] as string[],
    };
  }

  const coveragePct = round(entries.reduce((sum, [, value]) => sum + value, 0) / entries.length, 1);
  const missingChannels = entries
    .filter(([, value]) => value <= 0)
    .map(([key]) => key);
  const recommendedInputs = missingChannels
    .map((key) => recommendedInputsByChannel?.[key] ?? key)
    .filter((value, index, list) => Boolean(value) && list.indexOf(value) === index);

  return {
    coveragePct,
    missingChannels,
    recommendedInputs,
  };
}
