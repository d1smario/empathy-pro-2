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

function asDateOnly(input: string | null): string | null {
  if (!input) return null;
  const compact = input.trim();
  const dmY = compact.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dmY) {
    const d = dmY[1].padStart(2, "0");
    const m = dmY[2].padStart(2, "0");
    const y = dmY[3];
    return `${y}-${m}-${d}`;
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

  const idxDate = indexOf("date", "giorno", "day", "workout day");
  const idxType = indexOf("type", "workout", "sport", "session", "name");
  const idxDur = indexOf("duration", "durata", "minutes", "time");
  const idxTss = indexOf("tss", "training stress");
  const idxKcal = indexOf("kcal", "calories", "energy");
  const idxNotes = indexOf("note", "notes", "descr", "description");
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

