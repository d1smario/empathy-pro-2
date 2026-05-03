import type {
  ObservationDomain,
  ObservationIngestTags,
  ObservationModality,
  RealityDomain,
  RealityProvider,
  RealitySourceKind,
} from "@/lib/empathy/schemas";
import { getRealityProviderDescriptor } from "@/lib/reality/provider-registry";

function augmentDomainsFromChannelCoverage(
  domains: ObservationDomain[],
  coverage: Record<string, number> | null,
): ObservationDomain[] {
  const out = [...domains];
  const add = (d: ObservationDomain) => {
    if (!out.includes(d)) out.push(d);
  };
  const c = coverage ?? {};
  if ((c.temperature ?? 0) > 0) add("thermoregulation");
  if ((c.altitude ?? 0) > 0) add("environmental_exposure");
  return out;
}

function inferModalities(domain: RealityDomain, sourceKind: RealitySourceKind): ObservationModality[] | null {
  if (sourceKind === "file_import" && domain === "training") {
    return ["session_aggregate", "fixed_interval_series"];
  }
  if (sourceKind === "api_sync" && domain === "sleep") {
    return ["daily_aggregate", "epoch_summary"];
  }
  if (sourceKind === "api_sync" && (domain === "recovery" || domain === "health")) {
    return ["daily_aggregate", "continuous_stream"];
  }
  if (sourceKind === "api_sync" && domain === "nutrition") {
    return ["daily_aggregate", "event_instantaneous"];
  }
  if (sourceKind === "api_sync") {
    return ["daily_aggregate"];
  }
  if (sourceKind === "manual") {
    return ["event_instantaneous"];
  }
  if (sourceKind === "derived") {
    return ["session_aggregate"];
  }
  if (domain === "training") {
    return ["session_aggregate"];
  }
  return null;
}

const GENERIC_TRAINING_FILE_DOMAINS: ObservationDomain[] = [
  "exertion_mechanical_output",
  "exertion_physiological_load",
  "positioning_navigation",
];

/**
 * Tag `observation` di default per envelope ingest (registry + domain/source + copertura canali).
 * `observation` esplicito su input envelope ha priorità (vedi `buildRealityIngestionEnvelope`).
 */
export function defaultObservationIngestTags(input: {
  provider: RealityProvider;
  domain: RealityDomain;
  sourceKind: RealitySourceKind;
  channelCoverage?: Record<string, number> | null;
}): ObservationIngestTags | null {
  const desc = getRealityProviderDescriptor(input.provider);
  let domains = [...(desc.typicalObservationDomains ?? [])];
  domains = augmentDomainsFromChannelCoverage(domains, input.channelCoverage ?? null);

  if (
    domains.length === 0 &&
    input.domain === "training" &&
    (input.sourceKind === "file_import" || input.sourceKind === "api_sync")
  ) {
    domains = [...GENERIC_TRAINING_FILE_DOMAINS];
    domains = augmentDomainsFromChannelCoverage(domains, input.channelCoverage ?? null);
  }

  const modalities = inferModalities(input.domain, input.sourceKind);
  if (domains.length === 0 && modalities && modalities.length > 0) {
    domains.push("other");
  }
  if (domains.length === 0 && (!modalities || modalities.length === 0)) return null;

  return {
    domains,
    modalities: modalities && modalities.length > 0 ? modalities : null,
    contextRefs: null,
  };
}
