import { gunzipSync } from "node:zlib";
import FitParser from "fit-file-parser";

type ParsedTrainingFile = {
  format: "csv" | "json" | "tcx" | "gpx" | "fit";
  date: string | null;
  durationMinutes: number;
  tss: number;
  kcal: number | null;
  kj: number | null;
  traceSummary: Record<string, unknown>;
};

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function round(v: number, digits = 2) {
  const m = 10 ** digits;
  return Math.round(v * m) / m;
}

function asDateOnly(input: string | null): string | null {
  if (!input) return null;
  const d = new Date(input);
  if (!Number.isFinite(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asDateMs(v: unknown): number | null {
  if (v instanceof Date) {
    const ms = v.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    return v > 1000000000000 ? v : v * 1000;
  }
  if (typeof v === "string" && v.trim() !== "") {
    const ms = new Date(v).getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

function estimateTss(durationMinutes: number, powerAvg?: number | null) {
  if (durationMinutes <= 0) return 0;
  const powerFactor = powerAvg && powerAvg > 0 ? clamp(powerAvg / 250, 0.7, 1.6) : 1;
  return round(clamp(durationMinutes * 0.7 * powerFactor, 5, 350), 1);
}

function parseCsv(text: string): ParsedTrainingFile {
  const lines = text.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error("CSV vuoto o incompleto");
  const sep = lines[0].includes(";") ? ";" : lines[0].includes("\t") ? "\t" : ",";
  const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase());
  const first = lines[1].split(sep).map((v) => v.trim());
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const idx = headers.findIndex((h) => h.includes(k));
      if (idx >= 0) return first[idx] ?? "";
    }
    return "";
  };

  const date = asDateOnly(get("date", "giorno"));
  const durationMin =
    asNumber(get("duration", "durata", "time", "moving time", "elapsed")) ??
    asNumber(get("minutes", "min")) ??
    0;
  const tss = asNumber(get("tss", "training stress")) ?? estimateTss(durationMin, asNumber(get("power", "pw:avg", "avg power")));
  const kcal = asNumber(get("kcal", "calories", "energy"));
  const kj = asNumber(get("kj", "kilojoule", "work"));
  const powerAvg = asNumber(get("power", "pw:avg", "avg power"));
  const hrAvg = asNumber(get("hr:avg", "heart rate", "avg hr"));
  const speedAvg = asNumber(get("speed", "avg speed", "pace"));
  const cadence = asNumber(get("cadence", "avg cadence"));
  const distanceKm = asNumber(get("distance", "km"));

  return {
    format: "csv",
    date,
    durationMinutes: Math.max(0, round(durationMin, 1)),
    tss: Math.max(0, round(tss, 1)),
    kcal: kcal != null ? round(kcal, 1) : null,
    kj: kj != null ? round(kj, 1) : null,
    traceSummary: {
      source_format: "csv",
      distance_km: distanceKm,
      power_avg: powerAvg,
      hr_avg_bpm: hrAvg,
      speed_avg_kmh: speedAvg,
      cadence_avg_rpm: cadence,
    },
  };
}

function readTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}>([^<]+)</${tag}>`, "i");
  const m = xml.match(re);
  return m?.[1] ?? null;
}

function readAllTagNumbers(xml: string, tag: string): number[] {
  const re = new RegExp(`<${tag}>([^<]+)</${tag}>`, "gi");
  const out: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) != null) {
    const n = asNumber(m[1]);
    if (n != null) out.push(n);
  }
  return out;
}

function average(list: number[]) {
  if (!list.length) return null;
  return list.reduce((s, v) => s + v, 0) / list.length;
}

function sampleEvenly<T>(list: T[], maxPoints: number): T[] {
  if (list.length <= maxPoints) return list;
  if (maxPoints <= 2) return [list[0], list[list.length - 1]];
  const out: T[] = [];
  for (let i = 0; i < maxPoints; i += 1) {
    const idx = Math.round((i / (maxPoints - 1)) * (list.length - 1));
    out.push(list[idx]);
  }
  return out;
}

function fillMissingLinear(values: Array<number | null>): number[] {
  if (!values.length) return [];
  const out = values.map((v) => (v != null && Number.isFinite(v) ? v : null));
  for (let i = 0; i < out.length; i += 1) {
    if (out[i] != null) continue;
    let left = i - 1;
    while (left >= 0 && out[left] == null) left -= 1;
    let right = i + 1;
    while (right < out.length && out[right] == null) right += 1;
    if (left >= 0 && right < out.length) {
      const a = out[left] as number;
      const b = out[right] as number;
      const t = (i - left) / (right - left);
      out[i] = a + (b - a) * t;
    } else if (left >= 0) {
      out[i] = out[left];
    } else if (right < out.length) {
      out[i] = out[right];
    } else {
      out[i] = 0;
    }
  }
  return out.map((v) => round(v as number, 1));
}

function cumulativeDistanceKm(
  rows: Array<{ lat: number; lon: number }>,
): number[] {
  if (!rows.length) return [];
  const out = [0];
  let acc = 0;
  for (let i = 1; i < rows.length; i += 1) {
    acc += haversineKm(rows[i - 1], rows[i]);
    out.push(round(acc, 4));
  }
  return out;
}

function normalizeFitDurationMinutes(v: number | null): number | null {
  if (v == null || !Number.isFinite(v) || v <= 0) return null;
  // FIT exporters may expose elapsed time as seconds or milliseconds.
  if (v > 100000) return v / 60000;
  if (v > 1440) return v / 60;
  return v;
}

function normalizeFitDistanceKm(v: number | null): number | null {
  if (v == null || !Number.isFinite(v) || v <= 0) return null;
  // FIT distance is often meters; lengthUnit may still vary by exporter.
  if (v > 1000) return v / 1000;
  return v;
}

function sanitizeRoutePoints<T extends { lat: number; lon: number }>(points: T[]): T[] {
  if (points.length < 3) return points;
  const out: T[] = [points[0]];
  for (let i = 1; i < points.length; i += 1) {
    const prev = out[out.length - 1];
    const cur = points[i];
    const dKm = haversineKm(prev, cur);
    // Remove GPS teleport spikes that break map length/elevation profile.
    if (dKm > 2.5) continue;
    out.push(cur);
  }
  return out.length >= 2 ? out : points;
}

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371; // km
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function parseTcx(xml: string): ParsedTrainingFile {
  const date = asDateOnly(readTag(xml, "Id") ?? readTag(xml, "StartTime"));
  const totalSeconds = asNumber(readTag(xml, "TotalTimeSeconds")) ?? 0;
  const distanceM = asNumber(readTag(xml, "DistanceMeters"));
  const kcal = asNumber(readTag(xml, "Calories"));
  const hrAvg = asNumber(readTag(xml, "AverageHeartRateBpm>\\s*<Value")) ?? average(readAllTagNumbers(xml, "Value"));
  const cadenceAvg = asNumber(readTag(xml, "Cadence")) ?? average(readAllTagNumbers(xml, "Cadence"));
  const powerSamples = readAllTagNumbers(xml, "Watts");
  const powerAvg = average(powerSamples);
  const speedAvg = distanceM && totalSeconds > 0 ? (distanceM / totalSeconds) * 3.6 : null;
  const durationMinutes = totalSeconds > 0 ? totalSeconds / 60 : 0;
  const tss = estimateTss(durationMinutes, powerAvg);

  return {
    format: "tcx",
    date,
    durationMinutes: round(durationMinutes, 1),
    tss,
    kcal: kcal != null ? round(kcal, 1) : null,
    kj: powerAvg != null ? round((powerAvg * totalSeconds) / 1000, 1) : null,
    traceSummary: {
      source_format: "tcx",
      distance_km: distanceM != null ? round(distanceM / 1000, 3) : null,
      power_avg: powerAvg != null ? round(powerAvg, 1) : null,
      hr_avg_bpm: hrAvg != null ? round(hrAvg, 1) : null,
      speed_avg_kmh: speedAvg != null ? round(speedAvg, 2) : null,
      cadence_avg_rpm: cadenceAvg != null ? round(cadenceAvg, 1) : null,
      trackpoint_count: readAllTagNumbers(xml, "Time").length,
    },
  };
}

function parseGpx(xml: string): ParsedTrainingFile {
  const times = Array.from(xml.matchAll(/<time>([^<]+)<\/time>/gi)).map((m) => m[1]);
  const start = times.length ? new Date(times[0]) : null;
  const end = times.length ? new Date(times[times.length - 1]) : null;
  const durationMinutes =
    start && end && Number.isFinite(start.getTime()) && Number.isFinite(end.getTime())
      ? (end.getTime() - start.getTime()) / 60000
      : 0;
  const date = asDateOnly(start?.toISOString() ?? null);

  const pointRegex = /<trkpt[^>]*lat="([^"]+)"[^>]*lon="([^"]+)"[^>]*>([\s\S]*?)<\/trkpt>/gi;
  const pointMatches = Array.from(xml.matchAll(pointRegex));
  const pointRows = pointMatches
    .map((m) => {
      const lat = asNumber(m[1]);
      const lon = asNumber(m[2]);
      const inner = m[3] ?? "";
      const ele = asNumber((inner.match(/<ele>([^<]+)<\/ele>/i)?.[1] ?? null) as unknown);
      const t = inner.match(/<time>([^<]+)<\/time>/i)?.[1] ?? null;
      const ts = t ? new Date(t).getTime() : NaN;
      if (lat == null || lon == null) return null;
      return { lat, lon, ele, ts: Number.isFinite(ts) ? ts : null };
    })
    .filter((r): r is { lat: number; lon: number; ele: number | null; ts: number | null } => r != null);
  const points = pointRows.map((r) => [r.lat, r.lon] as const);
  const routeDistanceSeriesKm = cumulativeDistanceKm(pointRows);
  const routeAltitudeSeriesM = fillMissingLinear(pointRows.map((r) => r.ele));

  const hrs = [
    ...readAllTagNumbers(xml, "gpxtpx:hr"),
    ...readAllTagNumbers(xml, "hr"),
  ];
  const cads = [
    ...readAllTagNumbers(xml, "gpxtpx:cad"),
    ...readAllTagNumbers(xml, "cad"),
  ];
  const atemps = [
    ...readAllTagNumbers(xml, "gpxtpx:atemp"),
    ...readAllTagNumbers(xml, "atemp"),
  ];
  const power = readAllTagNumbers(xml, "power");
  const powerAvg = average(power);
  const hrAvg = average(hrs);
  const cadenceAvg = average(cads);
  const tempAvg = average(atemps);
  const altitudeSeries = pointRows
    .map((r) => r.ele)
    .filter((v): v is number => v != null && Number.isFinite(v));
  const altitudeGainM =
    altitudeSeries.length > 1
      ? altitudeSeries.reduce((gain, cur, idx) => {
          if (idx === 0) return gain;
          const delta = cur - altitudeSeries[idx - 1];
          return delta > 0 ? gain + delta : gain;
        }, 0)
      : null;

  let distanceKm = 0;
  for (let i = 1; i < pointRows.length; i += 1) {
    distanceKm += haversineKm(pointRows[i - 1], pointRows[i]);
  }
  const speedAvgKmh =
    durationMinutes > 0 && distanceKm > 0 ? distanceKm / (durationMinutes / 60) : null;
  const speedSeriesKmh = pointRows
    .map((row, i) => {
      if (i === 0) return null;
      const prev = pointRows[i - 1];
      if (row.ts == null || prev.ts == null || row.ts <= prev.ts) return null;
      const dtH = (row.ts - prev.ts) / 3600000;
      if (dtH <= 0) return null;
      const dKm = haversineKm(prev, row);
      return dKm / dtH;
    })
    .filter((v): v is number => v != null && Number.isFinite(v));
  const tss = estimateTss(durationMinutes, powerAvg);

  return {
    format: "gpx",
    date,
    durationMinutes: round(Math.max(0, durationMinutes), 1),
    tss,
    kcal: null,
    kj: powerAvg != null ? round((powerAvg * durationMinutes * 60) / 1000, 1) : null,
    traceSummary: {
      source_format: "gpx",
        parser_engine: "gpx_native_parser",
        parser_version: "v2",
      route_points: sampleEvenly(points, 1800).map(([lat, lon]) => ({ lat, lon })),
      route_distance_series_km: sampleEvenly(routeDistanceSeriesKm, 1200),
      route_altitude_series_m: sampleEvenly(routeAltitudeSeriesM, 1200),
      distance_km: distanceKm > 0 ? round(distanceKm, 3) : null,
      power_avg: powerAvg != null ? round(powerAvg, 1) : null,
      hr_avg_bpm: hrAvg != null ? round(hrAvg, 1) : null,
      speed_avg_kmh: speedAvgKmh != null ? round(speedAvgKmh, 2) : null,
      cadence_avg_rpm: cadenceAvg != null ? round(cadenceAvg, 1) : null,
      temperature_avg_c: tempAvg != null ? round(tempAvg, 1) : null,
      altitude_gain_m: altitudeGainM != null ? round(altitudeGainM, 1) : null,
      altitude_series_m: sampleEvenly(altitudeSeries, 1200),
      speed_series_kmh: sampleEvenly(speedSeriesKmh, 1200),
      trackpoint_count: points.length,
      raw_counts: {
        points: pointRows.length,
        power: power.length,
        hr: hrs.length,
        speed: speedSeriesKmh.length,
        cadence: cads.length,
        altitude: altitudeSeries.length,
        temperature: atemps.length,
      },
        channels_available: {
          power: power.length > 0,
          hr: hrs.length > 0,
          speed: speedSeriesKmh.length > 0 || speedAvgKmh != null,
          cadence: cads.length > 0,
          altitude: altitudeSeries.length > 0,
          temperature: atemps.length > 0,
        },
    },
  };
}

function parseJson(text: string): ParsedTrainingFile {
  const raw = JSON.parse(text) as Record<string, unknown>;
  const date = asDateOnly((raw.date as string) ?? (raw.start_time as string) ?? null);
  const durationMin =
    asNumber(raw.duration_minutes) ??
    asNumber(raw.duration_min) ??
    (asNumber(raw.duration_sec) != null ? (asNumber(raw.duration_sec) as number) / 60 : 0);
  const powerAvg = asNumber(raw.power_avg) ?? asNumber(raw.avg_power);
  const tss = asNumber(raw.tss) ?? estimateTss(durationMin ?? 0, powerAvg);
  const kcal = asNumber(raw.kcal) ?? asNumber(raw.calories);
  const kj = asNumber(raw.kj) ?? asNumber(raw.work_kj);

  return {
    format: "json",
    date,
    durationMinutes: round(Math.max(0, durationMin ?? 0), 1),
    tss: Math.max(0, round(tss, 1)),
    kcal: kcal != null ? round(kcal, 1) : null,
    kj: kj != null ? round(kj, 1) : null,
    traceSummary: {
      source_format: "json",
      ...raw,
    },
  };
}

const FIT_EPOCH_UNIX_SECONDS = Date.UTC(1989, 11, 31, 0, 0, 0) / 1000;
const SEMICIRCLES_TO_DEGREES = 180 / 2147483648;

type FitFieldDefinition = {
  fieldDefNum: number;
  size: number;
  baseType: number;
};

type FitMessageDefinition = {
  architecture: 0 | 1;
  globalMessageNumber: number;
  fields: FitFieldDefinition[];
};

function fitSecondsToDateOnly(seconds: number | null): string | null {
  if (seconds == null || !Number.isFinite(seconds)) return null;
  const unixMs = (FIT_EPOCH_UNIX_SECONDS + seconds) * 1000;
  return asDateOnly(new Date(unixMs).toISOString());
}

function decodeFitValue(raw: Buffer, baseType: number, isLittleEndian: boolean): number | string | null {
  const kind = baseType & 0x1f;
  if (kind === 7 || kind === 13) {
    const text = raw.toString("utf8").replace(/\0+$/g, "").trim();
    return text.length ? text : null;
  }
  if (kind === 8 && raw.length >= 4) {
    const n = isLittleEndian ? raw.readFloatLE(0) : raw.readFloatBE(0);
    return Number.isFinite(n) ? n : null;
  }
  if (kind === 9 && raw.length >= 8) {
    const n = isLittleEndian ? raw.readDoubleLE(0) : raw.readDoubleBE(0);
    return Number.isFinite(n) ? n : null;
  }
  if (kind === 14 || kind === 15 || kind === 16) {
    if (raw.length < 8) return null;
    const n =
      kind === 14
        ? isLittleEndian
          ? raw.readBigInt64LE(0)
          : raw.readBigInt64BE(0)
        : isLittleEndian
          ? raw.readBigUInt64LE(0)
          : raw.readBigUInt64BE(0);
    const num = Number(n);
    return Number.isSafeInteger(num) ? num : null;
  }

  const signedKinds = new Set([1, 3, 5]);
  const allOnes = raw.every((b) => b === 0xff);
  if (allOnes) return null;

  if (raw.length === 1) {
    const v = signedKinds.has(kind) ? raw.readInt8(0) : raw.readUInt8(0);
    return Number.isFinite(v) ? v : null;
  }
  if (raw.length === 2) {
    const v = signedKinds.has(kind)
      ? isLittleEndian
        ? raw.readInt16LE(0)
        : raw.readInt16BE(0)
      : isLittleEndian
        ? raw.readUInt16LE(0)
        : raw.readUInt16BE(0);
    return Number.isFinite(v) ? v : null;
  }
  if (raw.length === 4) {
    const v = signedKinds.has(kind)
      ? isLittleEndian
        ? raw.readInt32LE(0)
        : raw.readInt32BE(0)
      : isLittleEndian
        ? raw.readUInt32LE(0)
        : raw.readUInt32BE(0);
    return Number.isFinite(v) ? v : null;
  }
  return null;
}

function asFitNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

function parseFitLegacy(buffer: Buffer): ParsedTrainingFile {
  if (buffer.length < 14) throw new Error("File FIT non valido: header troppo corto.");
  const headerSize = buffer.readUInt8(0);
  if (headerSize !== 12 && headerSize !== 14) {
    throw new Error("File FIT non valido: header size non supportata.");
  }
  if (buffer.length < headerSize + 1) {
    throw new Error("File FIT non valido: file incompleto.");
  }
  if (buffer.toString("ascii", 8, 12) !== ".FIT") {
    throw new Error("File FIT non valido: signature .FIT assente.");
  }

  const dataSize = buffer.readUInt32LE(4);
  const dataStart = headerSize;
  const dataEnd = dataStart + dataSize;
  if (dataEnd > buffer.length) {
    throw new Error("File FIT incompleto: payload troncato.");
  }

  const definitions = new Map<number, FitMessageDefinition>();
  const sessionMessages: Array<Record<number, number | string | null>> = [];
  const recordMessages: Array<Record<number, number | string | null>> = [];
  let cursor = dataStart;
  let lastTimestamp: number | null = null;

  while (cursor < dataEnd) {
    const header = buffer.readUInt8(cursor++);
    const isCompressedHeader = (header & 0x80) !== 0;
    if (isCompressedHeader) {
      const localMessageType = (header >> 5) & 0x03;
      const definition = definitions.get(localMessageType);
      if (!definition) throw new Error("File FIT non valido: data message senza definition.");
      const record: Record<number, number | string | null> = {};
      for (const field of definition.fields) {
        if (cursor + field.size > dataEnd) throw new Error("File FIT incompleto: data record troncato.");
        const raw = buffer.subarray(cursor, cursor + field.size);
        cursor += field.size;
        record[field.fieldDefNum] = decodeFitValue(raw, field.baseType, definition.architecture === 0);
      }
      const timeOffset = header & 0x1f;
      if (lastTimestamp != null) {
        record[253] = (lastTimestamp & ~0x1f) | timeOffset;
      }
      const timestamp = asFitNumber(record[253]);
      if (timestamp != null) lastTimestamp = timestamp;
      if (definition.globalMessageNumber === 18) sessionMessages.push(record);
      if (definition.globalMessageNumber === 20) recordMessages.push(record);
      continue;
    }

    const isDefinition = (header & 0x40) !== 0;
    const localMessageType = header & 0x0f;
    if (isDefinition) {
      if (cursor + 5 > dataEnd) throw new Error("File FIT incompleto: definition troncata.");
      cursor += 1; // reserved
      const architectureRaw = buffer.readUInt8(cursor++);
      const architecture: 0 | 1 = architectureRaw === 1 ? 1 : 0;
      const globalMessageNumber = architecture === 0 ? buffer.readUInt16LE(cursor) : buffer.readUInt16BE(cursor);
      cursor += 2;
      const fieldCount = buffer.readUInt8(cursor++);
      const fields: FitFieldDefinition[] = [];
      for (let i = 0; i < fieldCount; i += 1) {
        if (cursor + 3 > dataEnd) throw new Error("File FIT incompleto: field definition troncata.");
        fields.push({
          fieldDefNum: buffer.readUInt8(cursor),
          size: buffer.readUInt8(cursor + 1),
          baseType: buffer.readUInt8(cursor + 2),
        });
        cursor += 3;
      }
      if ((header & 0x20) !== 0) {
        if (cursor + 1 > dataEnd) throw new Error("File FIT incompleto: developer field metadata troncata.");
        const devFieldCount = buffer.readUInt8(cursor++);
        for (let i = 0; i < devFieldCount; i += 1) {
          if (cursor + 3 > dataEnd) throw new Error("File FIT incompleto: developer field troncato.");
          fields.push({
            fieldDefNum: 1000 + buffer.readUInt8(cursor),
            size: buffer.readUInt8(cursor + 1),
            baseType: 13,
          });
          cursor += 3;
        }
      }
      definitions.set(localMessageType, { architecture, globalMessageNumber, fields });
      continue;
    }

    const definition = definitions.get(localMessageType);
    if (!definition) throw new Error("File FIT non valido: data message senza definition.");
    const record: Record<number, number | string | null> = {};
    for (const field of definition.fields) {
      if (cursor + field.size > dataEnd) throw new Error("File FIT incompleto: data record troncato.");
      const raw = buffer.subarray(cursor, cursor + field.size);
      cursor += field.size;
      record[field.fieldDefNum] = decodeFitValue(raw, field.baseType, definition.architecture === 0);
    }
    const timestamp = asFitNumber(record[253]);
    if (timestamp != null) lastTimestamp = timestamp;
    if (definition.globalMessageNumber === 18) sessionMessages.push(record);
    if (definition.globalMessageNumber === 20) recordMessages.push(record);
  }

  const session = sessionMessages[sessionMessages.length - 1] ?? {};
  const firstRecord = recordMessages[0] ?? {};
  const lastRecord = recordMessages[recordMessages.length - 1] ?? {};

  const startTimeFitSec =
    asFitNumber(session[2]) ??
    asFitNumber(session[253]) ??
    asFitNumber(firstRecord[253]) ??
    null;
  const endTimeFitSec = asFitNumber(lastRecord[253]) ?? null;

  const elapsedSecondsFromSession =
    (asFitNumber(session[7]) ?? asFitNumber(session[8]) ?? null) != null
      ? (asFitNumber(session[7]) ?? asFitNumber(session[8]) ?? 0) / 1000
      : null;

  const elapsedSecondsFromRecords =
    startTimeFitSec != null && endTimeFitSec != null && endTimeFitSec >= startTimeFitSec
      ? endTimeFitSec - startTimeFitSec
      : null;

  const durationSeconds = elapsedSecondsFromSession ?? elapsedSecondsFromRecords ?? 0;
  const durationMinutes = Math.max(0, durationSeconds / 60);

  const powerAvg = asFitNumber(session[20]) ?? average(recordMessages.map((r) => asFitNumber(r[7]) ?? NaN).filter(Number.isFinite));
  const hrAvg = asFitNumber(session[16]) ?? average(recordMessages.map((r) => asFitNumber(r[3]) ?? NaN).filter(Number.isFinite));
  const cadenceAvg = asFitNumber(session[18]) ?? average(recordMessages.map((r) => asFitNumber(r[4]) ?? NaN).filter(Number.isFinite));

  const speedAvgMps =
    (asFitNumber(session[14]) ?? null) != null
      ? (asFitNumber(session[14]) as number) / 1000
      : average(
          recordMessages
            .map((r) => asFitNumber(r[6]))
            .filter((n): n is number => n != null)
            .map((n) => n / 1000),
        );

  const totalDistanceMeters =
    (asFitNumber(session[9]) ?? null) != null
      ? (asFitNumber(session[9]) as number) / 100
      : (() => {
          const distances = recordMessages
            .map((r) => asFitNumber(r[5]))
            .filter((n): n is number => n != null)
            .map((n) => n / 100);
          if (!distances.length) return null;
          return Math.max(...distances) - Math.min(...distances);
        })();

  const routePoints = recordMessages
    .map((r) => {
      const latSemi = asFitNumber(r[0]);
      const lonSemi = asFitNumber(r[1]);
      if (latSemi == null || lonSemi == null) return null;
      const altRaw = asFitNumber(r[2]);
      const ele = altRaw != null ? round(altRaw / 5 - 500, 1) : null;
      return {
        lat: round(latSemi * SEMICIRCLES_TO_DEGREES, 6),
        lon: round(lonSemi * SEMICIRCLES_TO_DEGREES, 6),
        ele,
      };
    })
    .filter((p): p is { lat: number; lon: number; ele: number | null } => p != null);
  const routeDistanceSeriesKm = cumulativeDistanceKm(routePoints);
  const routeAltitudeSeriesM = fillMissingLinear(routePoints.map((p) => p.ele));
  const powerSeries = recordMessages
    .map((r) => asFitNumber(r[7]))
    .filter((v): v is number => v != null)
    .map((v) => round(v, 1));
  const hrSeries = recordMessages
    .map((r) => asFitNumber(r[3]))
    .filter((v): v is number => v != null)
    .map((v) => round(v, 1));
  const speedSeriesKmh = recordMessages
    .map((r) => asFitNumber(r[6]))
    .filter((v): v is number => v != null)
    .map((v) => round((v / 1000) * 3.6, 2));
  const cadenceSeries = recordMessages
    .map((r) => asFitNumber(r[4]))
    .filter((v): v is number => v != null)
    .map((v) => round(v, 1));
  const altitudeSeriesM = recordMessages
    .map((r) => asFitNumber(r[2]))
    .filter((v): v is number => v != null)
    .map((v) => round(v / 5 - 500, 1))
    .filter((v) => Number.isFinite(v) && v > -500 && v < 9000);
  const temperatureSeriesC = recordMessages
    .map((r) => asFitNumber(r[13]))
    .filter((v): v is number => v != null && v > -30 && v < 70)
    .map((v) => round(v, 1));

  const kcal = asFitNumber(session[11]);
  const kj = asFitNumber(session[48]);
  const tss = estimateTss(durationMinutes, powerAvg);

  return {
    format: "fit",
    date: fitSecondsToDateOnly(startTimeFitSec),
    durationMinutes: round(durationMinutes, 1),
    tss,
    kcal: kcal != null ? round(kcal, 1) : null,
    kj: kj != null ? round(kj, 1) : powerAvg != null ? round((powerAvg * durationSeconds) / 1000, 1) : null,
    traceSummary: {
      source_format: "fit",
      distance_km: totalDistanceMeters != null ? round(totalDistanceMeters / 1000, 3) : null,
      power_avg: powerAvg != null ? round(powerAvg, 1) : null,
      hr_avg_bpm: hrAvg != null ? round(hrAvg, 1) : null,
      speed_avg_kmh: speedAvgMps != null ? round(speedAvgMps * 3.6, 2) : null,
      cadence_avg_rpm: cadenceAvg != null ? round(cadenceAvg, 1) : null,
      altitude_avg_m: altitudeSeriesM.length ? round(average(altitudeSeriesM) ?? 0, 1) : null,
      altitude_gain_m:
        altitudeSeriesM.length > 1 ? round(Math.max(...altitudeSeriesM) - Math.min(...altitudeSeriesM), 1) : null,
      temperature_avg_c: temperatureSeriesC.length ? round(average(temperatureSeriesC) ?? 0, 1) : null,
      trackpoint_count: recordMessages.length,
      route_points: sampleEvenly(routePoints, 1800),
      route_distance_series_km: sampleEvenly(routeDistanceSeriesKm, 1200),
      route_altitude_series_m: sampleEvenly(routeAltitudeSeriesM, 1200),
      power_series_w: sampleEvenly(powerSeries, 1200),
      hr_series_bpm: sampleEvenly(hrSeries, 1200),
      speed_series_kmh: sampleEvenly(speedSeriesKmh, 1200),
      cadence_series_rpm: sampleEvenly(cadenceSeries, 1200),
      altitude_series_m: sampleEvenly(altitudeSeriesM, 1200),
      temperature_series_c: sampleEvenly(temperatureSeriesC, 1200),
      fit_session_messages: sessionMessages.length,
      fit_record_messages: recordMessages.length,
    },
  };
}

async function parseFitGarmin(buffer: Buffer): Promise<ParsedTrainingFile | null> {
  try {
    const parser = new FitParser({
      force: true,
      mode: "list",
      speedUnit: "km/h",
      // Keep native altitude precision in meters.
      // Distance is normalized to km later in the pipeline.
      lengthUnit: "m",
      temperatureUnit: "celsius",
      elapsedRecordField: true,
    });
    const fitInput = Uint8Array.from(buffer).buffer;
    const fitRaw = (await parser.parseAsync(fitInput)) as unknown;
    const fit = fitRaw && typeof fitRaw === "object" ? (fitRaw as Record<string, unknown>) : {};
    const records = (Array.isArray(fit.records) ? fit.records : []) as Array<Record<string, unknown>>;
    const sessions = (Array.isArray(fit.sessions) ? fit.sessions : []) as Array<Record<string, unknown>>;
    if (!records.length && !sessions.length) return null;

    const session0 = sessions[0] ?? {};
    const times = records.map((r) => asDateMs(r.timestamp)).filter((v): v is number => v != null);
    const sessionStartMs =
      asDateMs(session0.start_time) ??
      asDateMs(session0.timestamp) ??
      asDateMs(session0.startTime) ??
      asDateMs(session0.local_timestamp);
    const startMs = times.length ? Math.min(...times) : sessionStartMs;
    const endMs =
      times.length
        ? Math.max(...times)
        : startMs != null
          ? startMs + Math.max(0, normalizeFitDurationMinutes(asNumber(session0.total_elapsed_time)) ?? normalizeFitDurationMinutes(asNumber(session0.total_timer_time)) ?? 0) * 60000
          : null;
    const durationMinutes =
      normalizeFitDurationMinutes(asNumber(session0.total_elapsed_time)) ??
      normalizeFitDurationMinutes(asNumber(session0.total_timer_time)) ??
      (startMs != null && endMs != null && endMs > startMs ? (endMs - startMs) / 60000 : 0);

    const routePointsRaw = records
      .map((r) => {
        const lat = asNumber(r.position_lat);
        const lon = asNumber(r.position_long);
        if (lat == null || lon == null) return null;
        const ele = asNumber(r.enhanced_altitude) ?? asNumber(r.altitude);
        return { lat, lon, ele: ele != null ? round(ele, 1) : null };
      })
      .filter((p): p is { lat: number; lon: number; ele: number | null } => p != null);
    const routePoints = sanitizeRoutePoints(routePointsRaw);
    const routeDistanceSeriesKm = cumulativeDistanceKm(routePoints);
    const routeAltitudeSeriesM = fillMissingLinear(routePoints.map((p) => p.ele));
    const powerSeries = records
      .map((r) => asNumber(r.power))
      .filter((v): v is number => v != null)
      .map((v) => round(v, 1));
    const hrSeries = records
      .map((r) => asNumber(r.heart_rate))
      .filter((v): v is number => v != null)
      .map((v) => round(v, 1));
    const speedSeriesKmh = records
      .map((r) => asNumber(r.enhanced_speed) ?? asNumber(r.speed))
      .filter((v): v is number => v != null)
      .map((v) => round(v, 2));
    const cadenceSeries = records
      .map((r) => asNumber(r.cadence))
      .filter((v): v is number => v != null)
      .map((v) => round(v, 1));
    const altitudeSeries = records
      .map((r) => asNumber(r.enhanced_altitude) ?? asNumber(r.altitude))
      .filter((v): v is number => v != null)
      .map((v) => round(v, 1));
    const temperatureSeries = records
      .map((r) => asNumber(r.temperature))
      .filter((v): v is number => v != null)
      .map((v) => round(v, 1));

    const distanceKm =
      normalizeFitDistanceKm(asNumber(session0.total_distance)) ??
      (() => {
        const d = records
          .map((r) => asNumber(r.distance))
          .filter((v): v is number => v != null);
        const maxD = d.length ? Math.max(...d) : null;
        return normalizeFitDistanceKm(maxD);
      })();
    const altitudeGainM =
      asNumber(session0.total_ascent) ??
      (altitudeSeries.length > 1
        ? altitudeSeries.reduce((gain, cur, idx) => {
            if (idx === 0) return gain;
            const delta = cur - altitudeSeries[idx - 1];
            return delta > 0 ? gain + delta : gain;
          }, 0)
        : null);
    const powerAvg = asNumber(session0.avg_power) ?? average(powerSeries);
    const hrAvg = asNumber(session0.avg_heart_rate) ?? average(hrSeries);
    const speedAvg = asNumber(session0.enhanced_avg_speed) ?? asNumber(session0.avg_speed) ?? average(speedSeriesKmh);
    const cadenceAvg = asNumber(session0.avg_cadence) ?? average(cadenceSeries);
    const tempAvg = asNumber(session0.avg_temperature) ?? average(temperatureSeries);
    const kcal = asNumber(session0.total_calories);
    const kj = asNumber(session0.total_work) ?? (powerAvg != null ? (powerAvg * durationMinutes * 60) / 1000 : null);
    const date = asDateOnly(startMs != null ? new Date(startMs).toISOString() : null);
    const tss = estimateTss(durationMinutes, powerAvg);

    return {
      format: "fit",
      date,
      durationMinutes: round(Math.max(0, durationMinutes), 1),
      tss,
      kcal: kcal != null ? round(kcal, 1) : null,
      kj: kj != null ? round(kj, 1) : null,
      traceSummary: {
        source_format: "fit",
        parser_engine: "garmin_fit_file_parser",
        parser_version: "fit-file-parser@2.3.3",
        distance_km: distanceKm != null ? round(distanceKm, 3) : null,
        power_avg: powerAvg != null ? round(powerAvg, 1) : null,
        hr_avg_bpm: hrAvg != null ? round(hrAvg, 1) : null,
        speed_avg_kmh: speedAvg != null ? round(speedAvg, 2) : null,
        cadence_avg_rpm: cadenceAvg != null ? round(cadenceAvg, 1) : null,
        altitude_avg_m: altitudeSeries.length ? round(average(altitudeSeries) ?? 0, 1) : null,
        altitude_gain_m: altitudeGainM != null ? round(altitudeGainM, 1) : null,
        temperature_avg_c: tempAvg != null ? round(tempAvg, 1) : null,
        trackpoint_count: routePoints.length > 0 ? routePoints.length : records.length,
        route_points: sampleEvenly(routePoints, 1800),
        route_distance_series_km: sampleEvenly(routeDistanceSeriesKm, 1200),
        route_altitude_series_m: sampleEvenly(routeAltitudeSeriesM, 1200),
        power_series_w: sampleEvenly(powerSeries, 1200),
        hr_series_bpm: sampleEvenly(hrSeries, 1200),
        speed_series_kmh: sampleEvenly(speedSeriesKmh, 1200),
        cadence_series_rpm: sampleEvenly(cadenceSeries, 1200),
        altitude_series_m: sampleEvenly(altitudeSeries, 1200),
        temperature_series_c: sampleEvenly(temperatureSeries, 1200),
        fit_session_messages: sessions.length,
        fit_record_messages: records.length,
        raw_counts: {
          records: records.length,
          power: powerSeries.length,
          hr: hrSeries.length,
          speed: speedSeriesKmh.length,
          cadence: cadenceSeries.length,
          altitude: altitudeSeries.length,
          temperature: temperatureSeries.length,
          route_points: routePoints.length,
        },
        channels_available: {
          power: powerSeries.length > 0 || powerAvg != null,
          hr: hrSeries.length > 0 || hrAvg != null,
          speed: speedSeriesKmh.length > 0 || speedAvg != null,
          cadence: cadenceSeries.length > 0 || cadenceAvg != null,
          altitude: altitudeSeries.length > 0 || altitudeGainM != null,
          temperature: temperatureSeries.length > 0 || tempAvg != null,
        },
      },
    };
  } catch {
    return null;
  }
}

async function parseFit(buffer: Buffer): Promise<ParsedTrainingFile> {
  const garmin = await parseFitGarmin(buffer);
  if (garmin) return garmin;
  return parseFitLegacy(buffer);
}

/** Decompressione `.gz` condivisa tra routing import e `parseTrainingFile`. */
export function decompressTrainingImportBuffer(input: {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}): { effectiveName: string; payload: Buffer } {
  const lower = input.fileName.toLowerCase();
  const mime = input.mimeType.toLowerCase();
  const isGzipMagic = input.buffer.length > 2 && input.buffer[0] === 0x1f && input.buffer[1] === 0x8b;
  const shouldGunzip = lower.endsWith(".gz") || mime.includes("gzip") || isGzipMagic;

  let payload = input.buffer;
  let inferredName = lower;
  if (shouldGunzip) {
    try {
      payload = gunzipSync(input.buffer);
    } catch {
      throw new Error("File .gz non valido o non decompressibile.");
    }
    if (inferredName.endsWith(".gz")) inferredName = inferredName.slice(0, -3);
  }
  return { effectiveName: inferredName, payload };
}

export async function parseTrainingFile(input: {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<ParsedTrainingFile> {
  const { effectiveName: inferredName, payload } = decompressTrainingImportBuffer(input);
  const lower = inferredName;
  const mime = input.mimeType.toLowerCase();

  if (inferredName.endsWith(".fit") || mime.includes("fit")) return await parseFit(payload);

  const text = payload.toString("utf8");
  if (inferredName.endsWith(".csv")) return parseCsv(text);
  if (inferredName.endsWith(".json")) return parseJson(text);
  if (inferredName.endsWith(".tcx")) return parseTcx(text);
  if (inferredName.endsWith(".gpx")) return parseGpx(text);
  throw new Error(
    "Formato non supportato. Usa FIT/FIT.GZ, CSV, JSON, TCX o GPX (export tipici Garmin, Wahoo, Suunto, Polar, COROS, Karoo, Apple, Zwift, Strava, TrainingPeaks).",
  );
}

