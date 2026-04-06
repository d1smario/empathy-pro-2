/**
 * Device, lab import, BIA — normalized ingest (V1 reality layer concepts).
 */
import type { RealityIngestionRecord, RealityIngestionStatus } from "@empathy/contracts";

export const DOMAIN = "@empathy/domain-reality" as const;
export const DOMAIN_TITLE = "Reality ingest";
export const DOMAIN_SUMMARY =
  "Envelope e record di ingestione (device/lab/file) — RealityIngestion* da @empathy/contracts.";

export type { RealityIngestionRecord };

export function isRealityIngestionTerminal(status: RealityIngestionStatus): boolean {
  return status === "done" || status === "error" || status === "failed";
}
