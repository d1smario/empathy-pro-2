"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FoodDiaryEntryViewModel } from "@/api/nutrition/contracts";
import {
  deleteFoodDiaryEntry,
  entriesToComplianceRows,
  fetchFoodDiary,
  postFoodDiaryEntry,
  type FoodDiaryComplianceRow,
} from "@/modules/nutrition/services/food-diary-api";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-auth";
import {
  NutritionMicronutrientGrid,
  diaryMicroRollupToGridProps,
} from "@/modules/nutrition/components/NutritionMicronutrientGrid";

type LookupHit = {
  source: "internal" | "openfoodfacts" | "usda";
  fdcId?: number | null;
  label: string;
  brand: string | null;
  kcal_100: number | null;
  carbs_100: number | null;
  protein_100: number | null;
  fat_100: number | null;
  sodium_mg_100: number | null;
};

const MEAL_SLOT_OPTIONS: { value: FoodDiaryEntryViewModel["mealSlot"]; label: string }[] = [
  { value: "breakfast", label: "Colazione" },
  { value: "lunch", label: "Pranzo" },
  { value: "dinner", label: "Cena" },
  { value: "snack", label: "Spuntino" },
  { value: "other", label: "Altro" },
];

function lookupHitSame(a: LookupHit | null, b: LookupHit): boolean {
  if (!a) return false;
  if (a.source !== b.source || a.label !== b.label || a.brand !== b.brand) return false;
  if (a.fdcId != null || b.fdcId != null) return a.fdcId === b.fdcId;
  return true;
}

function formatDateIt(iso: string): string {
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString("it-IT", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    });
  } catch {
    return iso;
  }
}

function provenanceLabel(p: FoodDiaryEntryViewModel["provenance"]): string {
  return p === "usda_fdc" ? "USDA FDC" : "Scala da ref. /100g";
}

type Props = {
  athleteId: string | null;
  /** Aggiorna KPI conformità nel genitore (tab meal / score). */
  onComplianceRowsChange: (rows: FoodDiaryComplianceRow[]) => void;
  /** Giorno del solver nutrizione (YYYY-MM-DD): se coincide con data diario, usiamo target precisi. */
  planDateForSolverTargets?: string | null;
  /** Giorno selezionato nel modulo (per pulsante “allinea”). */
  planDateAnchor?: string | null;
  /** Fabbisogno pasti × training per il giorno piano (kcal). */
  diaryEnergyTargetKcal?: number | null;
  /** Macro giornaliere target (g) allineate alla griglia pasti — solo con giorno = piano. */
  diaryMacroTargetCarbsG?: number | null;
  diaryMacroTargetProteinG?: number | null;
  diaryMacroTargetFatG?: number | null;
  /** Se la data diario ≠ giorno piano, stima grezza (TDEE da profilo). */
  fallbackDailyEnergyKcal?: number | null;
  weightKg?: number | null;
  /** Indice efficienza metabolica (modello interpretativo motore, 0–100). */
  metabolicEfficiencyIndex?: number | null;
};

type MicroRollupResponse = {
  ok: boolean;
  reason?: string;
  messageIt?: string;
  vitamins: Array<{ name: string; total: number; unit: string }>;
  minerals: Array<{ name: string; total: number; unit: string }>;
  aminoAcids: Array<{ name: string; total: number; unit: string }>;
  fattyAcids: Array<{ name: string; total: number; unit: string }>;
  fdcEntryCount?: number;
  nonFdcEntryCount?: number;
};

function parseDecimalInput(s: string): number {
  const n = Number(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

export function FoodDiaryPanel({
  athleteId,
  onComplianceRowsChange,
  planDateForSolverTargets = null,
  planDateAnchor = null,
  diaryEnergyTargetKcal = null,
  diaryMacroTargetCarbsG = null,
  diaryMacroTargetProteinG = null,
  diaryMacroTargetFatG = null,
  fallbackDailyEnergyKcal = null,
  weightKg = null,
  metabolicEfficiencyIndex = null,
}: Props) {
  const complianceCbRef = useRef(onComplianceRowsChange);
  complianceCbRef.current = onComplianceRowsChange;

  const [entries, setEntries] = useState<FoodDiaryEntryViewModel[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [mealSlot, setMealSlot] = useState<FoodDiaryEntryViewModel["mealSlot"]>("lunch");
  const [quantityG, setQuantityG] = useState("100");
  const [notes, setNotes] = useState("");
  const [supplements, setSupplements] = useState("");

  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<LookupHit[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [selectedHit, setSelectedHit] = useState<LookupHit | null>(null);

  const [manualLabel, setManualLabel] = useState("");
  const [manualKcal, setManualKcal] = useState("");
  const [manualCarbs, setManualCarbs] = useState("");
  const [manualProtein, setManualProtein] = useState("");
  const [manualFat, setManualFat] = useState("");
  const [photoLoading, setPhotoLoading] = useState(false);
  const [visionNote, setVisionNote] = useState<string | null>(null);

  const [microRollup, setMicroRollup] = useState<MicroRollupResponse | null>(null);
  const [microLoading, setMicroLoading] = useState(false);
  const [microError, setMicroError] = useState<string | null>(null);

  const loggedForDate = useMemo(() => {
    return entries
      .filter((e) => e.entryDate === entryDate)
      .reduce(
        (a, e) => ({
          kcal: a.kcal + e.kcal,
          carbs: a.carbs + e.carbsG,
          protein: a.protein + e.proteinG,
          fat: a.fat + e.fatG,
        }),
        { kcal: 0, carbs: 0, protein: 0, fat: 0 },
      );
  }, [entries, entryDate]);

  const pendingFromForm = useMemo(() => {
    const qg = parseDecimalInput(quantityG);
    if (!Number.isFinite(qg) || qg <= 0) return null;
    const mk = parseDecimalInput(manualKcal);
    const mc = parseDecimalInput(manualCarbs);
    const mp = parseDecimalInput(manualProtein);
    const mf = parseDecimalInput(manualFat);
    if (manualLabel.trim().length > 0 && [mk, mc, mp, mf].every((x) => Number.isFinite(x) && x >= 0)) {
      return { kcal: mk, carbs: mc, protein: mp, fat: mf };
    }
    if (selectedHit) {
      const k = selectedHit.kcal_100;
      const c = selectedHit.carbs_100;
      const p = selectedHit.protein_100;
      const f = selectedHit.fat_100;
      if (k != null && c != null && p != null && f != null) {
        const factor = qg / 100;
        return {
          kcal: k * factor,
          carbs: c * factor,
          protein: p * factor,
          fat: f * factor,
        };
      }
    }
    return null;
  }, [quantityG, manualLabel, manualKcal, manualCarbs, manualProtein, manualFat, selectedHit]);

  const energyTargetKcal = useMemo(() => {
    if (
      planDateForSolverTargets &&
      entryDate === planDateForSolverTargets &&
      diaryEnergyTargetKcal != null &&
      diaryEnergyTargetKcal > 0
    ) {
      return diaryEnergyTargetKcal;
    }
    if (fallbackDailyEnergyKcal != null && fallbackDailyEnergyKcal > 0) return fallbackDailyEnergyKcal;
    return null;
  }, [planDateForSolverTargets, entryDate, diaryEnergyTargetKcal, fallbackDailyEnergyKcal]);

  const macroTargetsG = useMemo(() => {
    if (
      planDateForSolverTargets &&
      entryDate === planDateForSolverTargets &&
      diaryMacroTargetCarbsG != null &&
      diaryMacroTargetProteinG != null &&
      diaryMacroTargetFatG != null
    ) {
      return {
        carbs: diaryMacroTargetCarbsG,
        protein: diaryMacroTargetProteinG,
        fat: diaryMacroTargetFatG,
      };
    }
    return null;
  }, [
    planDateForSolverTargets,
    entryDate,
    diaryMacroTargetCarbsG,
    diaryMacroTargetProteinG,
    diaryMacroTargetFatG,
  ]);

  const diaryIntegrationHints = useMemo(() => {
    const lines: string[] = [];
    const w = weightKg != null && weightKg > 25 ? weightKg : null;
    const protFloor = w != null ? w * 1.2 : null;
    const pending = pendingFromForm ?? { kcal: 0, carbs: 0, protein: 0, fat: 0 };
    const after = {
      kcal: loggedForDate.kcal + pending.kcal,
      carbs: loggedForDate.carbs + pending.carbs,
      protein: loggedForDate.protein + pending.protein,
      fat: loggedForDate.fat + pending.fat,
    };
    if (protFloor != null && after.protein < protFloor * 0.82) {
      lines.push(
        `Proteine sotto ~${Math.round(protFloor)} g/giorno (stima da peso): più latticini/legumi/carne magra o integrazione se prescritta.`,
      );
    }
    if (energyTargetKcal != null && after.kcal > energyTargetKcal * 1.07) {
      lines.push("Con la voce in bozza superi il fabbisogno energetico giornaliero impostato.");
    }
    if (
      macroTargetsG &&
      energyTargetKcal != null &&
      after.carbs < macroTargetsG.carbs * 0.75 &&
      after.kcal > energyTargetKcal * 0.4
    ) {
      lines.push("CHO ancora bassi vs target giornaliero: aggiungi amidi o frutta a fine giornata.");
    }
    return lines.slice(0, 3);
  }, [weightKg, pendingFromForm, loggedForDate, energyTargetKcal, macroTargetsG]);

  const range = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 45);
    const future = new Date();
    future.setDate(end.getDate() + 7);
    return {
      from: start.toISOString().slice(0, 10),
      to: future.toISOString().slice(0, 10),
    };
  }, []);

  const reload = useCallback(async () => {
    if (!athleteId) {
      setEntries([]);
      complianceCbRef.current([]);
      return;
    }
    setLoading(true);
    setLoadError(null);
    const res = await fetchFoodDiary({ athleteId, from: range.from, to: range.to });
    setLoading(false);
    if (res.error) {
      setLoadError(res.error);
      setEntries([]);
      complianceCbRef.current([]);
      return;
    }
    setEntries(res.entries);
    complianceCbRef.current(entriesToComplianceRows(res.entries));
  }, [athleteId, range.from, range.to]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!athleteId) {
      setMicroRollup(null);
      return;
    }
    let cancelled = false;
    setMicroLoading(true);
    setMicroError(null);
    void (async () => {
      try {
        const headers = await buildSupabaseAuthHeaders();
        const res = await fetch(
          `/api/nutrition/diary/micronutrients?athleteId=${encodeURIComponent(athleteId)}&date=${encodeURIComponent(entryDate)}`,
          { headers },
        );
        const j = (await res.json().catch(() => ({}))) as MicroRollupResponse & { error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setMicroRollup(null);
          setMicroError(j.error ?? "Micronutrienti non caricati.");
          return;
        }
        setMicroRollup(j);
      } catch {
        if (!cancelled) {
          setMicroRollup(null);
          setMicroError("Errore di rete nel caricamento micronutrienti.");
        }
      } finally {
        if (!cancelled) setMicroLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [athleteId, entryDate, entries.length]);

  const entriesByMealForDay = useMemo(() => {
    const order = MEAL_SLOT_OPTIONS.map((o) => o.value);
    const map = new Map<FoodDiaryEntryViewModel["mealSlot"], FoodDiaryEntryViewModel[]>();
    for (const k of order) map.set(k, []);
    for (const e of entries) {
      if (e.entryDate !== entryDate) continue;
      const arr = map.get(e.mealSlot) ?? [];
      arr.push(e);
      map.set(e.mealSlot, arr);
    }
    return map;
  }, [entries, entryDate]);

  async function runLookup() {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    setLookupLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/nutrition/food-lookup?q=${encodeURIComponent(q)}`);
      const payload = (await res.json()) as { items?: LookupHit[]; error?: string };
      if (!res.ok) {
        setHits([]);
        setActionError(payload.error ?? `Ricerca fallita (HTTP ${res.status}).`);
        return;
      }
      setHits(Array.isArray(payload.items) ? payload.items : []);
    } catch {
      setHits([]);
      setActionError("Ricerca alimenti non riuscita.");
    } finally {
      setLookupLoading(false);
    }
  }

  async function addManualPortion() {
    if (!athleteId) return;
    const label = manualLabel.trim();
    const qg = Number(quantityG.replace(",", "."));
    const kcal = Number(manualKcal.replace(",", "."));
    const c = Number(manualCarbs.replace(",", "."));
    const p = Number(manualProtein.replace(",", "."));
    const f = Number(manualFat.replace(",", "."));
    if (label.length < 1) {
      setActionError("Inserisci il nome dell’alimento o del piatto.");
      return;
    }
    if (!Number.isFinite(qg) || qg <= 0) {
      setActionError("Quantità (g) non valida.");
      return;
    }
    if (![kcal, c, p, f].every((x) => Number.isFinite(x) && x >= 0)) {
      setActionError("Inserisci kcal e macro (g) per la porzione: numeri ≥ 0.");
      return;
    }
    const k100 = (kcal / qg) * 100;
    const c100 = (c / qg) * 100;
    const p100 = (p / qg) * 100;
    const f100 = (f / qg) * 100;
    setSaving(true);
    setActionError(null);
    const result = await postFoodDiaryEntry({
      athleteId,
      entryDate,
      mealSlot,
      mode: "scaled_reference",
      foodLabel: label.slice(0, 500),
      quantityG: qg,
      kcalPer100g: k100,
      carbsPer100g: c100,
      proteinPer100g: p100,
      fatPer100g: f100,
      sodiumMgPer100g: null,
      referenceSourceTag: "manual_portion",
      notes: notes.trim() || undefined,
      supplements: supplements.trim() || undefined,
    });
    setSaving(false);
    if (result.error) {
      setActionError(result.error);
      return;
    }
    setManualLabel("");
    setManualKcal("");
    setManualCarbs("");
    setManualProtein("");
    setManualFat("");
    setVisionNote(null);
    setSelectedHit(null);
    await reload();
  }

  async function runPhotoEstimate(file: File) {
    if (!athleteId) return;
    if (file.size > 5 * 1024 * 1024) {
      setActionError("Immagine troppo grande (max 5 MB).");
      return;
    }
    setPhotoLoading(true);
    setActionError(null);
    setVisionNote(null);
    const reader = new FileReader();
    reader.onerror = () => {
      setPhotoLoading(false);
      setActionError("Lettura file non riuscita.");
    };
    reader.onload = () => {
      void (async () => {
        try {
          const dataUrl = reader.result as string;
          const m = /^data:([^;]+);base64,(.*)$/i.exec(dataUrl);
          if (!m) {
            setActionError("Formato immagine non valido.");
            setPhotoLoading(false);
            return;
          }
          const mime = m[1] ?? "image/jpeg";
          const imageBase64 = m[2] ?? "";
          const res = await fetch("/api/nutrition/food-photo-estimate", {
            method: "POST",
            headers: await buildSupabaseAuthHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({ athleteId, imageBase64, mimeType: mime }),
          });
          const j = (await res.json().catch(() => ({}))) as {
            error?: string;
            estimate?: {
              label_it: string;
              portion_g_estimate: number | null;
              kcal_estimate: number | null;
              carbs_g: number | null;
              protein_g: number | null;
              fat_g: number | null;
              fdc_search_hint: string | null;
              notes_it: string | null;
            };
          };
          setPhotoLoading(false);
          if (!res.ok) {
            setActionError(j.error ?? "Analisi foto non riuscita.");
            return;
          }
          const e = j.estimate;
          if (!e) {
            setActionError("Nessuna stima dal modello vision.");
            return;
          }
          setManualLabel(e.label_it);
          if (e.portion_g_estimate != null && Number.isFinite(e.portion_g_estimate)) {
            setQuantityG(String(Math.max(10, Math.round(e.portion_g_estimate))));
          }
          if (e.kcal_estimate != null) setManualKcal(String(Math.round(e.kcal_estimate)));
          else setManualKcal("");
          if (e.carbs_g != null) setManualCarbs(String(Math.round(e.carbs_g * 10) / 10));
          else setManualCarbs("");
          if (e.protein_g != null) setManualProtein(String(Math.round(e.protein_g * 10) / 10));
          else setManualProtein("");
          if (e.fat_g != null) setManualFat(String(Math.round(e.fat_g * 10) / 10));
          else setManualFat("");
          if (e.fdc_search_hint?.trim()) setQuery(e.fdc_search_hint.trim());
          setSelectedHit(null);
          setVisionNote(e.notes_it ?? "Stima da immagine: verifica porzione e macro prima di salvare.");
        } catch {
          setPhotoLoading(false);
          setActionError("Errore durante l’analisi della foto.");
        }
      })();
    };
    reader.readAsDataURL(file);
  }

  async function addFromSelection() {
    if (!athleteId || !selectedHit) return;
    const qg = Number(quantityG.replace(",", "."));
    if (!Number.isFinite(qg) || qg <= 0) {
      setActionError("Inserisci un peso in grammi valido (> 0).");
      return;
    }
    setSaving(true);
    setActionError(null);
    let result;
    if (selectedHit.source === "usda" && selectedHit.fdcId != null && Number.isFinite(selectedHit.fdcId)) {
      result = await postFoodDiaryEntry({
        athleteId,
        entryDate,
        mealSlot,
        mode: "usda_fdc",
        fdcId: selectedHit.fdcId,
        quantityG: qg,
        notes: notes.trim() || undefined,
        supplements: supplements.trim() || undefined,
      });
    } else {
      const k = selectedHit.kcal_100;
      const c = selectedHit.carbs_100;
      const p = selectedHit.protein_100;
      const f = selectedHit.fat_100;
      if (k == null || c == null || p == null || f == null) {
        setActionError("Questo risultato non ha valori per 100g completi: scegli un altro alimento o uno USDA.");
        setSaving(false);
        return;
      }
      result = await postFoodDiaryEntry({
        athleteId,
        entryDate,
        mealSlot,
        mode: "scaled_reference",
        foodLabel: [selectedHit.brand, selectedHit.label].filter(Boolean).join(" · ") || selectedHit.label,
        quantityG: qg,
        kcalPer100g: k,
        carbsPer100g: c,
        proteinPer100g: p,
        fatPer100g: f,
        sodiumMgPer100g: selectedHit.sodium_mg_100,
        referenceSourceTag: `${selectedHit.source}`,
        notes: notes.trim() || undefined,
        supplements: supplements.trim() || undefined,
      });
    }
    setSaving(false);
    if (result.error) {
      setActionError(result.error);
      return;
    }
    setNotes("");
    setSelectedHit(null);
    await reload();
  }

  async function removeEntry(id: string) {
    if (!athleteId) return;
    setActionError(null);
    const res = await deleteFoodDiaryEntry({ athleteId, id });
    if (res.error) {
      setActionError(res.error);
      return;
    }
    await reload();
  }

  if (!athleteId) {
    return (
      <section className="viz-card builder-panel" style={{ marginBottom: 12, opacity: 0.92 }}>
        <p className="muted-copy" style={{ margin: 0 }}>
          Seleziona un atleta attivo per usare il diario alimentare persistente.
        </p>
      </section>
    );
  }

  const pendTotals = pendingFromForm ?? { kcal: 0, carbs: 0, protein: 0, fat: 0 };
  const afterDay = {
    kcal: loggedForDate.kcal + pendTotals.kcal,
    carbs: loggedForDate.carbs + pendTotals.carbs,
    protein: loggedForDate.protein + pendTotals.protein,
    fat: loggedForDate.fat + pendTotals.fat,
  };
  const targetK = energyTargetKcal != null ? Math.round(energyTargetKcal) : null;
  const remKcal =
    targetK != null ? Math.max(0, Math.round(targetK - afterDay.kcal)) : null;
  const overKcal = targetK != null && afterDay.kcal > targetK ? Math.round(afterDay.kcal - targetK) : null;
  const macroSub = (c: number, p: number, f: number) => (
    <div className="nutrition-diary-tile-macros">
      <span>
        <abbr title="Carboidrati">CHO</abbr> {Math.round(c)} g
      </span>
      <span>
        <abbr title="Proteine">PRO</abbr> {Math.round(p)} g
      </span>
      <span>
        <abbr title="Grassi">FAT</abbr> {Math.round(f)} g
      </span>
    </div>
  );
  const remMacroSub =
    macroTargetsG != null
      ? macroSub(
          Math.max(0, macroTargetsG.carbs - afterDay.carbs),
          Math.max(0, macroTargetsG.protein - afterDay.protein),
          Math.max(0, macroTargetsG.fat - afterDay.fat),
        )
      : null;

  return (
    <section className="viz-card builder-panel nutrition-diary-shell" style={{ marginBottom: 12 }}>
      <header style={{ marginBottom: 18 }}>
        <h3 className="viz-title" style={{ marginBottom: 8 }}>
          Diario alimentare
        </h3>
        <p className="muted-copy" style={{ margin: 0, fontSize: "0.88rem", lineHeight: 1.5 }}>
          Registra cosa mangi: foto o ricerca, quantità e pasto. I numeri grandi sono stime sul tuo fabbisogno del giorno.
        </p>
      </header>

      {loadError && (
        <div className="alert-warning" style={{ marginBottom: 12 }} role="status">
          {loadError}
        </div>
      )}
      {actionError && (
        <div className="alert-warning" style={{ marginBottom: 12 }} role="alert">
          {actionError}
        </div>
      )}

      <div className="nutrition-diary-summary-grid" style={{ marginBottom: 18 }}>
        <div className="nutrition-diary-tile nutrition-diary-tile--efficiency">
          <div className="nutrition-diary-tile-kicker">Efficienza metabolica</div>
          {metabolicEfficiencyIndex != null && Number.isFinite(metabolicEfficiencyIndex) ? (
            <>
              <div className="nutrition-diary-tile-metric">{Math.round(metabolicEfficiencyIndex)}</div>
              <div className="nutrition-diary-tile-foot">su 100 · modello interpretativo</div>
            </>
          ) : (
            <>
              <div className="nutrition-diary-tile-metric">—</div>
              <div className="nutrition-diary-tile-foot">Serve contesto recupero / allenamento</div>
            </>
          )}
        </div>
        <div className="nutrition-diary-tile nutrition-diary-tile--target">
          <div className="nutrition-diary-tile-kicker">Previsto oggi</div>
          <div className="nutrition-diary-tile-metric">{targetK != null ? `${targetK}` : "—"}</div>
          <div className="nutrition-diary-tile-unit">{targetK != null ? "kcal" : ""}</div>
          {macroTargetsG != null
            ? macroSub(macroTargetsG.carbs, macroTargetsG.protein, macroTargetsG.fat)
            : (
                <div className="nutrition-diary-tile-foot">
                  Allinea la data al giorno piano per i target macro
                </div>
              )}
        </div>
        <div className="nutrition-diary-tile nutrition-diary-tile--actual">
          <div className="nutrition-diary-tile-kicker">Assunto</div>
          <div className="nutrition-diary-tile-metric">{Math.round(afterDay.kcal)}</div>
          <div className="nutrition-diary-tile-unit">kcal</div>
          {macroSub(afterDay.carbs, afterDay.protein, afterDay.fat)}
          {pendTotals.kcal > 0 ? (
            <div className="nutrition-diary-tile-foot">Include la bozza in compilazione</div>
          ) : null}
        </div>
        <div className="nutrition-diary-tile nutrition-diary-tile--delta">
          <div className="nutrition-diary-tile-kicker">Mancante</div>
          {targetK != null ? (
            <>
              <div className="nutrition-diary-tile-metric">{overKcal != null && overKcal > 0 ? `+${overKcal}` : remKcal}</div>
              <div className="nutrition-diary-tile-unit">kcal</div>
              {overKcal != null && overKcal > 0 ? (
                <div className="nutrition-diary-tile-foot">Sopra il target giornaliero</div>
              ) : (
                remMacroSub
              )}
            </>
          ) : (
            <>
              <div className="nutrition-diary-tile-metric">—</div>
              <div className="nutrition-diary-tile-foot">Imposta fabbisogno o giorno piano</div>
            </>
          )}
        </div>
      </div>

      {diaryIntegrationHints.length ? (
        <p className="muted-copy nutrition-diary-hint-strip" style={{ fontSize: "0.8rem", margin: "0 0 18px", lineHeight: 1.45 }}>
          {diaryIntegrationHints.join(" · ")}
        </p>
      ) : null}

      <p className="muted-copy" style={{ fontSize: "0.78rem", margin: "-8px 0 16px", lineHeight: 1.45 }}>
        L’indice di efficienza combina segnali di recupero, adattamento e allenamento; se mancano dati il valore può restare simile per
        più giorni. Non è una diagnosi.
      </p>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <label className="muted-copy" style={{ fontSize: "0.82rem", margin: 0 }}>
          Giorno consumi
        </label>
        <input
          className="form-input"
          type="date"
          value={entryDate}
          onChange={(e) => setEntryDate(e.target.value)}
          style={{ maxWidth: 200 }}
        />
        {planDateAnchor && planDateAnchor !== entryDate ? (
          <button type="button" className="nutrition-ui-chip" onClick={() => setEntryDate(planDateAnchor)}>
            Allinea al giorno piano ({planDateAnchor})
          </button>
        ) : null}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
          gap: 20,
          alignItems: "start",
        }}
      >
        <div>
          <div className="nutrition-diary-action-row">
            <label className="nutrition-diary-big-btn">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: "none" }}
                disabled={photoLoading}
                onChange={(ev) => {
                  const f = ev.target.files?.[0];
                  ev.target.value = "";
                  if (f) void runPhotoEstimate(f);
                }}
              />
              {photoLoading ? "Analisi foto…" : "Foto del piatto"}
            </label>
            <button
              type="button"
              className="nutrition-diary-big-btn nutrition-diary-big-btn--ghost"
              onClick={() => document.getElementById("fd-search")?.focus()}
            >
              Cerca nel database
            </button>
          </div>
          {visionNote ? (
            <p className="muted-copy" style={{ fontSize: "0.78rem", marginBottom: 14, lineHeight: 1.45 }}>
              {visionNote}
            </p>
          ) : null}

          <div className="nutrition-diary-input-deck">
            <div className="nutrition-diary-mini-tile">
              <span className="nutrition-diary-mini-tile-label">Quantità</span>
              <input
                id="fd-qty"
                className="form-input nutrition-diary-qty-input"
                inputMode="decimal"
                value={quantityG}
                onChange={(e) => setQuantityG(e.target.value)}
                placeholder="120"
                aria-label="Quantità in grammi o millilitri approssimati"
              />
              <span className="nutrition-diary-mini-tile-hint">g · liquidi: usa ml ≈ g</span>
            </div>
            <div className="nutrition-diary-meal-picker" role="group" aria-label="Momento del pasto">
              {MEAL_SLOT_OPTIONS.map((o) => {
                const active = mealSlot === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    className={`nutrition-diary-meal-chip${active ? " nutrition-diary-meal-chip--active" : ""}`}
                    onClick={() => setMealSlot(o.value)}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          <details className="nutrition-diary-details" style={{ marginBottom: 18 }}>
            <summary>Inserimento manuale (piatti fatti in casa)</summary>
            <p className="muted-copy" style={{ fontSize: "0.78rem", marginBottom: 10, lineHeight: 1.45 }}>
              Stessi grammi del riquadro quantità. Controlla i valori dopo una foto, poi salva.
            </p>
            <div className="form-group">
              <label className="form-label" htmlFor="fd-manual-label">
                Nome alimento / piatto
              </label>
              <input
                id="fd-manual-label"
                className="form-input"
                value={manualLabel}
                onChange={(e) => setManualLabel(e.target.value)}
                placeholder="es. Pasta al pomodoro"
              />
            </div>
            <div className="form-grid-two">
              <div className="form-group">
                <label className="form-label" htmlFor="fd-manual-kcal">
                  Kcal (porzione)
                </label>
                <input
                  id="fd-manual-kcal"
                  className="form-input"
                  inputMode="decimal"
                  value={manualKcal}
                  onChange={(e) => setManualKcal(e.target.value)}
                  placeholder="es. 420"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="fd-manual-c">
                  Carboidrati (g)
                </label>
                <input
                  id="fd-manual-c"
                  className="form-input"
                  inputMode="decimal"
                  value={manualCarbs}
                  onChange={(e) => setManualCarbs(e.target.value)}
                  placeholder="es. 55"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="fd-manual-p">
                  Proteine (g)
                </label>
                <input
                  id="fd-manual-p"
                  className="form-input"
                  inputMode="decimal"
                  value={manualProtein}
                  onChange={(e) => setManualProtein(e.target.value)}
                  placeholder="es. 15"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="fd-manual-f">
                  Grassi (g)
                </label>
                <input
                  id="fd-manual-f"
                  className="form-input"
                  inputMode="decimal"
                  value={manualFat}
                  onChange={(e) => setManualFat(e.target.value)}
                  placeholder="es. 12"
                />
              </div>
            </div>
            <button type="button" className="btn-secondary" disabled={saving} onClick={() => void addManualPortion()}>
              {saving ? "Salvataggio…" : "Salva voce manuale"}
            </button>
          </details>

          <h4 className="section-title" style={{ fontSize: "0.95rem", marginBottom: 10 }}>
            Aggiungi da banca dati
          </h4>
          <div className="form-group">
            <label className="form-label" htmlFor="fd-search">
              Cerca alimento
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                id="fd-search"
                className="form-input"
                style={{ flex: 1, minWidth: 160 }}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void runLookup();
                }}
                placeholder="es. riso basmati cotto, yogurt greco…"
                autoComplete="off"
              />
              <button type="button" className="btn-secondary" disabled={lookupLoading} onClick={() => void runLookup()}>
                {lookupLoading ? "…" : "Cerca"}
              </button>
            </div>
          </div>
          {selectedHit ? (
            <div
              style={{
                marginBottom: 14,
                padding: 16,
                borderRadius: 12,
                border: "2px solid color-mix(in srgb, var(--empathy-accent, #0ea5e9) 65%, transparent)",
                background: "color-mix(in srgb, var(--empathy-accent, #0ea5e9) 14%, transparent)",
              }}
            >
              <div style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", opacity: 0.85 }}>HAI SCELTO</div>
              <div style={{ fontSize: "1.15rem", fontWeight: 800, marginTop: 8, lineHeight: 1.35 }}>
                {selectedHit.brand ? `${selectedHit.brand} · ` : ""}
                {selectedHit.label}
              </div>
              <div className="muted-copy" style={{ fontSize: "0.82rem", marginTop: 6, lineHeight: 1.5 }}>
                {selectedHit.source === "usda" ? "Database USDA" : selectedHit.source === "openfoodfacts" ? "Open Food Facts" : "Elenco interno"}
                {selectedHit.fdcId != null ? ` · codice ${selectedHit.fdcId}` : null}
              </div>
              {(() => {
                const qg = parseDecimalInput(quantityG);
                const okQ = Number.isFinite(qg) && qg > 0;
                const k100 = selectedHit.kcal_100;
                const c100 = selectedHit.carbs_100;
                const p100 = selectedHit.protein_100;
                const f100 = selectedHit.fat_100;
                const usdaDeferred =
                  selectedHit.source === "usda" &&
                  selectedHit.fdcId != null &&
                  (k100 == null || c100 == null || p100 == null || f100 == null);
                if (!okQ) {
                  return (
                    <p style={{ margin: "12px 0 0", fontSize: "0.9rem", lineHeight: 1.5 }}>
                      Imposta la <strong>quantità in grammi</strong> nel campo sopra: qui compariranno subito kcal e macro per la porzione.
                    </p>
                  );
                }
                if (usdaDeferred) {
                  return (
                    <p style={{ margin: "12px 0 0", fontSize: "0.9rem", lineHeight: 1.5 }}>
                      Per questa voce USDA i valori nutrizionali ufficiali vengono applicati <strong>al salvataggio</strong> (porzione{" "}
                      <strong>{qg} g</strong>). Poi li vedrai anche nel registro sotto.
                    </p>
                  );
                }
                if (k100 == null || c100 == null || p100 == null || f100 == null) {
                  return (
                    <p style={{ margin: "12px 0 0", fontSize: "0.9rem" }}>
                      Per questo risultato non abbiamo tutti i dati per 100 g: scegli un altro alimento o usa l’inserimento manuale.
                    </p>
                  );
                }
                const f = qg / 100;
                const kcal = Math.round(k100 * f);
                const carbs = Math.round(c100 * f * 10) / 10;
                const protein = Math.round(p100 * f * 10) / 10;
                const fat = Math.round(f100 * f * 10) / 10;
                return (
                  <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(112px, 1fr))", gap: 12 }}>
                    <div>
                      <div className="muted-copy" style={{ fontSize: "0.72rem" }}>Energia (stima)</div>
                      <div style={{ fontSize: "1.35rem", fontWeight: 800 }}>{kcal} kcal</div>
                    </div>
                    <div>
                      <div className="muted-copy" style={{ fontSize: "0.72rem" }}>Carboidrati</div>
                      <div style={{ fontSize: "1.15rem", fontWeight: 700 }}>{carbs} g</div>
                    </div>
                    <div>
                      <div className="muted-copy" style={{ fontSize: "0.72rem" }}>Proteine</div>
                      <div style={{ fontSize: "1.15rem", fontWeight: 700 }}>{protein} g</div>
                    </div>
                    <div>
                      <div className="muted-copy" style={{ fontSize: "0.72rem" }}>Grassi</div>
                      <div style={{ fontSize: "1.15rem", fontWeight: 700 }}>{fat} g</div>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            <p className="muted-copy" style={{ fontSize: "0.82rem", marginBottom: 10, lineHeight: 1.45 }}>
              Dopo la ricerca, <strong>tocca un alimento</strong> nell’elenco: qui sopra comparirà il nome e le kcal per la tua porzione.
            </p>
          )}
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              maxHeight: 320,
              overflowY: "auto",
              border: "1px solid var(--empathy-border-subtle, rgba(255,255,255,0.12))",
              borderRadius: 8,
            }}
            aria-label="Risultati ricerca alimenti"
          >
            {hits.map((h, i) => {
              const key = `${h.source}-${h.fdcId ?? i}-${h.label}-${i}`;
              const active = lookupHitSame(selectedHit, h);
              const usdaNoPreview = h.source === "usda" && h.fdcId != null && h.kcal_100 == null;
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => setSelectedHit(h)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 12px",
                      border: "none",
                      borderBottom: "1px solid var(--empathy-border-subtle, rgba(255,255,255,0.08))",
                      background: active ? "var(--empathy-surface-elevated, rgba(255,255,255,0.06))" : "transparent",
                      cursor: "pointer",
                      color: "inherit",
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{h.label}</div>
                    <div className="muted-copy" style={{ fontSize: "0.78rem", marginTop: 2 }}>
                      {h.brand ? `${h.brand} · ` : ""}
                      {h.source.toUpperCase()}
                      {h.fdcId != null ? ` · FDC ${h.fdcId}` : ""}
                      {h.kcal_100 != null ? ` · ${h.kcal_100} kcal/100g` : ""}
                      {usdaNoPreview ? " · nutrienti da FDC al salvataggio" : ""}
                    </div>
                  </button>
                </li>
              );
            })}
            {!hits.length && !lookupLoading && (
              <li className="muted-copy" style={{ padding: 12 }}>
                Nessun risultato. Inserisci almeno 2 caratteri e premi Cerca.
              </li>
            )}
          </ul>
          <div className="form-group" style={{ marginTop: 12 }}>
            <label className="form-label" htmlFor="fd-notes">
              Note
            </label>
            <textarea id="fd-notes" className="form-textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="fd-supp">
              Supplementi (testo libero)
            </label>
            <input id="fd-supp" className="form-input" value={supplements} onChange={(e) => setSupplements(e.target.value)} />
          </div>
          <button
            type="button"
            className="btn-nutrition-cta"
            disabled={saving || !selectedHit}
            onClick={() => void addFromSelection()}
          >
            {saving ? "Salvataggio…" : "Aggiungi al diario"}
          </button>
        </div>

        <div>
          <h4 className="section-title" style={{ fontSize: "0.95rem", marginBottom: 12 }}>
            Diario · {formatDateIt(entryDate)}
          </h4>
          {loading ? (
            <p className="muted-copy">Caricamento…</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {MEAL_SLOT_OPTIONS.map((slotOpt) => {
                const rows = entriesByMealForDay.get(slotOpt.value) ?? [];
                const slotK = rows.reduce((s, r) => s + r.kcal, 0);
                return (
                  <div key={slotOpt.value} className="nutrition-diary-meal-card">
                    <div className="nutrition-diary-meal-card-head">
                      <strong>{slotOpt.label}</strong>
                      <span className="muted-copy" style={{ fontSize: "0.8rem" }}>
                        {rows.length ? `~${Math.round(slotK)} kcal` : "vuoto"}
                      </span>
                    </div>
                    {rows.length ? (
                      <ul className="nutrition-diary-meal-list">
                        {rows.map((row) => (
                          <li key={row.id}>
                            <div>
                              <span style={{ fontWeight: 600 }}>{row.foodLabel}</span>
                              <span className="muted-copy" style={{ fontSize: "0.78rem", display: "block", marginTop: 2 }}>
                                {row.quantityG} g · {Math.round(row.kcal)} kcal · C {row.carbsG.toFixed(0)} / P{" "}
                                {row.proteinG.toFixed(0)} / F {row.fatG.toFixed(0)} · {provenanceLabel(row.provenance)}
                              </span>
                            </div>
                            <button
                              type="button"
                              className="btn-secondary nutrition-diary-meal-remove"
                              onClick={() => void removeEntry(row.id)}
                              aria-label={`Elimina ${row.foodLabel}`}
                            >
                              Elimina
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted-copy" style={{ fontSize: "0.8rem", margin: 0 }}>
                        Nessun alimento per questo pasto.
                      </p>
                    )}
                  </div>
                );
              })}
              {!entries.some((e) => e.entryDate === entryDate) ? (
                <p className="muted-copy" style={{ fontSize: "0.85rem", margin: 0 }}>
                  Nessuna voce per questa data. Usa foto, ricerca o inserimento manuale.
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div className="nutrition-diary-micro-board">
        {microLoading ? (
          <p className="muted-copy" style={{ fontSize: "0.88rem" }}>
            Caricamento…
          </p>
        ) : microError ? (
          <div className="alert-warning" style={{ marginBottom: 0 }}>
            {microError}
          </div>
        ) : microRollup && !(microRollup.ok === false && microRollup.reason === "no_usda_key") ? (
          <NutritionMicronutrientGrid {...diaryMicroRollupToGridProps(microRollup)} />
        ) : null}
      </div>
    </section>
  );
}
