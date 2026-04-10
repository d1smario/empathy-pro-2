import type { RealityProvider, RealityProviderDescriptor } from "@/lib/empathy/schemas";

export const REALITY_PROVIDER_REGISTRY: Record<RealityProvider, RealityProviderDescriptor> = {
  garmin: {
    provider: "garmin",
    label: "Garmin",
    supportedDomains: ["training", "sleep", "recovery", "health", "device"],
    supportedSourceKinds: ["file_import", "api_sync"],
    notes: "Attivita, wellness, recovery, segnali device.",
  },
  garmin_connectiq: {
    provider: "garmin_connectiq",
    label: "Garmin ConnectIQ",
    supportedDomains: ["nutrition", "device", "training"],
    supportedSourceKinds: ["api_sync", "file_import"],
    notes: "Payload verso device Garmin/ConnectIQ e future sync app-side.",
  },
  trainingpeaks: {
    provider: "trainingpeaks",
    label: "TrainingPeaks",
    supportedDomains: ["training", "nutrition"],
    supportedSourceKinds: ["file_import", "api_sync"],
    notes: "Programmazione coach e possibili export strutturati.",
  },
  strava: {
    provider: "strava",
    label: "Strava",
    supportedDomains: ["training", "device"],
    supportedSourceKinds: ["file_import", "api_sync"],
  },
  polar: {
    provider: "polar",
    label: "Polar",
    supportedDomains: ["training", "sleep", "recovery", "health", "device"],
    supportedSourceKinds: ["file_import", "api_sync"],
  },
  wahoo: {
    provider: "wahoo",
    label: "Wahoo",
    supportedDomains: ["training", "device"],
    supportedSourceKinds: ["file_import", "api_sync"],
  },
  coros: {
    provider: "coros",
    label: "COROS",
    supportedDomains: ["training", "sleep", "recovery", "device"],
    supportedSourceKinds: ["file_import", "api_sync"],
  },
  suunto: {
    provider: "suunto",
    label: "Suunto",
    supportedDomains: ["training", "sleep", "recovery", "device"],
    supportedSourceKinds: ["file_import", "api_sync"],
    notes: "Export FIT/TCX/GPX; parser condiviso con pipeline canonica.",
  },
  apple_watch: {
    provider: "apple_watch",
    label: "Apple Watch",
    supportedDomains: ["training", "sleep", "recovery", "health", "device"],
    supportedSourceKinds: ["file_import", "api_sync"],
    notes: "Export da app terze → GPX/FIT/CSV standard.",
  },
  zwift: {
    provider: "zwift",
    label: "Zwift",
    supportedDomains: ["training", "device"],
    supportedSourceKinds: ["file_import", "api_sync"],
    notes: "File .fit da log attività.",
  },
  hammerhead: {
    provider: "hammerhead",
    label: "Hammerhead (Karoo)",
    supportedDomains: ["training", "device"],
    supportedSourceKinds: ["file_import", "api_sync"],
    notes: "Export FIT.",
  },
  whoop: {
    provider: "whoop",
    label: "WHOOP",
    supportedDomains: ["sleep", "recovery", "health", "device"],
    supportedSourceKinds: ["api_sync", "file_import"],
    notes: "Principalmente API/recovery; file GPS rari.",
  },
  oura: {
    provider: "oura",
    label: "Oura",
    supportedDomains: ["sleep", "recovery", "health", "device"],
    supportedSourceKinds: ["api_sync"],
  },
  cgm: {
    provider: "cgm",
    label: "CGM",
    supportedDomains: ["health", "nutrition", "recovery", "device"],
    supportedSourceKinds: ["api_sync", "file_import"],
  },
  manual: {
    provider: "manual",
    label: "Manual",
    supportedDomains: ["training", "sleep", "recovery", "nutrition", "health", "device", "other"],
    supportedSourceKinds: ["manual", "derived"],
  },
  unknown: {
    provider: "unknown",
    label: "Unknown",
    supportedDomains: ["other"],
    supportedSourceKinds: ["file_import", "api_sync", "manual", "derived"],
  },
  other: {
    provider: "other",
    label: "Other",
    supportedDomains: ["other"],
    supportedSourceKinds: ["file_import", "api_sync", "manual", "derived"],
  },
};

export function getRealityProviderDescriptor(provider: RealityProvider): RealityProviderDescriptor {
  return REALITY_PROVIDER_REGISTRY[provider] ?? REALITY_PROVIDER_REGISTRY.unknown;
}

export function supportsRealityProviderFlow(input: {
  provider: RealityProvider;
  domain: RealityProviderDescriptor["supportedDomains"][number];
  sourceKind: RealityProviderDescriptor["supportedSourceKinds"][number];
}): boolean {
  const descriptor = getRealityProviderDescriptor(input.provider);
  return descriptor.supportedDomains.includes(input.domain) && descriptor.supportedSourceKinds.includes(input.sourceKind);
}
