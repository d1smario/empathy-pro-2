/**
 * Parse tabular exports from cardiopulmonary / metabolic carts (Cosmed, Cortex, Vyntus, etc.).
 * Heuristic column detection — not a substitute for vendor-native parsers.
 */

export type GasExchangeParseOptions = {
  /** If the file has VO2 in ml/min (absolute) but no ml/kg column, supply athlete mass (kg). */
  bodyMassKg?: number;
};

export type GasExchangeParseOk = {
  ok: true;
  vo2maxMlMinKg: number;
  vo2maxLMin: number | null;
  bodyMassKgUsed: number | null;
  peakRowIndex: number;
  matchedColumns: { vo2MlKg?: string; vo2MlMin?: string; massKg?: string };
  rowCount: number;
};

export type GasExchangeParseFail = { ok: false; error: string };

export type GasExchangeParseResult = GasExchangeParseOk | GasExchangeParseFail;

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function normalizeHeaderCell(raw: string): string {
  return raw
    .trim()
    .replace(/^["']|["']$/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[′'']/g, "'");
}

/** European or US decimal */
function parseLocaleNumber(raw: string): number | null {
  const t = raw.trim().replace(/^["']|["']$/g, "");
  if (!t || t === "-" || t === ".") return null;
  const normalized = t.includes(",") && !t.includes(".") ? t.replace(",", ".") : t.replace(/,(?=\d{3}\b)/g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function detectDelimiter(line: string): ";" | "\t" | "," {
  const semi = (line.match(/;/g) ?? []).length;
  const tabs = (line.match(/\t/g) ?? []).length;
  const commas = (line.match(/,/g) ?? []).length;
  if (tabs >= semi && tabs >= commas && tabs > 0) return "\t";
  if (semi >= commas && semi > 0) return ";";
  return ",";
}

function splitRow(line: string, delim: ";" | "\t" | ","): string[] {
  if (delim === "\t") return line.split("\t").map((c) => c.trim());
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      inQ = !inQ;
      continue;
    }
    if (!inQ && ch === delim) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function scoreVo2MlKgHeader(h: string): number {
  if (/vco2|ve\/|ve |v[_\s]?e\b/.test(h)) return 0;
  if (/(vo2|o2)\s*\/\s*(kg|bw|mass)|vo2.*kg|ml\/min\/kg|ml\s*kg.*min|rel.*vo2|rel\.?\s*vo2|vo2.*rel/i.test(h)) return 100;
  if (/vo2.*ml.*kg|kg.*vo2/i.test(h)) return 80;
  return 0;
}

function scoreVo2MlMinHeader(h: string): number {
  if (/vco2/.test(h)) return 0;
  if (/vo2.*l\/?min|vo2\s*\(?\s*l/i.test(h)) return 90;
  if (/^vo2$|^vo2\s|vo2\s*\(|vo2.*ml\/min|oxygen uptake|o2 consumption/i.test(h)) return 70;
  if (/\bvo2\b/.test(h) && !/kg|\/kg|rel/i.test(h)) return 50;
  return 0;
}

function scoreMassHeader(h: string): number {
  if (/body\s*mass|bodymass|bw|weight.*kg|^mass$|kg\b.*body/i.test(h)) return 80;
  if (/weight|peso|massa/i.test(h) && /kg/i.test(h)) return 60;
  return 0;
}

export function parseGasExchangeExport(text: string, options?: GasExchangeParseOptions): GasExchangeParseResult {
  const raw = text.replace(/^\uFEFF/, "").trim();
  if (!raw) return { ok: false, error: "File vuoto." };

  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length < 2) return { ok: false, error: "Servono almeno intestazione e una riga dati." };

  const delim = detectDelimiter(lines[0]);
  const headerCells = splitRow(lines[0], delim).map(normalizeHeaderCell);

  let bestVo2Kg = -1;
  let bestVo2KgIdx = -1;
  let bestVo2Min = -1;
  let bestVo2MinIdx = -1;
  let bestMass = -1;
  let bestMassIdx = -1;

  headerCells.forEach((h, i) => {
    const sKg = scoreVo2MlKgHeader(h);
    if (sKg > bestVo2Kg) {
      bestVo2Kg = sKg;
      bestVo2KgIdx = i;
    }
    const sMin = scoreVo2MlMinHeader(h);
    if (sMin > bestVo2Min) {
      bestVo2Min = sMin;
      bestVo2MinIdx = i;
    }
    const sM = scoreMassHeader(h);
    if (sM > bestMass) {
      bestMass = sM;
      bestMassIdx = i;
    }
  });

  const matchedColumns: GasExchangeParseOk["matchedColumns"] = {};
  if (bestVo2KgIdx >= 0 && bestVo2Kg >= 50) matchedColumns.vo2MlKg = headerCells[bestVo2KgIdx];
  if (bestVo2MinIdx >= 0 && bestVo2Min >= 50) matchedColumns.vo2MlMin = headerCells[bestVo2MinIdx];
  if (bestMassIdx >= 0 && bestMass >= 50) matchedColumns.massKg = headerCells[bestMassIdx];

  const dataLines = lines.slice(1);
  const rows: number[][] = [];
  for (const line of dataLines) {
    const cells = splitRow(line, delim);
    const nums = cells.map((c) => parseLocaleNumber(c)).map((n) => (n == null ? NaN : n));
    rows.push(nums);
  }

  if (matchedColumns.vo2MlKg && bestVo2KgIdx >= 0) {
    let peak = -Infinity;
    let peakIdx = -1;
    rows.forEach((r, i) => {
      const v = r[bestVo2KgIdx];
      if (Number.isFinite(v) && v > peak && v > 5 && v < 120) {
        peak = v;
        peakIdx = i;
      }
    });
    if (peakIdx < 0) return { ok: false, error: "Nessun valore valido nella colonna VO2/kg." };
    const vo2maxMlMinKg = Math.round(peak * 10) / 10;
    const bm = options?.bodyMassKg;
    const vo2maxLMin =
      bm != null && Number.isFinite(bm) && bm > 30 ? Math.round(((vo2maxMlMinKg * bm) / 1000) * 1000) / 1000 : null;
    return {
      ok: true,
      vo2maxMlMinKg,
      vo2maxLMin,
      bodyMassKgUsed: vo2maxLMin != null ? bm! : null,
      peakRowIndex: peakIdx,
      matchedColumns,
      rowCount: rows.length,
    };
  }

  if (matchedColumns.vo2MlMin && bestVo2MinIdx >= 0) {
    let peak = -Infinity;
    let peakIdx = -1;
    const massIdx = bestMassIdx >= 0 && bestMass >= 50 ? bestMassIdx : -1;
    const massFromFile =
      massIdx >= 0
        ? rows
            .map((r) => r[massIdx])
            .filter((m) => Number.isFinite(m) && m > 35 && m < 200)[0] ?? null
        : null;
    const mass = massFromFile ?? options?.bodyMassKg ?? null;
    if (mass == null || !Number.isFinite(mass) || mass < 35) {
      return {
        ok: false,
        error:
          "Trovata colonna VO2 assoluto (ml/min o L/min) ma non la massa nel file: imposta il peso atleta nel profilo o nel campo massa sotto.",
      };
    }

    for (let i = 0; i < rows.length; i += 1) {
      const r = rows[i];
      let vo2MlMin = r[bestVo2MinIdx];
      if (!Number.isFinite(vo2MlMin)) continue;
      if (vo2MlMin > 0 && vo2MlMin < 8) vo2MlMin *= 1000;
      if (vo2MlMin < 500 || vo2MlMin > 9000) continue;
      const mlKg = vo2MlMin / mass;
      if (mlKg > peak) {
        peak = mlKg;
        peakIdx = i;
      }
    }
    if (peakIdx < 0) return { ok: false, error: "Nessun picco VO2 plausibile (ml/min) trovato." };
    const vo2maxMlMinKg = Math.round(clamp(peak, 15, 95) * 10) / 10;
    const vo2L = (vo2maxMlMinKg * mass) / 1000;
    return {
      ok: true,
      vo2maxMlMinKg,
      vo2maxLMin: Math.round(vo2L * 1000) / 1000,
      bodyMassKgUsed: mass,
      peakRowIndex: peakIdx,
      matchedColumns,
      rowCount: rows.length,
    };
  }

  return {
    ok: false,
    error:
      "Colonne non riconosciute. Esporta CSV/TXT con intestazione (es. VO2/kg, oppure VO2 in ml/min + massa). Cosmed: export tabulare con righe tempo × gas.",
  };
}
