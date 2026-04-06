/**
 * Vista compatta da `athlete_profiles` per card Fase 5 (Pro 2 shell).
 */
export type AthleteProfileRowView = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  birth_date: string | null;
  sex: string | null;
  timezone: string | null;
  activity_level: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  training_days_per_week: number | null;
  training_max_session_minutes: number | null;
  updated_at: string | null;
};

export function formatAthleteProfileStrip(p: AthleteProfileRowView | null): string {
  if (!p) return "";
  const name = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
  const bits: string[] = [];
  if (name) bits.push(name);
  if (p.email) bits.push(p.email);
  if (p.birth_date) bits.push(`n. ${p.birth_date}`);
  if (p.sex) bits.push(p.sex);
  if (p.timezone) bits.push(p.timezone);
  if (p.activity_level) bits.push(p.activity_level);
  if (p.height_cm != null) bits.push(`${p.height_cm} cm`);
  if (p.weight_kg != null) bits.push(`${p.weight_kg} kg`);
  if (p.training_days_per_week != null) bits.push(`${p.training_days_per_week} gg/sett.`);
  if (p.training_max_session_minutes != null) bits.push(`max ${p.training_max_session_minutes} min/sessione`);
  return bits.join(" · ") || "Profilo atleta collegato.";
}
