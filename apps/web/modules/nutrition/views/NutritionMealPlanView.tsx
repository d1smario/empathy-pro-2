"use client";

import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";
import { ResearchTraceStatusSummary } from "@/components/nutrition/ResearchTraceStatusSummary";
import { AdaptationSectorStrip } from "@/components/nutrition/AdaptationSectorStrip";
import { NutritionDayKpiStrip } from "@/components/nutrition/NutritionDayKpiStrip";
import type { KnowledgeResearchTraceSummary } from "@/api/knowledge/contracts";
import type {
  FunctionalFoodRecommendationsViewModel,
  NutritionApplicationDirectiveViewModel,
  NutritionPathwayModulationViewModel,
} from "@/api/nutrition/contracts";
import type { AdaptationSectorBoxVm } from "@/lib/adaptation/adaptation-sector-box";
import {
  NutritionMicronutrientDailyBoard,
  mealPlanDayTotalsToMicroLines,
  type NutritionMicronutrientGridProps,
} from "@/modules/nutrition/components/NutritionMicronutrientGrid";
import type { IntelligentMealPlanResponseBody, MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";
import { sumVisibleSlotMacros } from "@/lib/nutrition/meal-exposition-helpers";
import {
  buildExpositionItemsFromPlan,
  EmpathyMealPlanExpositionCard,
  EmpathyMealPlanGlycemicLegend,
} from "@/modules/nutrition/components/EmpathyMealPlanExpositionCard";
import type { MealPathwaySlotBundle } from "@/modules/nutrition/types/meal-pathway-slot-bundle";
import type { PathwayMealSlotKey } from "@/lib/nutrition/pathway-meal-usda-slots";

export type MealPlanDisplayRow = {
  key: string;
  label: string;
  time: string;
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
  portionHint?: string;
};

export type NutritionMealPlanStateTone = "amber" | "cyan" | "green" | "rose" | "slate";

export type NutritionMealPlanEnergyLedger = {
  /** BMR + lifestyle + quota training destinata ai pasti (solver). */
  mealsKcalSolver: number | null;
  /** BMR + lifestyle + costo training completo (include parte gestita come fueling). */
  dailyKcalSolver: number | null;
  /** Parte del costo training allocata a pre/intra/post (non nei cinque slot pasto). */
  fuelingKcalSolver: number | null;
  /** Costo training pianificato del giorno (allineato al calendario/Builder; sostituito dall'eseguito quando importato). */
  trainingKcalSolver: number | null;
  /** Somma kcal voci USDA del piano generato (esclude voci coach nascoste). */
  assembledUsdaKcalSum: number | null;
};

export type NutritionMealPlanDailyTargetsProps = {
  complianceTargets: { kcal: number; carbs: number; protein: number; fat: number };
  dateLabel: string;
  hydrationMinDailyMl: number;
  selectedExecutedKj: number;
  sessionLoadKcalEstimate: number;
  round: (v: number, digits?: number) => number;
  /** Chiarimento 3954 vs 3555: pasti vs giornata vs fueling vs assemblaggio USDA. */
  energyLedger?: NutritionMealPlanEnergyLedger | null;
};

/** Blocco KPI giornaliero (stesso `viz-card` del subnav — renderlo subito sotto `NutritionSubnav`). */
export function NutritionMealPlanDailyTargets({
  complianceTargets,
  dateLabel,
  hydrationMinDailyMl,
  selectedExecutedKj,
  sessionLoadKcalEstimate,
  round,
  energyLedger,
}: NutritionMealPlanDailyTargetsProps) {
  const slotSumKcal = round(complianceTargets.kcal);
  const ledger = energyLedger ?? null;
  const showLedger =
    ledger &&
    (ledger.mealsKcalSolver != null ||
      ledger.dailyKcalSolver != null ||
      ledger.fuelingKcalSolver != null ||
      ledger.assembledUsdaKcalSum != null);

  return (
    <div>
      <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">Target giornaliero</p>
      <NutritionDayKpiStrip
        targets={{
          kcal: complianceTargets.kcal,
          carbsG: complianceTargets.carbs,
          proteinG: complianceTargets.protein,
          fatG: complianceTargets.fat,
        }}
        dateLabel={dateLabel}
      />
      {showLedger ? (
        <div
          className="mt-3 rounded-xl border border-slate-600/40 bg-slate-950/50 px-3 py-2.5 text-[11px] leading-relaxed text-slate-400"
          role="region"
          aria-label="Bilancio energetico giornaliero"
        >
          <p className="mb-1.5 font-mono text-[0.6rem] font-bold uppercase tracking-wider text-slate-500">Bilancio kcal · cosa stai sommando</p>
          <ul className="m-0 list-none space-y-1 p-0 font-mono">
            <li>
              <span className="text-slate-500">Σ slot pasto (griglia sopra):</span>{" "}
              <span className="font-semibold text-slate-200">{slotSumKcal} kcal</span>
            </li>
            {ledger.mealsKcalSolver != null ? (
              <li>
                <span className="text-slate-500">Target pasti solver (BMR+lifestyle+quota training sui pasti):</span>{" "}
                <span className="font-semibold text-cyan-100/90">{round(ledger.mealsKcalSolver)} kcal</span>
              </li>
            ) : null}
            {ledger.fuelingKcalSolver != null ? (
              <li>
                <span className="text-slate-500">Quota fueling (pre/intra/post, non nei pasti):</span>{" "}
                <span className="font-semibold text-amber-200/90">{round(ledger.fuelingKcalSolver)} kcal</span>
              </li>
            ) : null}
            {ledger.dailyKcalSolver != null ? (
              <li>
                <span className="text-slate-500">Totale metabolico giornata (BMR+lifestyle+allenamento):</span>{" "}
                <span className="font-semibold text-emerald-100/90">{round(ledger.dailyKcalSolver)} kcal</span>
              </li>
            ) : null}
            {ledger.trainingKcalSolver != null && ledger.trainingKcalSolver > 0 ? (
              <li>
                <span className="text-slate-500">Costo training pianificato (Builder, allineato al calendario):</span>{" "}
                <span className="text-slate-300">{round(ledger.trainingKcalSolver)} kcal</span>
              </li>
            ) : null}
            {ledger.assembledUsdaKcalSum != null ? (
              <li>
                <span className="text-slate-500">Σ piano USDA assemblato (voci alimenti):</span>{" "}
                <span className="font-semibold text-orange-100/95">{round(ledger.assembledUsdaKcalSum)} kcal</span>
                {ledger.mealsKcalSolver != null && ledger.mealsKcalSolver > 0 ? (
                  ledger.assembledUsdaKcalSum < ledger.mealsKcalSolver - 60 ? (
                    <span className="block pt-1 text-[10px] text-amber-300/90">
                      Sotto il target pasti solver: assemblaggio incompleto o porzioni conservative — prova a rigenerare il piano o rivedere le
                      voci.
                    </span>
                  ) : ledger.assembledUsdaKcalSum > ledger.mealsKcalSolver + 120 ? (
                    <span className="block pt-1 text-[10px] text-slate-500">
                      Sopra il target pasti solver: la somma USDA è orientativa (porzioni indicative) e non è vincolata slot-per-slot al
                      fabbisogno pasti del solver.
                    </span>
                  ) : null
                ) : null}
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
      <p className="mt-2 text-xs text-slate-500">
        Idratazione minima: <span className="font-semibold text-slate-300">{hydrationMinDailyMl} ml</span>
        {" · "}
        {selectedExecutedKj > 0 ? (
          <>
            Energia seduta (kj): <span className="font-semibold text-slate-300">{round(selectedExecutedKj)} kJ</span>
          </>
        ) : (
          <>
            Stima carico seduta: <span className="font-semibold text-slate-300">{round(sessionLoadKcalEstimate)} kcal</span>
          </>
        )}
      </p>
    </div>
  );
}

export type NutritionMealPlanLeadPanelsProps = {
  researchTraceSummaries: KnowledgeResearchTraceSummary[];
  nutritionSectorBoxes: AdaptationSectorBoxVm[];
  pathwayModulation: NutritionPathwayModulationViewModel | null;
  functionalFoodRecommendations: FunctionalFoodRecommendationsViewModel;
};

export function NutritionMealPlanLeadPanels({
  researchTraceSummaries,
  nutritionSectorBoxes,
  pathwayModulation,
  functionalFoodRecommendations,
}: NutritionMealPlanLeadPanelsProps) {
  const router = useRouter();
  return (
    <>
      {!!researchTraceSummaries.length ? (
        <section className="viz-card builder-panel" style={{ marginBottom: "12px" }}>
          <ResearchTraceStatusSummary traces={researchTraceSummaries} label="Research trace nutrizione" />
        </section>
      ) : null}

      <section className="viz-card builder-panel" style={{ marginBottom: "12px", padding: "12px 14px" }}>
        <AdaptationSectorStrip title="Settori · adattamento (giorno)" boxes={nutritionSectorBoxes} />
      </section>

      {functionalFoodRecommendations.targets.length ? (
        <section className="viz-card builder-panel" style={{ marginBottom: "12px", padding: "10px 14px", fontSize: "0.8rem" }}>
          <strong>Pillole nutrizionali adattive</strong>
          <span className="nutrition-muted"> — suggerimenti funzionali su segnali del giorno (L2, non override solver): </span>
          <span style={{ display: "inline-flex", flexWrap: "wrap", gap: "4px", verticalAlign: "middle" }}>
            {functionalFoodRecommendations.targets.slice(0, 8).map((t) => (
              <span
                key={t.nutrientId}
                className="nutrition-ui-chip"
                style={{ fontSize: "0.72rem" }}
                title={t.rationaleIt}
              >
                {t.displayNameIt.split("(")[0].trim()}
              </span>
            ))}
          </span>
          <button
            type="button"
            className="nutrition-ui-chip"
            style={{ marginLeft: "8px", cursor: "pointer" }}
            onClick={() => router.push("/nutrition/integration")}
          >
            Integrazione → OFF/USDA + FDC
          </button>
        </section>
      ) : null}
    </>
  );
}

export type NutritionMealPlanWorkspaceProps = {
  athleteId: string;
  role: string;
  /** Pasti attivi da Profile Diet (ordine + budget kcal); unica fonte ripartizione calorica. */
  mealPlanDisplayRows: MealPlanDisplayRow[];
  mealDisplayByKey: Map<MealSlotKey, MealPlanDisplayRow>;
  mealPathwayBySlot: Partial<Record<string, MealPathwaySlotBundle>>;
  pathwayModulation: NutritionPathwayModulationViewModel | null;
  /** Da `GET /api/nutrition/module` — allineato al selettore funzionale e alle contextLines del piano. */
  nutritionApplicationDirective: NutritionApplicationDirectiveViewModel | null;
  /** Note complete del selettore (incl. direttiva / patch / integrazione). */
  functionalMealSelectorNotes: string[] | null;
  intelligentMealPlan: IntelligentMealPlanResponseBody | null;
  intelligentMealLoading: boolean;
  intelligentMealError: string | null;
  canRequestIntelligentPlan: boolean;
  /** True mentre i fetch USDA per i 5 slot non sono completati (il pulsante resta disabilitato). */
  mealPathwayCatalogPending?: boolean;
  /** Se Diet non è configurato per il giorno della data selezionata. */
  dietDayNotice?: string | null;
  /** Giornata gara: regola fissa pasta/riso T−3 h (non dipende da USDA pathway). */
  raceDayPreRaceNotice?: string | null;
  onGenerateIntelligentMealPlan: () => void;
  onResetIntelligentMealPlan: () => void;
  coachMealRemovalKeys: Set<string>;
  coachSessionFoodExclusions: string[];
  onCoachShowAllItems: () => void;
  onCoachClearSessionExclusions: () => void;
  removeCoachMealPlanItem: (slot: MealSlotKey, index: number, label: string) => void;
  persistFoodExclusionToProfile: (slot: MealSlotKey, index: number, label: string) => void | Promise<void>;
  profileFoodExcludeBusy: string | null;
  mealTabMicronutrientProps: NutritionMicronutrientGridProps;
  nutritionStateCards: Array<{ label: string; value: string; tone: NutritionMealPlanStateTone }>;
  saving: boolean;
  onSaveNutrition: () => void;
};

export function NutritionMealPlanWorkspace({
  athleteId,
  role,
  mealPlanDisplayRows,
  mealDisplayByKey,
  mealPathwayBySlot,
  pathwayModulation,
  nutritionApplicationDirective,
  functionalMealSelectorNotes,
  intelligentMealPlan,
  intelligentMealLoading,
  intelligentMealError,
  canRequestIntelligentPlan,
  mealPathwayCatalogPending = false,
  dietDayNotice = null,
  raceDayPreRaceNotice = null,
  onGenerateIntelligentMealPlan,
  onResetIntelligentMealPlan,
  coachMealRemovalKeys,
  coachSessionFoodExclusions,
  onCoachShowAllItems,
  onCoachClearSessionExclusions,
  removeCoachMealPlanItem,
  persistFoodExclusionToProfile,
  profileFoodExcludeBusy,
  mealTabMicronutrientProps,
  nutritionStateCards,
  saving,
  onSaveNutrition,
}: NutritionMealPlanWorkspaceProps) {
  const router = useRouter();
  const hasApplicativeContext = Boolean(nutritionApplicationDirective) || Boolean(functionalMealSelectorNotes?.length);
  const mealPlanMicroBoardProps = intelligentMealPlan?.nutrientRollup?.dayTotals
    ? mealPlanDayTotalsToMicroLines(intelligentMealPlan.nutrientRollup.dayTotals)
    : mealTabMicronutrientProps;

  return (
    <>
      <section id="nutrition-meal-plan" className="scroll-mt-28 mb-10 space-y-4">
        <section className="viz-card builder-panel" style={{ marginBottom: "12px" }}>
          <p className="mb-3 text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">Piano pasti · giorno selezionato</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 10 }}>
            <button
              type="button"
              className="btn-nutrition-cta"
              disabled={!athleteId || intelligentMealLoading || !canRequestIntelligentPlan}
              onClick={() => void onGenerateIntelligentMealPlan()}
            >
              {intelligentMealLoading ? "Generazione piano…" : "Genera il mio piano pasti"}
            </button>
            {intelligentMealPlan ? (
              <button type="button" className="nutrition-ui-chip" onClick={onResetIntelligentMealPlan}>
                Rigenera piano
              </button>
            ) : null}
            {intelligentMealPlan?.layer === "deterministic_meal_assembly_v1" ? (
              <span className="nutrition-ui-chip text-[0.7rem] text-slate-400">Assemblaggio deterministico server</span>
            ) : null}
          </div>
          {mealPathwayCatalogPending ? (
            <p className="mb-3 text-xs text-slate-500">Caricamento integrazione USDA per gli slot pasto del giorno… poi potrai generare il piano.</p>
          ) : null}
          {raceDayPreRaceNotice ? (
            <p className="mb-3 rounded-lg border border-fuchsia-500/40 bg-fuchsia-500/10 px-3 py-2 text-xs text-fuchsia-100" role="status">
              {raceDayPreRaceNotice}
            </p>
          ) : null}
          {dietDayNotice ? (
            <p className="mb-3 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100" role="status">
              {dietDayNotice}
            </p>
          ) : null}
          {hasApplicativeContext ? (
            <div
              className="mb-3 rounded-lg border border-emerald-600/25 bg-emerald-950/20 px-3 py-2.5 text-[12px] leading-relaxed text-slate-300"
              role="region"
              aria-label="Contesto applicativo"
            >
              <p className="mb-2 font-mono text-[0.6rem] font-bold uppercase tracking-wider text-emerald-400/90">Contesto applicativo</p>
              {nutritionApplicationDirective ? (
                <ul className="m-0 mb-2 list-none space-y-1 p-0 text-slate-300">
                  {nutritionApplicationDirective.rationale.map((line, i) => (
                    <li key={`dir-r-${i}`} className="pl-0">
                      {line}
                    </li>
                  ))}
                  <li className="font-mono text-[0.65rem] text-slate-400">
                    Focus: {nutritionApplicationDirective.focus.join(", ") || "—"} · applicate{" "}
                    {nutritionApplicationDirective.appliedCount} · in attesa {nutritionApplicationDirective.pendingCount}
                    {typeof nutritionApplicationDirective.coachValidatedMemoryCount === "number"
                      ? ` · memoria coach validate ${nutritionApplicationDirective.coachValidatedMemoryCount}`
                      : null}
                  </li>
                </ul>
              ) : null}
              {functionalMealSelectorNotes?.length ? (
                <details className="rounded border border-slate-600/35 bg-slate-950/40 px-2 py-1.5 text-slate-400">
                  <summary className="cursor-pointer select-none text-[11px] font-semibold text-slate-300">
                    Note selettore pasti funzionale (allineate a patch + direttiva)
                  </summary>
                  <ul className="mt-2 mb-0 list-disc space-y-1 pl-4 text-[11px]">
                    {functionalMealSelectorNotes.map((n, i) => (
                      <li key={`fms-${i}`}>{n}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          ) : null}
          {intelligentMealError ? (
            <div className="alert-error" style={{ marginBottom: 10, fontSize: 13 }}>
              {intelligentMealError}
              {/\b503\b|timeout|ECONNRESET/i.test(intelligentMealError)
                ? " — server temporaneamente non disponibile o timeout: riprova tra poco."
                : null}
            </div>
          ) : null}
          {intelligentMealPlan?.pathwayBoostStatus === "usda_cache_miss" ? (
            <div
              className="mb-3 rounded-lg border border-amber-500/30 bg-amber-950/25 px-3 py-2 text-[12px] leading-relaxed text-amber-100/90"
              role="status"
            >
              Pathway attivo: swap alimenti applicati nel piano, ma la cache USDA (ranking top alimenti) non è
              disponibile. Popola `nutrition_fdc_foods` o riprova più tardi per i suggerimenti densità-nutriente.
            </div>
          ) : null}
          {intelligentMealPlan?.pathwayTargetRollup?.length ? (
            <div
              className="mb-3 rounded-lg border border-fuchsia-500/25 bg-fuchsia-950/20 px-3 py-2 text-[12px] leading-relaxed text-zinc-200"
              role="status"
            >
              <p className="mb-2 font-semibold text-fuchsia-200/90">Pathway · target vs rollup giorno</p>
              <ul className="mb-0 grid gap-1 sm:grid-cols-2">
                {intelligentMealPlan.pathwayTargetRollup.map((line) => (
                  <li key={line.nutrientId} className="flex items-baseline justify-between gap-2">
                    <span className="text-zinc-300">{line.labelIt}</span>
                    <span className={line.status === "met" ? "text-emerald-300" : "text-amber-300"}>
                      {line.dayValue} {line.unit} / ≥{line.floor} {line.unit}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {intelligentMealPlan ? (
            <>
              <div className="empathy-meal-plan-expo-shell">
                {coachMealRemovalKeys.size > 0 || coachSessionFoodExclusions.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 12 }}>
                    <span className="muted-copy" style={{ fontSize: 12 }}>
                      Modifiche coach: {coachMealRemovalKeys.size} voci nascoste
                      {coachSessionFoodExclusions.length ? ` · ${coachSessionFoodExclusions.length} esclusioni per rigenerazione` : ""}
                    </span>
                    <button type="button" className="nutrition-ui-chip" onClick={onCoachShowAllItems}>
                      Mostra tutte le voci
                    </button>
                    <button type="button" className="nutrition-ui-chip" onClick={onCoachClearSessionExclusions}>
                      Azzera esclusioni sessione
                    </button>
                  </div>
                ) : null}
                <div className="empathy-meal-expo-grid">
                  {mealPlanDisplayRows.map((mealRow) => {
                    const slotKey = mealRow.key as MealSlotKey;
                    const sl = intelligentMealPlan.slots.find((s) => s.slot === slotKey);
                    const meta = intelligentMealPlan.solverBasis.slots.find((x) => x.slot === slotKey);
                    const isVis = (ii: number) => !coachMealRemovalKeys.has(`${slotKey}:${ii}`);
                    const fallback = {
                      kcal: meta?.targetKcal ?? 0,
                      carbsG: meta?.targetCarbsG ?? 0,
                      proteinG: meta?.targetProteinG ?? 0,
                      fatG: meta?.targetFatG ?? 0,
                    };
                    if (!sl) {
                      return (
                        <EmpathyMealPlanExpositionCard
                          key={slotKey}
                          slot={slotKey}
                          titleUpper={(meta?.labelIt ?? mealRow.label).toUpperCase()}
                          subline={meta?.scheduledTimeLocal?.trim() || mealRow.time}
                          totalKcal={fallback.kcal}
                          carbsG={fallback.carbsG}
                          proteinG={fallback.proteinG}
                          fatG={fallback.fatG}
                          items={[]}
                        />
                      );
                    }
                    const itemTotals = sumVisibleSlotMacros(sl, isVis, fallback);
                    /** Header pasto: target % profilo (solver), non somma USDA delle voci (spesso sbilancia colazione vs pranzo). */
                    const totals = {
                      kcal: fallback.kcal > 0 ? fallback.kcal : itemTotals.kcal,
                      carbsG: fallback.carbsG > 0 ? fallback.carbsG : itemTotals.carbsG,
                      proteinG: fallback.proteinG > 0 ? fallback.proteinG : itemTotals.proteinG,
                      fatG: fallback.fatG > 0 ? fallback.fatG : itemTotals.fatG,
                    };
                    const expoItems = buildExpositionItemsFromPlan(sl.items, isVis);
                    return (
                      <EmpathyMealPlanExpositionCard
                        key={slotKey}
                        slot={slotKey}
                        titleUpper={(meta?.labelIt ?? mealRow.label).toUpperCase()}
                        subline={meta?.scheduledTimeLocal?.trim() || mealRow.time}
                        totalKcal={totals.kcal}
                        carbsG={totals.carbsG}
                        proteinG={totals.proteinG}
                        fatG={totals.fatG}
                        items={expoItems}
                        boostNote={sl.boostNote}
                        integrationHref="/nutrition/integration"
                        showCoachControls={role === "coach"}
                        athleteId={athleteId}
                        profileFoodExcludeBusyLabel={profileFoodExcludeBusy}
                        onCoachRemove={(si) => {
                          const it = sl.items[si];
                          if (it) removeCoachMealPlanItem(slotKey, si, it.name);
                        }}
                        onCoachExcludeProfile={(si) => {
                          const it = sl.items[si];
                          if (it) void persistFoodExclusionToProfile(slotKey, si, it.name);
                        }}
                      />
                    );
                  })}
                </div>
                <EmpathyMealPlanGlycemicLegend />
                <div className="mt-2 rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-2 font-mono text-sm font-bold text-orange-50">
                  Σ USDA assemblato · ~
                  {intelligentMealPlan.slots.reduce((acc, sl) => {
                    const sk = sl.slot as MealSlotKey;
                    return (
                      acc +
                      sl.items.reduce(
                        (a, it, ii) => (coachMealRemovalKeys.has(`${sk}:${ii}`) ? a : a + it.approxKcal),
                        0,
                      )
                    );
                  }, 0)}{" "}
                  kcal
                  <span className="mt-1 block text-[10px] font-normal font-sans text-orange-200/80">
                    Non è il totale metabolico giornata: vedi «Bilancio kcal» sopra per pasti vs fueling vs giornata.
                  </span>
                </div>
              </div>
              <details className="collapsible-card" style={{ marginBottom: 12 }}>
                <summary style={{ fontSize: 13, cursor: "pointer" }}>Avviso legale e note aggiuntive</summary>
                <p className="muted-copy" style={{ fontSize: 12, marginTop: 8, lineHeight: 1.45 }}>
                  {intelligentMealPlan.disclaimer}
                </p>
                <p className="muted-copy" style={{ fontSize: 12, lineHeight: 1.45 }}>
                  {intelligentMealPlan.dayInteractionSummary}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => router.push("/nutrition/integration")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-fuchsia-400/40 bg-fuchsia-500/10 px-3 py-1.5 text-[11px] font-semibold text-fuchsia-100 hover:bg-fuchsia-500/20 hover:text-fuchsia-50"
                  >
                    <Zap className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
                    Vai a Integrazione →
                  </button>
                  <span className="text-[10px] text-slate-400/80">
                    Tutti i punti operativi (cofactors, leve solver, prodotti) sono raccolti nel modulo Integrazione.
                  </span>
                </div>
              </details>
              <details className="collapsible-card" style={{ marginBottom: 12 }}>
                <summary style={{ fontSize: 13, cursor: "pointer" }}>
                  Numeri tecnici del giorno (allenamento, routine, target per pasto)
                </summary>
                <div className="muted-copy" style={{ fontSize: 11, marginTop: 8, lineHeight: 1.45 }}>
                  <p style={{ marginBottom: 8 }}>
                    Questo piano <strong>combina</strong> i target della griglia (kcal/macro per pasto da modello giornaliero con seduta
                    selezionata) con l&apos;assemblaggio delle voci alimentari. Σ kcal pasti:{" "}
                    <strong>{intelligentMealPlan.solverBasis.dailyMealsKcalTotal}</strong> · data {intelligentMealPlan.solverBasis.planDate}
                  </p>
                  {intelligentMealPlan.solverBasis.profileConstraintLines.length ? (
                    <ul style={{ margin: "0 0 8px 18px" }}>
                      {intelligentMealPlan.solverBasis.profileConstraintLines.map((l) => (
                        <li key={l}>{l}</li>
                      ))}
                    </ul>
                  ) : null}
                  {intelligentMealPlan.solverBasis.pathwayModulationActiveLabels?.trim() ? (
                    <p style={{ marginBottom: 8 }}>
                      <strong>Pathway modulation attivi</strong>:{" "}
                      {intelligentMealPlan.solverBasis.pathwayModulationActiveLabels.trim()}
                      {" · "}
                      <span className="text-slate-400">
                        I boost micronutrienti nelle note seguono i cofactors di questi pathway, non la lista alimenti del composer.
                      </span>
                    </p>
                  ) : null}
                  {intelligentMealPlan.solverBasis.integrationLeverLines.length ? (
                    <p style={{ marginBottom: 8 }}>
                      <strong>Integrazione operativa (solver)</strong>: {intelligentMealPlan.solverBasis.integrationLeverLines.join(" · ")}
                    </p>
                  ) : null}
                  {intelligentMealPlan.solverBasis.routineDigest ? (
                    <p style={{ marginBottom: 8 }}>
                      <strong>Routine</strong>: {intelligentMealPlan.solverBasis.routineDigest}
                    </p>
                  ) : null}
                  {intelligentMealPlan.solverBasis.trainingDayLines.length ? (
                    <p style={{ marginBottom: 8 }}>
                      <strong>Training sul giorno</strong>: {intelligentMealPlan.solverBasis.trainingDayLines.join(" | ")}
                    </p>
                  ) : null}
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 10 }}>
                    {intelligentMealPlan.solverBasis.slots.map((s) => (
                      <li key={s.slot}>
                        {s.labelIt} {s.scheduledTimeLocal ? `@ ${s.scheduledTimeLocal}` : ""}: {s.targetKcal} kcal · {s.targetCarbsG} CHO ·{" "}
                        {s.targetProteinG} PRO · {s.targetFatG} grassi
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
              {intelligentMealPlan.hydrationRoutine ? (
                <details className="collapsible-card" style={{ marginBottom: 12 }}>
                  <summary style={{ fontSize: 13, cursor: "pointer" }}>Quanto bere oggi (acqua e sali) — dettaglio</summary>
                  <p className="nutrition-muted" style={{ fontSize: 11, marginTop: 8, lineHeight: 1.45 }}>
                    Target fluido giornaliero stimato ~{intelligentMealPlan.hydrationRoutine.totalTargetMl} ml (baseline{" "}
                    {intelligentMealPlan.hydrationRoutine.baselineDailyMl} ml + extra training ~{intelligentMealPlan.hydrationRoutine.trainingExtraMl}{" "}
                    ml). Valori educativi, adatta a clima e sudorazione.
                  </p>
                  <div className="table-shell" style={{ marginTop: 10, overflowX: "auto" }}>
                    <table style={{ fontSize: 11, minWidth: 720 }}>
                      <thead>
                        <tr>
                          <th>Finestra</th>
                          <th>Orario</th>
                          <th>Volume (ml)</th>
                          <th>Na (mg)</th>
                          <th>K (mg)</th>
                          <th>Mg (mg)</th>
                          <th>Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {intelligentMealPlan.hydrationRoutine.windows.map((w, wi) => (
                          <tr key={`hyd-${wi}-${w.labelIt}`}>
                            <td>{w.labelIt}</td>
                            <td>{w.scheduledTimeLocal}</td>
                            <td>{w.volumeMl}</td>
                            <td>{w.sodiumMg}</td>
                            <td>{w.potassiumMg}</td>
                            <td>{w.magnesiumMg}</td>
                            <td className="nutrition-muted" style={{ maxWidth: 280 }}>
                              {w.notesIt}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              ) : null}
            </>
          ) : null}
          {!intelligentMealPlan ? (
            <div className="empathy-meal-plan-expo-shell">
              <p className="mb-3 text-center text-[12px] leading-snug text-slate-400">
                {intelligentMealLoading
                  ? "Sto generando il piano pasti allineato al tuo profilo (solver deterministico + USDA)…"
                  : canRequestIntelligentPlan
                    ? "Pronto a generare il piano. Auto-generazione in corso…"
                    : mealPathwayCatalogPending
                      ? "Caricamento catalogo USDA per il giorno selezionato…"
                      : "Profile → Diet richiede ripartizione % per pasto. Salva il profilo e ricarica."}
              </p>
              <div className="empathy-meal-expo-grid">
                {/* Scheletro card con solo i target del solver. Nessun item farlocco
                    (in passato il piano base distribuiva kcal_target/n_righe a ciascun
                    alimento, producendo numeri irrealistici tipo 1 banana = 320 kcal). */}
                {mealPlanDisplayRows.map((meal) => {
                  const slotKey = meal.key as PathwayMealSlotKey;
                  const bundle = mealPathwayBySlot[slotKey];
                  const subline = !bundle || bundle.loading
                    ? `${meal.time} · caricamento pathway`
                    : intelligentMealLoading
                      ? `${meal.time} · generazione in corso`
                      : meal.time;
                  return (
                    <EmpathyMealPlanExpositionCard
                      key={slotKey}
                      slot={slotKey}
                      titleUpper={meal.label.toUpperCase()}
                      subline={subline}
                      totalKcal={meal.kcal}
                      carbsG={meal.carbs}
                      proteinG={meal.protein}
                      fatG={meal.fat}
                      items={[]}
                    />
                  );
                })}
              </div>
              <EmpathyMealPlanGlycemicLegend />
              <p className="muted-copy mt-3 text-center text-[11px] leading-snug text-slate-500">
                Pathway, USDA e ricerca FDC:{" "}
                <button
                  type="button"
                  className="nutrition-ui-chip align-middle text-[11px]"
                  onClick={() => router.push("/nutrition/integration")}
                >
                  Apri Integrazione
                </button>
              </p>
            </div>
          ) : null}
          <section className="nutrition-report-shell">
            <div className="nutrition-meal-plan-micro">
              <NutritionMicronutrientDailyBoard {...mealPlanMicroBoardProps} />
            </div>
          </section>
          <div className="kpi-grid nutrition-score-grid">
            {nutritionStateCards.map((card) => (
              <div key={card.label} className={`kpi-card signal-board-card tone-${card.tone} nutrition-score-card`}>
                <div className="kpi-card-label">
                  <span className="signal-board-dot" />
                  {card.label}
                </div>
                <div className="kpi-card-value">{card.value}</div>
              </div>
            ))}
          </div>
        </section>
      </section>

      <section className="viz-card builder-panel">
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" disabled={saving} className="btn-nutrition-cta" onClick={onSaveNutrition}>
            {saving ? "Salvataggio..." : "Salva Nutrition/Nutriomics"}
          </button>
        </div>
      </section>
    </>
  );
}
