import "server-only";

import { ensureWahooAccessToken } from "@/lib/integrations/wahoo-access-token";
import { wahooCloudRequestForm, wahooCloudRequestGet, wahooPlanFileDataUrlFromJson } from "@/lib/integrations/wahoo-cloud-api";
import type { WahooJsonResult } from "@/lib/integrations/wahoo-cloud-api";

export async function wahooListPlans(
  athleteId: string,
  externalId?: string,
): Promise<WahooJsonResult<unknown>> {
  return wahooCloudRequestGet({
    athleteId,
    path: "/v1/plans",
    query: externalId ? { external_id: externalId } : undefined,
  });
}

export async function wahooGetPlan(athleteId: string, planId: number): Promise<WahooJsonResult<unknown>> {
  return wahooCloudRequestGet({ athleteId, path: `/v1/plans/${planId}` });
}

export async function wahooCreatePlan(input: {
  athleteId: string;
  externalId: string;
  providerUpdatedAtIso: string;
  planFileJson: unknown;
  filename?: string;
}): Promise<WahooJsonResult<unknown>> {
  const fields: Record<string, string> = {
    "plan[file]": wahooPlanFileDataUrlFromJson(input.planFileJson),
    "plan[external_id]": input.externalId,
    "plan[provider_updated_at]": input.providerUpdatedAtIso,
  };
  if (input.filename) fields["plan[filename]"] = input.filename;
  return wahooCloudRequestForm({ athleteId: input.athleteId, method: "POST", path: "/v1/plans", fields });
}

export async function wahooUpdatePlan(input: {
  athleteId: string;
  planId: number;
  providerUpdatedAtIso: string;
  planFileJson: unknown;
  filename?: string;
}): Promise<WahooJsonResult<unknown>> {
  const fields: Record<string, string> = {
    "plan[file]": wahooPlanFileDataUrlFromJson(input.planFileJson),
    "plan[provider_updated_at]": input.providerUpdatedAtIso,
  };
  if (input.filename) fields["plan[filename]"] = input.filename;
  return wahooCloudRequestForm({
    athleteId: input.athleteId,
    method: "PUT",
    path: `/v1/plans/${input.planId}`,
    fields,
  });
}

export async function wahooDeletePlan(athleteId: string, planId: number): Promise<WahooJsonResult<unknown>> {
  return wahooCloudRequestForm({ athleteId, method: "DELETE", path: `/v1/plans/${planId}` });
}

export async function wahooListWorkouts(
  athleteId: string,
  page?: number,
  perPage?: number,
): Promise<WahooJsonResult<unknown>> {
  return wahooCloudRequestGet({
    athleteId,
    path: "/v1/workouts",
    query: {
      page: page ?? 1,
      per_page: perPage ?? 30,
    },
  });
}

export async function wahooGetWorkout(athleteId: string, workoutId: number): Promise<WahooJsonResult<unknown>> {
  return wahooCloudRequestGet({ athleteId, path: `/v1/workouts/${workoutId}` });
}

export async function wahooGetWorkoutPlans(
  athleteId: string,
  workoutId: number,
): Promise<WahooJsonResult<unknown>> {
  return wahooCloudRequestGet({ athleteId, path: `/v1/workouts/${workoutId}/plans` });
}

export async function wahooCreateWorkout(input: {
  athleteId: string;
  name: string;
  workoutToken: string;
  workoutTypeId: number;
  startsIso: string;
  minutes: number;
  dayCode?: number;
  planId?: number;
  routeId?: number;
}): Promise<WahooJsonResult<unknown>> {
  const fields: Record<string, string> = {
    "workout[name]": input.name,
    "workout[workout_token]": input.workoutToken,
    "workout[workout_type_id]": String(input.workoutTypeId),
    "workout[starts]": input.startsIso,
    "workout[minutes]": String(input.minutes),
  };
  if (input.dayCode != null) fields["workout[day_code]"] = String(input.dayCode);
  if (input.planId != null) fields["workout[plan_id]"] = String(input.planId);
  if (input.routeId != null) fields["workout[route_id]"] = String(input.routeId);
  return wahooCloudRequestForm({ athleteId: input.athleteId, method: "POST", path: "/v1/workouts", fields });
}

/** Aggiornamento parziale: passa solo i campi presenti in `patch`. */
export async function wahooUpdateWorkout(input: {
  athleteId: string;
  workoutId: number;
  patch: {
    name?: string;
    workout_token?: string;
    workout_type_id?: number;
    starts?: string;
    day_code?: number;
    minutes?: number;
    plan_id?: number | null;
    route_id?: number | null;
  };
}): Promise<WahooJsonResult<unknown>> {
  const fields: Record<string, string> = {};
  const p = input.patch;
  if (p.name !== undefined) fields["workout[name]"] = p.name;
  if (p.workout_token !== undefined) fields["workout[workout_token]"] = p.workout_token;
  if (p.workout_type_id !== undefined) fields["workout[workout_type_id]"] = String(p.workout_type_id);
  if (p.starts !== undefined) fields["workout[starts]"] = p.starts;
  if (p.day_code !== undefined) fields["workout[day_code]"] = String(p.day_code);
  if (p.minutes !== undefined) fields["workout[minutes]"] = String(p.minutes);
  if (p.plan_id !== undefined && p.plan_id !== null) fields["workout[plan_id]"] = String(p.plan_id);
  if (p.route_id !== undefined && p.route_id !== null) fields["workout[route_id]"] = String(p.route_id);
  if (Object.keys(fields).length === 0) {
    return { ok: false, status: 400, error: "wahoo_update_workout_empty_patch" };
  }
  return wahooCloudRequestForm({
    athleteId: input.athleteId,
    method: "PUT",
    path: `/v1/workouts/${input.workoutId}`,
    fields,
  });
}

export async function wahooDeleteWorkout(athleteId: string, workoutId: number): Promise<WahooJsonResult<unknown>> {
  return wahooCloudRequestForm({ athleteId, method: "DELETE", path: `/v1/workouts/${workoutId}` });
}

/** Scarica il JSON del plan da `file.url` (Bearer, come da CDN Wahoo). */
export async function wahooFetchPlanFileContent(
  athleteId: string,
  planId: number,
): Promise<WahooJsonResult<unknown>> {
  const g = await wahooGetPlan(athleteId, planId);
  if (!g.ok) return g;
  const row = g.data as Record<string, unknown>;
  const file = row.file as Record<string, unknown> | undefined;
  const url = typeof file?.url === "string" ? file.url.trim() : "";
  if (!url) return { ok: false, status: 404, error: "wahoo_plan_file_url_missing" };

  const token = await ensureWahooAccessToken(athleteId);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, error: `wahoo_plan_file_http_${res.status}`, bodySnippet: text.slice(0, 400) };
  }
  try {
    return { ok: true, status: res.status, data: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, status: res.status, error: "wahoo_plan_file_not_json", bodySnippet: text.slice(0, 400) };
  }
}
