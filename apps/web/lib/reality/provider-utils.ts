import type { RealityProvider } from "@/lib/empathy/schemas";

const PROVIDER_ALIASES: Array<{ provider: RealityProvider; matches: string[] }> = [
  { provider: "garmin", matches: ["garmin"] },
  { provider: "garmin_connectiq", matches: ["garmin_connectiq", "connectiq", "garmin ciq"] },
  { provider: "trainingpeaks", matches: ["trainingpeaks", "tp_"] },
  { provider: "strava", matches: ["strava"] },
  { provider: "polar", matches: ["polar"] },
  { provider: "wahoo", matches: ["wahoo"] },
  { provider: "coros", matches: ["coros"] },
  { provider: "whoop", matches: ["whoop"] },
  { provider: "oura", matches: ["oura"] },
  { provider: "cgm", matches: ["cgm", "dexcom", "freestyle libre", "libre"] },
  { provider: "manual", matches: ["manual"] },
];

export function normalizeRealityProvider(provider?: string | null): RealityProvider {
  const value = String(provider ?? "").trim().toLowerCase();
  if (!value) return "unknown";

  for (const candidate of PROVIDER_ALIASES) {
    if (candidate.matches.some((match) => value.includes(match))) {
      return candidate.provider;
    }
  }

  if (value === "unknown") return "unknown";
  return "other";
}

export function detectRealityProvider(input: {
  fileName?: string | null;
  hint?: string | null;
}): RealityProvider {
  const combined = `${input.hint ?? ""} ${input.fileName ?? ""}`.trim();
  return normalizeRealityProvider(combined);
}
