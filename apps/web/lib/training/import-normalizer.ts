import { detectRealityProvider } from "@/lib/training/provider-detect";

type ParsedImportLike = {
  format: string;
  durationMinutes: number;
  tss: number;
  kcal: number | null;
  kj: number | null;
  traceSummary: Record<string, unknown>;
};

type NormalizeInput = {
  parsed: ParsedImportLike;
  fileName: string;
  deviceHint?: string;
};

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asString(v: unknown): string | null {
  if (typeof v === "string" && v.trim() !== "") return v.trim();
  return null;
}

function toRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function deepPickNumber(root: unknown, keys: string[]): number | null {
  const wanted = new Set(keys.map((k) => k.toLowerCase()));
  const queue: unknown[] = [root];
  const seen = new Set<unknown>();
  while (queue.length > 0) {
    const node = queue.shift();
    if (!node || seen.has(node)) continue;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const item of node) queue.push(item);
      continue;
    }
    const rec = toRecord(node);
    if (!rec) continue;
    for (const [k, value] of Object.entries(rec)) {
      if (wanted.has(k.toLowerCase())) {
        const n = asNumber(value);
        if (n != null) return n;
      }
      if (value && typeof value === "object") queue.push(value);
    }
  }
  return null;
}

function deepPickString(root: unknown, keys: string[]): string | null {
  const wanted = new Set(keys.map((k) => k.toLowerCase()));
  const queue: unknown[] = [root];
  const seen = new Set<unknown>();
  while (queue.length > 0) {
    const node = queue.shift();
    if (!node || seen.has(node)) continue;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const item of node) queue.push(item);
      continue;
    }
    const rec = toRecord(node);
    if (!rec) continue;
    for (const [k, value] of Object.entries(rec)) {
      if (wanted.has(k.toLowerCase())) {
        const s = asString(value);
        if (s != null) return s;
      }
      if (value && typeof value === "object") queue.push(value);
    }
  }
  return null;
}

export function normalizeImportedTraceSummary(input: NormalizeInput): {
  vendor: string;
  traceSummary: Record<string, unknown>;
} {
  const vendor = detectRealityProvider({
    fileName: input.fileName,
    hint: input.deviceHint,
  });
  const raw = input.parsed.traceSummary ?? {};

  const distanceKm =
    deepPickNumber(raw, ["distance_km", "distancekm", "distance", "total_distance"]) ??
    (() => {
      const meters = deepPickNumber(raw, ["distance_m", "distancemeters", "total_distance_m"]);
      return meters != null ? meters / 1000 : null;
    })();

  const powerAvgW =
    deepPickNumber(raw, [
      "power_avg_w",
      "power_avg",
      "avg_power",
      "average_power",
      "weighted_avg_power",
      "mean_power",
    ]) ?? null;
  const hrAvgBpm = deepPickNumber(raw, ["hr_avg_bpm", "heart_rate_avg", "avg_hr", "average_hr", "avg_heartrate"]);
  const cadenceAvgRpm = deepPickNumber(raw, ["cadence_avg_rpm", "avg_cadence", "cadence", "avg_cadence_rpm"]);
  const speedAvgKmh =
    deepPickNumber(raw, ["speed_avg_kmh", "avg_speed_kmh", "enhanced_avg_speed", "avg_speed", "speed_kmh", "velocity_kmh"]) ??
    (() => {
      const mps = deepPickNumber(raw, ["speed_avg_m_s", "avg_speed_m_s", "speed_m_s", "velocity_m_s"]);
      return mps != null ? mps * 3.6 : null;
    })();
  const elevationGainM = deepPickNumber(raw, ["elevation_gain_m", "elev_gain_m", "ascent_m", "total_ascent", "altitude_gain_m"]);
  const tempAvgC = deepPickNumber(raw, ["temperature_avg_c", "temp_avg_c", "temperature_c", "avg_temperature", "avg_temp", "temperature"]);
  const altitudeAvgM = deepPickNumber(raw, ["altitude_avg_m", "enhanced_avg_altitude", "avg_altitude", "altitude"]);
  const lactateMmolL = deepPickNumber(raw, ["lactate_mmoll", "lactate_mmol_l", "lactate"]);
  const glucoseMmolL = deepPickNumber(raw, ["glucose_mmol", "blood_glucose_mmol_l", "glucose"]);
  const smo2Pct = deepPickNumber(raw, ["smo2", "smo2_avg_pct", "muscle_oxygen_pct"]);
  const vo2LMin = deepPickNumber(raw, ["vo2_l_min", "vo2"]);
  const vco2LMin = deepPickNumber(raw, ["vco2_l_min", "vco2"]);
  const coreTempC = deepPickNumber(raw, ["core_temp_c", "core_temp"]);
  const sport = deepPickString(raw, ["sport", "activity_type", "type", "sport_name"]);

  return {
    vendor,
    traceSummary: {
      ...raw,
      source_vendor: vendor,
      source_format: String(input.parsed.format || raw.source_format || "unknown"),
      import_schema_version: "v1",
      duration_min: input.parsed.durationMinutes,
      tss: input.parsed.tss,
      kcal: input.parsed.kcal,
      kj: input.parsed.kj,
      distance_km: distanceKm,
      power_avg_w: powerAvgW,
      power_avg: powerAvgW,
      hr_avg_bpm: hrAvgBpm,
      cadence_avg_rpm: cadenceAvgRpm,
      speed_avg_kmh: speedAvgKmh,
      elevation_gain_m: elevationGainM,
      altitude_avg_m: altitudeAvgM,
      temperature_avg_c: tempAvgC,
      lactate_mmol_l: lactateMmolL,
      glucose_mmol: glucoseMmolL,
      smo2: smo2Pct,
      vo2_l_min: vo2LMin,
      vco2_l_min: vco2LMin,
      core_temp_c: coreTempC,
      sport: sport,
    },
  };
}

