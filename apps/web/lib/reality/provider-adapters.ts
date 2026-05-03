import type {
  ObservationIngestTags,
  RealityDomain,
  RealityProvider,
  RealitySourceKind,
} from "@/lib/empathy/schemas";
import { buildRealityIngestionEnvelope } from "@/lib/reality/build-ingestion-envelope";
import { supportsRealityProviderFlow } from "@/lib/reality/provider-registry";
import { normalizeRealityProvider } from "@/lib/reality/provider-utils";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type PersistRealityDeviceExportInput = {
  athleteId: string;
  provider?: string | null;
  domain: RealityDomain;
  sourceKind: RealitySourceKind;
  externalRef?: string | null;
  payload?: Record<string, unknown> | null;
  canonicalPreview?: Record<string, unknown> | null;
  rawRefs?: Record<string, unknown> | null;
  status?: "created" | "sent" | "failed";
  importedAt?: string;
  format?: string | null;
  device?: string | null;
  parserEngine?: string | null;
  parserVersion?: string | null;
  qualityStatus?: string | null;
  qualityNote?: string | null;
  channelCoverage?: Record<string, number> | null;
  missingChannels?: string[] | null;
  recommendedInputs?: string[] | null;
  observation?: ObservationIngestTags | null;
};

type RealityCallbackState = {
  athleteId?: string | null;
  domain?: RealityDomain | null;
  sourceKind?: RealitySourceKind | null;
  externalRef?: string | null;
  provider?: string | null;
};

type PersistRealityProviderCallbackInput = {
  athleteId: string;
  provider?: string | null;
  domain?: RealityDomain | null;
  sourceKind?: RealitySourceKind | null;
  externalRef?: string | null;
  callbackPayload: Record<string, unknown>;
  callbackState?: Record<string, unknown> | null;
  queryKeys?: string[];
  hasCode?: boolean;
  hasOauthVerifier?: boolean;
  hasError?: boolean;
};

const DEVICE_SYNC_PROVIDER_VALUES = new Set([
  "garmin",
  "garmin_connectiq",
  "trainingpeaks",
  "strava",
  "wahoo",
  "coros",
  "polar",
  "suunto",
  "apple_watch",
  "zwift",
  "hammerhead",
  "whoop",
  "oura",
  "cgm",
  "other",
]);

function toStoredDeviceSyncProvider(provider: RealityProvider): string {
  return DEVICE_SYNC_PROVIDER_VALUES.has(provider) ? provider : "other";
}

function asDomain(value: unknown): RealityDomain | null {
  return value === "training" ||
    value === "sleep" ||
    value === "recovery" ||
    value === "nutrition" ||
    value === "health" ||
    value === "device" ||
    value === "other"
    ? value
    : null;
}

function asSourceKind(value: unknown): RealitySourceKind | null {
  return value === "file_import" || value === "api_sync" || value === "manual" || value === "derived"
    ? value
    : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function decodeBase64Url(raw: string): string | null {
  try {
    const normalized = raw.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return Buffer.from(padded, "base64").toString("utf8");
  } catch {
    return null;
  }
}

function parseRawStateObject(rawState: string): Record<string, unknown> | null {
  const candidates = [rawState, decodeBase64Url(rawState)].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      const record = asRecord(parsed);
      if (record) return record;
    } catch {
      continue;
    }
  }

  return null;
}

function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function assertRealityProviderFlow(input: {
  provider: RealityProvider;
  domain: RealityDomain;
  sourceKind: RealitySourceKind;
}): void {
  if (!supportsRealityProviderFlow(input)) {
    throw new Error(
      `Provider ${input.provider} is not enabled for ${input.domain} ${input.sourceKind} flows`,
    );
  }
}

export async function persistRealityDeviceExport(input: PersistRealityDeviceExportInput) {
  const canonicalProvider = normalizeRealityProvider(input.provider);
  assertRealityProviderFlow({
    provider: canonicalProvider,
    domain: input.domain,
    sourceKind: input.sourceKind,
  });

  const ingestion = buildRealityIngestionEnvelope({
    athleteId: input.athleteId,
    domain: input.domain,
    sourceKind: input.sourceKind,
    provider: canonicalProvider,
    importedAt: input.importedAt,
    format: input.format ?? null,
    device: input.device ?? null,
    externalId: input.externalRef ?? null,
    parserEngine: input.parserEngine ?? null,
    parserVersion: input.parserVersion ?? null,
    qualityStatus: input.qualityStatus ?? null,
    qualityNote: input.qualityNote ?? null,
    channelCoverage: input.channelCoverage ?? null,
    missingChannels: input.missingChannels ?? null,
    recommendedInputs: input.recommendedInputs ?? null,
    canonicalPreview: input.canonicalPreview ?? null,
    rawRefs: input.rawRefs ?? null,
    observation: input.observation,
  });

  const supabase = createServerSupabaseClient();
  const insertRow = {
    athlete_id: input.athleteId,
    provider: toStoredDeviceSyncProvider(canonicalProvider),
    external_ref: input.externalRef ?? null,
    status: input.status ?? "created",
    sync_kind: "pull" as const,
    external_event_id: input.externalRef ?? null,
    payload: {
      adapterKey: `${canonicalProvider}:${input.domain}:${input.sourceKind}`,
      realityIngestion: ingestion,
      sourcePayload: input.payload ?? null,
    },
  };

  const { data, error } = await supabase
    .from("device_sync_exports")
    .insert(insertRow)
    .select("id, athlete_id, provider, status, external_ref, created_at, updated_at, payload")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    record: data,
    ingestion,
    provider: canonicalProvider,
  };
}

export async function persistRealityProviderCallback(input: PersistRealityProviderCallbackInput) {
  const qualityStatus =
    input.hasError ? "LOW_COVERAGE" : input.hasCode || input.hasOauthVerifier ? "OK" : "SPARSE";
  const qualityNote =
    qualityStatus === "OK"
      ? "Provider callback completo."
      : qualityStatus === "SPARSE"
        ? "Provider callback ricevuto ma con segnali di autorizzazione parziali."
        : "Provider callback con errore o autorizzazione incompleta.";

  return persistRealityDeviceExport({
    athleteId: input.athleteId,
    provider: input.provider ?? "other",
    domain: input.domain ?? "device",
    sourceKind: input.sourceKind ?? "api_sync",
    externalRef: input.externalRef ?? null,
    payload: {
      callback: input.callbackPayload,
      callbackState: input.callbackState ?? null,
    },
    canonicalPreview: {
      callback_received: true,
      has_code: Boolean(input.hasCode),
      has_oauth_verifier: Boolean(input.hasOauthVerifier),
      has_error: Boolean(input.hasError),
    },
    rawRefs: {
      query_keys: input.queryKeys ?? [],
    },
    status: input.hasError ? "failed" : "created",
    qualityStatus,
    qualityNote,
    channelCoverage: {
      callback_state: input.callbackState ? 100 : 0,
      authorization_code: input.hasCode ? 100 : 0,
      oauth_verifier: input.hasOauthVerifier ? 100 : 0,
      provider_error: input.hasError ? 100 : 0,
    },
    missingChannels: [
      !input.callbackState ? "callback_state" : null,
      !input.hasCode && !input.hasOauthVerifier ? "authorization_proof" : null,
    ].filter((value): value is string => Boolean(value)),
    recommendedInputs:
      input.hasError || (!input.hasCode && !input.hasOauthVerifier)
        ? ["provider_authorization_code_or_verifier"]
        : [],
  });
}

export function parseRealityCallbackState(rawState?: string | null): RealityCallbackState {
  const state = String(rawState ?? "").trim();
  if (!state) return {};

  const record = parseRawStateObject(state);
  if (!record) {
    // OAuth2 `state` can be a plain nonce/string: for Garmin we accept direct athlete UUID.
    if (looksLikeUuid(state)) {
      return { athleteId: state };
    }
    return {};
  }

  return {
    athleteId:
      typeof record.athleteId === "string"
        ? record.athleteId
        : typeof record.athlete_id === "string"
          ? record.athlete_id
          : null,
    domain: asDomain(record.domain) ?? asDomain(record.realityDomain) ?? asDomain(record.reality_domain),
    sourceKind:
      asSourceKind(record.sourceKind) ??
      asSourceKind(record.source_kind) ??
      asSourceKind(record.realitySourceKind) ??
      asSourceKind(record.reality_source_kind),
    externalRef:
      typeof record.externalRef === "string"
        ? record.externalRef
        : typeof record.external_ref === "string"
          ? record.external_ref
          : null,
    provider:
      typeof record.provider === "string"
        ? record.provider
        : typeof record.realityProvider === "string"
          ? record.realityProvider
          : null,
  };
}
