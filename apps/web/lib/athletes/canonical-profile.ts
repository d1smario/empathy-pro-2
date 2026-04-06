export type CanonicalAthleteRow = {
  id: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  birth_date?: string | null;
  sex?: string | null;
  timezone?: string | null;
  activity_level?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  body_fat_pct?: number | null;
  muscle_mass_kg?: number | null;
  resting_hr_bpm?: number | null;
  max_hr_bpm?: number | null;
  threshold_hr_bpm?: number | null;
  diet_type?: string | null;
  preferred_meal_count?: number | null;
  routine_summary?: string | null;
  routine_config?: Record<string, unknown> | null;
  nutrition_config?: Record<string, unknown> | null;
  supplement_config?: Record<string, unknown> | null;
  training_days_per_week?: number | null;
  training_max_session_minutes?: number | null;
  goals?: string[] | null;
  intolerances?: string[] | null;
  allergies?: string[] | null;
  food_preferences?: string[] | null;
  food_exclusions?: string[] | null;
  supplements?: string[] | null;
  created_at?: string | null;
};

function countList(values: unknown): number {
  return Array.isArray(values) ? values.filter((value) => String(value ?? "").trim() !== "").length : 0;
}

export function athleteCompletenessScore(row: CanonicalAthleteRow): number {
  let score = 0;
  if (row.first_name) score += 3;
  if (row.last_name) score += 3;
  if (row.height_cm != null) score += 2;
  if (row.weight_kg != null) score += 2;
  if (row.body_fat_pct != null) score += 2;
  if (row.muscle_mass_kg != null) score += 2;
  if (row.resting_hr_bpm != null) score += 2;
  if (row.max_hr_bpm != null) score += 2;
  if (row.threshold_hr_bpm != null) score += 1;
  if (row.diet_type) score += 1;
  if (row.training_days_per_week != null) score += 1;
  if (row.training_max_session_minutes != null) score += 1;
  if (row.routine_config) score += 2;
  if (row.nutrition_config) score += 2;
  if (row.supplement_config) score += 1;
  score += countList(row.goals);
  score += countList(row.intolerances);
  score += countList(row.allergies);
  score += countList(row.food_preferences);
  score += countList(row.food_exclusions);
  score += countList(row.supplements);
  return score;
}

export function pickCanonicalAthlete<T extends CanonicalAthleteRow>(rows: T[], preferredAthleteId?: string | null): T | null {
  if (!rows.length) return null;
  if (preferredAthleteId) {
    const preferred = rows.find((row) => row.id === preferredAthleteId);
    if (preferred) return preferred;
  }
  return [...rows].sort((left, right) => {
    const scoreDiff = athleteCompletenessScore(right) - athleteCompletenessScore(left);
    if (scoreDiff !== 0) return scoreDiff;
    const leftTs = left.created_at ? new Date(left.created_at).getTime() : 0;
    const rightTs = right.created_at ? new Date(right.created_at).getTime() : 0;
    return rightTs - leftTs;
  })[0];
}

export function dedupeAthletesByEmail<T extends CanonicalAthleteRow>(rows: T[], preferredAthleteId?: string | null): T[] {
  const byKey = new Map<string, T[]>();
  for (const row of rows) {
    const emailKey = String(row.email ?? "").trim().toLowerCase();
    const key = emailKey || row.id;
    const current = byKey.get(key) ?? [];
    current.push(row);
    byKey.set(key, current);
  }
  return Array.from(byKey.values())
    .map((group) => pickCanonicalAthlete(group, preferredAthleteId))
    .filter((row): row is T => !!row)
    .sort((left, right) => {
      const leftTs = left.created_at ? new Date(left.created_at).getTime() : 0;
      const rightTs = right.created_at ? new Date(right.created_at).getTime() : 0;
      return rightTs - leftTs;
    });
}
