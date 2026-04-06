import type { AthleteProfileRowView } from "@/lib/profile/athlete-profile-strip";

export function mapAthleteProfileRow(row: unknown): AthleteProfileRowView | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : null;
  if (!id) return null;
  const num = (v: unknown): number | null => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
      const parsed = Number(v);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };
  return {
    id,
    first_name: typeof r.first_name === "string" ? r.first_name : null,
    last_name: typeof r.last_name === "string" ? r.last_name : null,
    email: typeof r.email === "string" ? r.email : null,
    birth_date: typeof r.birth_date === "string" ? r.birth_date : null,
    sex: typeof r.sex === "string" ? r.sex : null,
    timezone: typeof r.timezone === "string" ? r.timezone : null,
    activity_level: typeof r.activity_level === "string" ? r.activity_level : null,
    height_cm: num(r.height_cm),
    weight_kg: num(r.weight_kg),
    training_days_per_week: num(r.training_days_per_week),
    training_max_session_minutes: num(r.training_max_session_minutes),
    updated_at: typeof r.updated_at === "string" ? r.updated_at : null,
  };
}
