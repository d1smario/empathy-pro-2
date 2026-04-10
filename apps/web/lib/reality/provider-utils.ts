import type { RealityProvider } from "@/lib/empathy/schemas";

const PROVIDER_ALIASES: Array<{ provider: RealityProvider; matches: string[] }> = [
  { provider: "garmin", matches: ["garmin", "connect", "forerunner", "fenix", "edge", "vivoactive", "instinct"] },
  { provider: "garmin_connectiq", matches: ["garmin_connectiq", "connectiq", "garmin ciq"] },
  { provider: "trainingpeaks", matches: ["trainingpeaks", "training peaks", "tp_", "tp-"] },
  { provider: "strava", matches: ["strava"] },
  { provider: "polar", matches: ["polar", "flow", "v800", "vantage"] },
  { provider: "wahoo", matches: ["wahoo", "elemnt", "element", "bolt", "roam", "tickr"] },
  { provider: "coros", matches: ["coros", "pace 2", "pace 3", "apex", "vertix"] },
  { provider: "suunto", matches: ["suunto", "sunto", "ambit", "spartan", "peak pro", "race s"] },
  { provider: "apple_watch", matches: ["apple watch", "apple_watch", "apple health", "apple_health", "healthkit", "watchos"] },
  { provider: "zwift", matches: ["zwift"] },
  { provider: "hammerhead", matches: ["hammerhead", "karoo"] },
  { provider: "whoop", matches: ["whoop"] },
  { provider: "oura", matches: ["oura"] },
  { provider: "cgm", matches: ["cgm", "dexcom", "freestyle libre", "libre"] },
  { provider: "manual", matches: ["manual"] },
];

const FILE_VENDOR_RULES: Array<{ provider: RealityProvider; patterns: RegExp[] }> = [
  { provider: "trainingpeaks", patterns: [/trainingpeaks/i, /\btp[_-]/i, /\btp\d+/i] },
  { provider: "garmin", patterns: [/garmin/i, /\bconnect\b/i, /\bedge\b/i, /forerunner/i, /fenix/i, /vivoactive/i, /instinct/i] },
  { provider: "wahoo", patterns: [/wahoo/i, /elemnt/i, /\bbolt\b/i, /\broam\b/i] },
  { provider: "polar", patterns: [/polar/i, /flow_/i, /v800/i, /vantage/i] },
  { provider: "suunto", patterns: [/suunto/i, /sunto/i, /\bambit/i, /\bspartan/i] },
  { provider: "coros", patterns: [/coros/i, /\bpace[_-]?[23]/i, /apex/i, /vertix/i] },
  { provider: "hammerhead", patterns: [/hammerhead/i, /\bkaroo\b/i] },
  { provider: "zwift", patterns: [/zwift/i] },
  { provider: "apple_watch", patterns: [/apple[_\s-]?watch/i, /healthkit/i, /apple[_\s-]?health/i] },
  { provider: "whoop", patterns: [/whoop/i] },
  { provider: "oura", patterns: [/oura/i] },
  { provider: "strava", patterns: [/strava/i] },
];

export function inferTrainingImportVendorFromFileName(fileName: string): RealityProvider | null {
  const name = fileName.trim();
  if (!name) return null;
  for (const rule of FILE_VENDOR_RULES) {
    if (rule.patterns.some((re) => re.test(name))) return rule.provider;
  }
  return null;
}

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
  const rawHint = (input.hint ?? "").trim();
  const hint = rawHint.toLowerCase() === "auto" ? "" : rawHint;

  if (hint) {
    const fromHint = normalizeRealityProvider(hint);
    if (fromHint !== "unknown" && fromHint !== "other") return fromHint;
    if (fromHint === "other") return "other";
  }

  const name = (input.fileName ?? "").trim();
  const inferred = inferTrainingImportVendorFromFileName(name);
  if (inferred) return inferred;

  return normalizeRealityProvider(name);
}
