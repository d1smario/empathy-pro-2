/** Vendor hint for imported files (V1 `lib/reality/provider-utils` parity, string tags). */

const PROVIDER_ALIASES: Array<{ tag: string; matches: string[] }> = [
  { tag: "garmin", matches: ["garmin"] },
  { tag: "garmin_connectiq", matches: ["garmin_connectiq", "connectiq", "garmin ciq"] },
  { tag: "trainingpeaks", matches: ["trainingpeaks", "tp_"] },
  { tag: "strava", matches: ["strava"] },
  { tag: "polar", matches: ["polar"] },
  { tag: "wahoo", matches: ["wahoo"] },
  { tag: "coros", matches: ["coros"] },
  { tag: "whoop", matches: ["whoop"] },
  { tag: "oura", matches: ["oura"] },
  { tag: "cgm", matches: ["cgm", "dexcom", "freestyle libre", "libre"] },
  { tag: "manual", matches: ["manual"] },
];

export function normalizeDeviceHint(provider?: string | null): string {
  const value = String(provider ?? "").trim().toLowerCase();
  if (!value) return "unknown";
  for (const candidate of PROVIDER_ALIASES) {
    if (candidate.matches.some((match) => value.includes(match))) {
      return candidate.tag;
    }
  }
  if (value === "unknown") return "unknown";
  return "other";
}

export function detectRealityProvider(input: { fileName?: string | null; hint?: string | null }): string {
  const combined = `${input.hint ?? ""} ${input.fileName ?? ""}`.trim();
  return normalizeDeviceHint(combined);
}
