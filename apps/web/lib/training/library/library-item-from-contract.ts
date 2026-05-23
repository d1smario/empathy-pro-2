import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";

const LIBRARY_FAMILIES = new Set(["aerobic", "strength", "technical", "lifestyle"]);

export function parsePro2BuilderSessionContract(raw: unknown): Pro2BuilderSessionContract | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Pro2BuilderSessionContract;
  const sourceOk = c.source === "builder" || c.source === "virya";
  if (c.version !== 1 || !sourceOk || typeof c.discipline !== "string") return null;
  if (!LIBRARY_FAMILIES.has(c.family)) return null;
  return c;
}

export function denormalizedFieldsFromContract(contract: Pro2BuilderSessionContract): {
  family: Pro2BuilderSessionContract["family"];
  discipline: string;
  durationMinutes: number;
  tssTarget: number;
  sportTags: string[];
} {
  const durationMinutes =
    contract.plannedSessionDurationMinutes ??
    Math.max(1, Math.min(360, Math.round((contract.summary?.durationSec ?? 3600) / 60)));
  const tssTarget = Math.max(0, Math.min(999, Math.round(contract.summary?.tss ?? 0)));
  const discipline = String(contract.discipline ?? "").trim().slice(0, 120);
  const sportTags = discipline ? [discipline] : [];
  return {
    family: contract.family,
    discipline,
    durationMinutes,
    tssTarget,
    sportTags,
  };
}
