import { createHash } from "node:crypto";
import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";

/** Hash deterministico family + shape blocchi — chiave archetype per memoria atleta. */
export function workoutArchetypeKeyFromContract(contract: Pro2BuilderSessionContract): string {
  const blockSig = (contract.blocks ?? [])
    .map((b) => `${b.kind ?? "steady"}:${String(b.label ?? "").trim().slice(0, 40)}:${Math.round(Number(b.durationMinutes ?? 0) || 0)}`)
    .join(";");
  const raw = [contract.family, contract.discipline ?? "", blockSig].join("|");
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}
