/** Slot fissi nella tabella coach (Giorno 1–7); le sedute attive sono `sessionsPerWeek`. */
export const GYM_WEEK_DAY_SLOTS = 7;

export type GymDayModule = {
  dayIndex: number;
  /** Legacy singolo distretto (migrato in `districts`). */
  district?: string;
  districts: string[];
  districtObjective: string;
  exerciseType: string;
  methodology: string;
};

export function gymModuleDistricts(m: GymDayModule): string[] {
  if (Array.isArray(m.districts) && m.districts.length) return m.districts.filter(Boolean);
  const legacy = (m.district ?? "").trim();
  return legacy ? [legacy] : ["Gambe"];
}

export function normalizeGymDayModule(m: GymDayModule): GymDayModule {
  const districts = gymModuleDistricts(m);
  return {
    ...m,
    districts,
    district: districts.join(" + "),
  };
}

export function ensureGymWeekModules(modules: GymDayModule[]): GymDayModule[] {
  const normalized = modules.map(normalizeGymDayModule);
  const out = normalized.slice(0, GYM_WEEK_DAY_SLOTS);
  while (out.length < GYM_WEEK_DAY_SLOTS) {
    const day = out.length + 1;
    out.push(
      normalizeGymDayModule({
        dayIndex: day,
        districts: day % 2 === 0 ? ["Petto"] : ["Gambe"],
        districtObjective: "Forza",
        exerciseType: "Pesi",
        methodology: "Lento controllato",
      }),
    );
  }
  return out.map((m, i) => ({ ...m, dayIndex: i + 1 }));
}

export function activeGymModulesForWeek(modules: GymDayModule[], sessionsPerWeek: number): GymDayModule[] {
  const n = Math.max(1, Math.min(GYM_WEEK_DAY_SLOTS, Math.round(sessionsPerWeek) || 1));
  return ensureGymWeekModules(modules).slice(0, n);
}

export function formatGymDistrictsLabel(m: GymDayModule): string {
  return gymModuleDistricts(m).join(" + ");
}

export function buildGymDayModules(_daysPerWeek?: number): GymDayModule[] {
  return ensureGymWeekModules(
    Array.from({ length: GYM_WEEK_DAY_SLOTS }, (_, idx) => ({
      dayIndex: idx + 1,
      districts: idx % 2 === 0 ? ["Gambe"] : ["Petto"],
      districtObjective: "Forza",
      exerciseType: "Pesi",
      methodology: "Lento controllato",
    })),
  );
}

export function toggleGymDistrict(module: GymDayModule, district: string): GymDayModule {
  const cur = gymModuleDistricts(module);
  const next = cur.includes(district) ? cur.filter((d) => d !== district) : [...cur, district];
  return normalizeGymDayModule({ ...module, districts: next.length ? next : [district] });
}
