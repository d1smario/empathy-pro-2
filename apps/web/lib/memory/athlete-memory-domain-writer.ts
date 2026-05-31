import { createServerSupabaseClient } from "@/lib/supabase-server";
import { athleteIdByNormalizedEmail } from "@/lib/auth/bootstrap-app-user-profile";
import { resolveAthleteMemorySlice } from "@/lib/memory/athlete-memory-resolver";
import { invalidateAthleteMemoryCache } from "@/lib/memory/athlete-memory-cache";
import type { MemorySlice } from "@/lib/memory/athlete-memory-slice-types";

type ProfileUpsertPatch = {
  domain: "profile";
  action: "upsert";
  athleteId?: string | null;
  payload: Record<string, unknown>;
};

type ProfileUpdatePatch = {
  domain: "profile";
  action: "update";
  athleteId: string;
  payload: Record<string, unknown>;
};

type NutritionConfigPatch = {
  domain: "nutrition";
  action: "config";
  athleteId: string;
  nutritionConfig?: Record<string, unknown>;
  routineConfig?: Record<string, unknown>;
};

type HealthPanelPatch = {
  domain: "health";
  action: "panel";
  athleteId: string;
  panelType: string;
  sampleDate?: string | null;
  values?: Record<string, unknown>;
  flags?: string[] | null;
  source?: string | null;
};

type EvidenceRowsPatch = {
  domain: "evidence";
  action: "insert_rows";
  athleteId: string;
  rows: Array<Record<string, unknown>>;
};

export type AthleteMemoryDomainPatch =
  | ProfileUpsertPatch
  | ProfileUpdatePatch
  | NutritionConfigPatch
  | HealthPanelPatch
  | EvidenceRowsPatch;

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length > 0 ? email : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim() !== "").map((item) => item.trim())
    : [];
}

function normalizeEvidenceRow(row: Record<string, unknown>, athleteId: string) {
  const payload = asRecord(row.payload) ?? {};
  return {
    ...row,
    athlete_id: row.athlete_id ?? athleteId,
    source: asString(row.source) ?? asString(payload.source) ?? "unknown",
    query: asString(row.query) ?? asString(payload.query),
    title: asString(row.title) ?? asString(payload.title),
    summary: asString(row.summary) ?? asString(payload.summary),
    url: asString(row.url) ?? asString(payload.url),
    relevance_score: asFiniteNumber(row.relevance_score) ?? asFiniteNumber(payload.relevanceScore),
    payload: {
      ...payload,
      module: asString(row.module) ?? asString(payload.module),
      domain: asString(row.domain) ?? asString(payload.domain),
      adaptationTarget: asString(row.adaptationTarget) ?? asString(payload.adaptationTarget),
      sessionDate: asString(row.sessionDate) ?? asString(payload.sessionDate),
      plannedWorkoutId: asString(row.plannedWorkoutId) ?? asString(payload.plannedWorkoutId),
      mechanismTags: asStringArray(row.mechanismTags).length ? asStringArray(row.mechanismTags) : asStringArray(payload.mechanismTags),
      nutritionTags: asStringArray(row.nutritionTags).length ? asStringArray(row.nutritionTags) : asStringArray(payload.nutritionTags),
      recoveryTags: asStringArray(row.recoveryTags).length ? asStringArray(row.recoveryTags) : asStringArray(payload.recoveryTags),
      evidenceClass: asString(row.evidenceClass) ?? asString(payload.evidenceClass),
      confidence: asFiniteNumber(row.confidence) ?? asFiniteNumber(payload.confidence),
    },
  };
}

async function freshAthleteMemoryAfterPatch(athleteId: string, slice: MemorySlice) {
  return resolveAthleteMemorySlice(athleteId, { slice, skipCache: true });
}

export async function writeAthleteMemoryDomainPatch(patch: AthleteMemoryDomainPatch) {
  const supabase = createServerSupabaseClient();

  switch (patch.domain) {
    case "profile": {
      if (patch.action === "upsert") {
        const email = normalizeEmail(patch.payload.email);
        if (email) {
          const canonicalId = await athleteIdByNormalizedEmail(supabase, email);
          if (canonicalId) {
            const { error: updateError } = await supabase
              .from("athlete_profiles")
              .update(patch.payload)
              .eq("id", canonicalId);
            if (updateError) throw new Error(updateError.message);
            invalidateAthleteMemoryCache(canonicalId);
            return {
              athleteId: canonicalId,
              status: "updated_existing" as const,
              athleteMemory: await freshAthleteMemoryAfterPatch(canonicalId, "dashboard"),
            };
          }
        }

        const { data, error } = await supabase
          .from("athlete_profiles")
          .insert(patch.payload)
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        const athleteId = data?.id ?? null;
        if (athleteId) invalidateAthleteMemoryCache(athleteId);
        return {
          athleteId,
          status: "created" as const,
          athleteMemory: athleteId ? await freshAthleteMemoryAfterPatch(athleteId, "dashboard") : null,
        };
      }

      const { error } = await supabase.from("athlete_profiles").update(patch.payload).eq("id", patch.athleteId);
      if (error) throw new Error(error.message);
      invalidateAthleteMemoryCache(patch.athleteId);
      return {
        athleteId: patch.athleteId,
        status: "updated" as const,
        athleteMemory: await freshAthleteMemoryAfterPatch(patch.athleteId, "dashboard"),
      };
    }

    case "nutrition": {
      const { error } = await supabase
        .from("athlete_profiles")
        .update({
          nutrition_config: patch.nutritionConfig ?? {},
          routine_config: patch.routineConfig ?? {},
        })
        .eq("id", patch.athleteId);
      if (error) throw new Error(error.message);
      invalidateAthleteMemoryCache(patch.athleteId);
      return {
        athleteId: patch.athleteId,
        status: "ok" as const,
        athleteMemory: await freshAthleteMemoryAfterPatch(patch.athleteId, "nutrition"),
      };
    }

    case "health": {
      const { error } = await supabase.from("biomarker_panels").insert({
        athlete_id: patch.athleteId,
        type: patch.panelType,
        sample_date: patch.sampleDate ?? null,
        values: patch.values ?? {},
        flags: patch.flags ?? null,
        source: patch.source ?? null,
      });
      if (error) throw new Error(error.message);
      invalidateAthleteMemoryCache(patch.athleteId);
      return {
        athleteId: patch.athleteId,
        status: "ok" as const,
        athleteMemory: await freshAthleteMemoryAfterPatch(patch.athleteId, "nutrition"),
      };
    }

    case "evidence": {
      const rows = patch.rows.map((row) => normalizeEvidenceRow(row, patch.athleteId));
      const { error: insertErr } = await supabase.from("knowledge_evidence_hits").insert(rows);
      if (insertErr) throw new Error(insertErr.message);
      invalidateAthleteMemoryCache(patch.athleteId);
      const athleteMemory = await freshAthleteMemoryAfterPatch(patch.athleteId, "dashboard");
      return {
        athleteId: patch.athleteId,
        status: "ok" as const,
        rows: athleteMemory.evidenceMemory.items,
        athleteMemory,
      };
    }
  }
}
