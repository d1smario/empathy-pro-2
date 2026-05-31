import type { MemorySlice } from "@/lib/memory/athlete-memory-slice-types";

const SLICES: MemorySlice[] = ["full", "training", "nutrition", "dashboard", "bioenergetics"];

/** Query `slice=` su GET /api/athlete-memory (default `full`). */
export function parseMemorySliceParam(raw: string | null | undefined): MemorySlice {
  const s = (raw ?? "full").trim().toLowerCase();
  return SLICES.includes(s as MemorySlice) ? (s as MemorySlice) : "full";
}
