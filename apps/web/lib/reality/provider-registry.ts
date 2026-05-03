import type { ObservationDomain, RealityProvider, RealityProviderDescriptor } from "@/lib/empathy/schemas";

const SPORT_GPS_CORE = [
  "exertion_mechanical_output",
  "exertion_physiological_load",
  "positioning_navigation",
] as const satisfies readonly ObservationDomain[];

const SPORT_GPS_SLEEP_WELLNESS = [
  ...SPORT_GPS_CORE,
  "sleep_timing_duration",
  "sleep_staging_microstructure",
  "autonomic_recovery_state",
] as const satisfies readonly ObservationDomain[];

export const REALITY_PROVIDER_REGISTRY: Record<RealityProvider, RealityProviderDescriptor> = {
  garmin: {
    provider: "garmin",
    label: "Garmin",
    supportedDomains: ["training", "sleep", "recovery", "health", "device"],
    supportedSourceKinds: ["file_import", "api_sync"],
    typicalObservationDomains: [...SPORT_GPS_SLEEP_WELLNESS],
    notes: "Attivita, wellness, recovery, segnali device.",
  },
  garmin_connectiq: {
    provider: "garmin_connectiq",
    label: "Garmin ConnectIQ",
    supportedDomains: ["nutrition", "device", "training"],
    supportedSourceKinds: ["api_sync", "file_import"],
    typicalObservationDomains: [
      ...SPORT_GPS_CORE,
      "nutrition_energy_balance_device",
      "subjective_perception",
    ],
    notes: "Payload verso device Garmin/ConnectIQ e future sync app-side.",
  },
  trainingpeaks: {
    provider: "trainingpeaks",
    label: "TrainingPeaks",
    supportedDomains: ["training", "nutrition"],
    supportedSourceKinds: ["file_import", "api_sync"],
    typicalObservationDomains: [...SPORT_GPS_CORE, "nutrition_energy_balance_device"],
    notes: "Programmazione coach e possibili export strutturati.",
  },
  strava: {
    provider: "strava",
    label: "Strava",
    supportedDomains: ["training", "device"],
    supportedSourceKinds: ["file_import", "api_sync"],
    typicalObservationDomains: [...SPORT_GPS_CORE],
  },
  polar: {
    provider: "polar",
    label: "Polar",
    supportedDomains: ["training", "sleep", "recovery", "health", "device"],
    supportedSourceKinds: ["file_import", "api_sync"],
    typicalObservationDomains: [...SPORT_GPS_SLEEP_WELLNESS, "respiratory_mechanics"],
  },
  wahoo: {
    provider: "wahoo",
    label: "Wahoo",
    supportedDomains: ["training", "device"],
    supportedSourceKinds: ["file_import", "api_sync"],
    typicalObservationDomains: [...SPORT_GPS_CORE],
  },
  coros: {
    provider: "coros",
    label: "COROS",
    supportedDomains: ["training", "sleep", "recovery", "device"],
    supportedSourceKinds: ["file_import", "api_sync"],
    typicalObservationDomains: [...SPORT_GPS_SLEEP_WELLNESS],
  },
  suunto: {
    provider: "suunto",
    label: "Suunto",
    supportedDomains: ["training", "sleep", "recovery", "device"],
    supportedSourceKinds: ["file_import", "api_sync"],
    typicalObservationDomains: [...SPORT_GPS_SLEEP_WELLNESS],
    notes: "Export FIT/TCX/GPX; parser condiviso con pipeline canonica.",
  },
  apple_watch: {
    provider: "apple_watch",
    label: "Apple Watch",
    supportedDomains: ["training", "sleep", "recovery", "health", "device"],
    supportedSourceKinds: ["file_import", "api_sync"],
    typicalObservationDomains: [...SPORT_GPS_SLEEP_WELLNESS, "autonomic_cardiac_rhythm"],
    notes: "Export da app terze → GPX/FIT/CSV standard.",
  },
  zwift: {
    provider: "zwift",
    label: "Zwift",
    supportedDomains: ["training", "device"],
    supportedSourceKinds: ["file_import", "api_sync"],
    typicalObservationDomains: ["exertion_mechanical_output", "exertion_physiological_load"],
    notes: "File .fit da log attività.",
  },
  hammerhead: {
    provider: "hammerhead",
    label: "Hammerhead (Karoo)",
    supportedDomains: ["training", "device"],
    supportedSourceKinds: ["file_import", "api_sync"],
    typicalObservationDomains: [...SPORT_GPS_CORE],
    notes: "Export FIT.",
  },
  whoop: {
    provider: "whoop",
    label: "WHOOP",
    supportedDomains: ["sleep", "recovery", "health", "device", "training"],
    supportedSourceKinds: ["api_sync", "file_import"],
    typicalObservationDomains: [
      "sleep_timing_duration",
      "sleep_staging_microstructure",
      "sleep_respiration_oxygenation",
      "autonomic_recovery_state",
      "exertion_physiological_load",
    ],
    notes: "Principalmente API/recovery; file GPS rari.",
  },
  oura: {
    provider: "oura",
    label: "Oura",
    supportedDomains: ["sleep", "recovery", "health", "device"],
    supportedSourceKinds: ["api_sync"],
    typicalObservationDomains: [
      "sleep_timing_duration",
      "sleep_staging_microstructure",
      "thermoregulation",
      "autonomic_recovery_state",
    ],
  },
  cgm: {
    provider: "cgm",
    label: "CGM",
    supportedDomains: ["health", "nutrition", "recovery", "device"],
    supportedSourceKinds: ["api_sync", "file_import"],
    typicalObservationDomains: ["glucose_continuous", "glucose_discrete"],
  },
  manual: {
    provider: "manual",
    label: "Manual",
    supportedDomains: ["training", "sleep", "recovery", "nutrition", "health", "device", "other"],
    supportedSourceKinds: ["manual", "derived"],
    typicalObservationDomains: ["subjective_perception", "other"],
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
    typicalObservationDomains: ["other"],
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
