type PlannedImportRow = {
  date: string;
  type: string;
  duration_minutes: number;
  tss_target: number;
  kcal_target: number | null;
  notes: string | null;
};

type PlannedImportResult = {
  rows: PlannedImportRow[];
  firstDate: string | null;
  sourceFormat: "csv" | "json";
};

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function padYmd(y: number, month: number, day: number): string {
  return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** True se (year, month 1–12, day) è un giorno reale del calendario locale. */
function isValidCalendarYmd(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const dt = new Date(year, month - 1, day);
  return dt.getFullYear() === year && dt.getMonth() === month - 1 && dt.getDate() === day;
}

/**
 * Data solo-giorno da CSV/JSON (TrainingPeaks, export EU/US).
 * Slash: prova DMY poi MDY; se entrambe valide preferisce DMY (coerente con 22/04/2026).
 * ISO `YYYY-MM-DD` letto prima del parse `Date` (evita shift fuso su stringhe ambigue).
 */
function asDateOnly(input: string | null): string | null {
  if (!input) return null;
  const compact = input.trim();
  const isoHead = compact.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoHead) return `${isoHead[1]}-${isoHead[2]}-${isoHead[3]}`;
  const slash = compact.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (slash) {
    const a = Number(slash[1]);
    const b = Number(slash[2]);
    const y = Number(slash[3]);
    const dmy = isValidCalendarYmd(y, b, a); // giorno=a, mese=b
    const mdy = isValidCalendarYmd(y, a, b); // mese=a, giorno=b
    if (dmy && !mdy) return padYmd(y, b, a);
    if (!dmy && mdy) return padYmd(y, a, b);
    if (dmy && mdy) return padYmd(y, b, a); // es. 02/01/2026 → 2 gen (DMY)
    if (dmy) return padYmd(y, b, a);
    if (mdy) return padYmd(y, a, b);
    return null;
  }
  const d = new Date(compact);
  if (!Number.isFinite(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function normalizeType(raw: string): string {
  const t = raw.toLowerCase();
  if (t.includes("vo2")) return "vo2max";
  if (t.includes("threshold") || t.includes("soglia")) return "threshold";
  if (t.includes("recovery") || t.includes("easy") || t.includes("rest")) return "recovery";
  if (t.includes("strength") || t.includes("gym")) return "strength";
  if (t.includes("race") || t.includes("gara")) return "race";
  return "endurance";
}

function parseCsv(text: string): PlannedImportResult {
  const lines = text.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error("CSV pianificazione vuoto o incompleto.");
  const sep = lines[0].includes(";") ? ";" : lines[0].includes("\t") ? "\t" : ",";
  const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase());
  const indexOf = (...keys: string[]) => headers.findIndex((h) => keys.some((k) => h.includes(k)));

  const idxDate = indexOf("date", "giorno", "workout day", "calendar day", "scheduled date", "plan date");
  const idxType = indexOf("type", "workout", "sport", "session", "name", "title", "workout title", "activity");
  const idxDur = indexOf("duration", "durata", "minutes", "time", "planned duration", "planned time", "length");
  const idxTss = indexOf("tss", "training stress", "planned tss", "planned load");
  const idxKcal = indexOf("kcal", "calories", "energy", "planned kcal");
  const idxNotes = indexOf("note", "notes", "descr", "description", "comments", "coach");
  if (idxDate < 0) throw new Error("CSV pianificazione: colonna data mancante.");

  const rows: PlannedImportRow[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(sep).map((c) => c.trim());
    const date = asDateOnly(cols[idxDate] ?? null);
    if (!date) continue;
    const duration = asNumber(cols[idxDur]) ?? 60;
    const tss = asNumber(cols[idxTss]) ?? clamp(duration * 0.7, 10, 250);
    const type = normalizeType(cols[idxType] ?? "endurance");
    const kcal = asNumber(cols[idxKcal]);
    const notes = (cols[idxNotes] ?? "").trim() || null;
    rows.push({
      date,
      type,
      duration_minutes: Math.max(0, Math.round(duration)),
      tss_target: Math.max(0, Math.round(tss)),
      kcal_target: kcal != null ? Math.max(0, Math.round(kcal)) : null,
      notes: notes ? `[TP_IMPORT] ${notes}` : "[TP_IMPORT]",
    });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  return { rows, firstDate: rows[0]?.date ?? null, sourceFormat: "csv" };
}

function parseJson(text: string): PlannedImportResult {
  const raw = JSON.parse(text) as unknown;
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as Record<string, unknown>).workouts)
      ? ((raw as Record<string, unknown>).workouts as unknown[])
      : [];
  const rows: PlannedImportRow[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const date = asDateOnly((rec.date as string) ?? (rec.day as string) ?? (rec.workout_day as string) ?? null);
    if (!date) continue;
    const duration = asNumber(rec.duration_minutes) ?? asNumber(rec.duration_min) ?? asNumber(rec.duration) ?? 60;
    const tss = asNumber(rec.tss_target) ?? asNumber(rec.tss) ?? clamp(duration * 0.7, 10, 250);
    const kcal = asNumber(rec.kcal_target) ?? asNumber(rec.kcal) ?? asNumber(rec.calories);
    const type = normalizeType(String(rec.type ?? rec.workout_type ?? rec.name ?? "endurance"));
    const noteRaw = String(rec.notes ?? rec.description ?? "").trim();
    rows.push({
      date,
      type,
      duration_minutes: Math.max(0, Math.round(duration)),
      tss_target: Math.max(0, Math.round(tss)),
      kcal_target: kcal != null ? Math.max(0, Math.round(kcal)) : null,
      notes: noteRaw ? `[TP_IMPORT] ${noteRaw}` : "[TP_IMPORT]",
    });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  return { rows, firstDate: rows[0]?.date ?? null, sourceFormat: "json" };
}

export async function parsePlannedProgramFile(input: {
  fileName: string;
  buffer: Buffer;
}): Promise<PlannedImportResult> {
  const lower = input.fileName.toLowerCase();
  const text = input.buffer.toString("utf8");
  if (lower.endsWith(".csv")) return parseCsv(text);
  if (lower.endsWith(".json")) return parseJson(text);
  throw new Error("Formato pianificazione non supportato. Usa CSV o JSON.");
}

/** Prima riga dati (header) — stessi sinonimi di `parseCsv` per non divergere. */
export function csvHeaderLooksLikePlannedProgramExport(headerLine: string): boolean {
  const line = headerLine.trim();
  if (!line) return false;
  const sep = line.includes(";") ? ";" : line.includes("\t") ? "\t" : ",";
  const headers = line.split(sep).map((h) => h.trim().toLowerCase());
  const idxDate = headers.findIndex((h) =>
    ["date", "giorno", "workout day", "calendar day", "scheduled date", "plan date"].some((k) => h.includes(k)),
  );
  return idxDate >= 0;
}

/** True se JSON tabellare multi-giorno (export calendario / array `workouts`). */
export function jsonTextLooksLikePlannedProgram(text: string): boolean {
  try {
    const raw = JSON.parse(text) as unknown;
    const list = Array.isArray(raw)
      ? raw
      : raw && typeof raw === "object" && Array.isArray((raw as Record<string, unknown>).workouts)
        ? ((raw as Record<string, unknown>).workouts as unknown[])
        : [];
    if (!list.length) return false;
    const first = list[0];
    if (!first || typeof first !== "object") return false;
    const rec = first as Record<string, unknown>;
    const dateRaw =
      (rec.date as string | undefined) ??
      (rec.day as string | undefined) ??
      (rec.workout_day as string | undefined) ??
      null;
    return typeof dateRaw === "string" && dateRaw.trim().length >= 8;
  } catch {
    return false;
  }
}

