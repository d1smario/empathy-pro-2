"use client";

import { useRouter } from "next/navigation";
import { ResearchTraceStatusSummary } from "@/components/nutrition/ResearchTraceStatusSummary";
import { AdaptationSectorStrip } from "@/components/nutrition/AdaptationSectorStrip";
import { NutritionDayKpiStrip } from "@/components/nutrition/NutritionDayKpiStrip";
import type { KnowledgeResearchTraceSummary } from "@/api/knowledge/contracts";
import type {
  FunctionalFoodRecommendationsViewModel,
  NutritionModuleViewModel,
  NutritionPathwayModulationViewModel,
} from "@/api/nutrition/contracts";
import type { AdaptationSectorBoxVm } from "@/lib/adaptation/adaptation-sector-box";
import {
  NutritionMicronutrientDailyBoard,
  mealPlanDayTotalsToMicroLinesComplete,
  type NutritionMicronutrientGridProps,
} from "@/modules/nutrition/components/NutritionMicronutrientGrid";
import { buildFunctionalFoodOptionGroupsForSlot } from "@/lib/nutrition/functional-food-option-groups";
import { buildDryMealPlanLinesForSlot } from "@/lib/nutrition/dry-meal-plan-lines";
import { filterFunctionalFoodGroupsForMealSlot } from "@/lib/nutrition/meal-slot-food-rules";
import type { IntelligentMealPlanResponseBody, MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";
import { buildExpositionItemsFromDryLines, sumVisibleSlotMacros } from "@/lib/nutrition/meal-exposition-helpers";
import {
  buildExpositionItemsFromPlan,
  EmpathyMealPlanExpositionCard,
  EmpathyMealPlanGlycemicLegend,
} from "@/modules/nutrition/components/EmpathyMealPlanExpositionCard";
import { NUTRITION_MEAL_GRID } from "@/modules/nutrition/constants/nutrition-meal-plan-grid";
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
  /** kcal training dopo scala integrazione (prima del split pasti/fueling). */
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
                <span className="text-slate-500">Costo training stimato (dopo integrazione):</span>{" "}
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

      {pathwayModulation &&
      pathwayModulation.pathways.length === 0 &&
      functionalFoodRecommendations.targets.length ? (
        <section className="viz-card builder-panel" style={{ marginBottom: "12px", padding: "10px 14px", fontSize: "0.8rem" }}>
          <strong>Alimenti funzionali (catalogo)</strong>
          <span className="nutrition-muted"> — target sul giorno: </span>
          <span style={{ display: "inline-flex", flexWrap: "wrap", gap: "4px", verticalAlign: "middle" }}>
            {functionalFoodRecommendations.targets.slice(0, 6).map((t) => (
              <span key={t.nutrientId} className="nutrition-ui-chip" style={{ fontSize: "0.72rem" }}>
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
  mealDisplayByKey: Map<MealSlotKey, MealPlanDisplayRow>;
  mealPathwayBySlot: Partial<Record<string, MealPathwaySlotBundle>>;
  pathwayModulation: NutritionPathwayModulationViewModel | null;
  /** Da `GET /api/nutrition/module` — allineato al selettore funzionale e alle contextLines del piano. */
  nutritionApplicationDirective: NutritionModuleViewModel["nutritionApplicationDirective"] | null;
  /** Note complete del selettore (incl. direttiva / patch / integrazione). */
  functionalMealSelectorNotes: string[] | null;
  intelligentMealPlan: IntelligentMealPlanResponseBody | null;
  intelligentMealLoading: boolean;
  intelligentMealError: string | null;
  canRequestIntelligentPlan: boolean;
  /** True mentre i fetch USDA per i 5 slot non sono completati (il pulsante resta disabilitato). */
  mealPathwayCatalogPending?: boolean;
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
    ? mealPlanDayTotalsToMicroLinesComplete(intelligentMealPlan.nutrientRollup.dayTotals)
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
                Torna al piano base
              </button>
            ) : null}
            {intelligentMealPlan?.layer === "deterministic_meal_assembly_v1" ? (
              <span className="nutrition-ui-chip text-[0.7rem] text-slate-400">Assemblaggio deterministico server</span>
            ) : null}
          </div>
          {mealPathwayCatalogPending ? (
            <p className="mb-3 text-xs text-slate-500">Caricamento integrazione USDA per i cinque slot pasto… poi potrai generare il piano.</p>
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
                  {NUTRITION_MEAL_GRID.map((spec) => {
                    if (spec.key === "pre_sleep") {
                      return (
                        <EmpathyMealPlanExpositionCard
                          key="pre_sleep"
                          slot="pre_sleep"
                          titleUpper={spec.labelIt.toUpperCase()}
                          subline="Opzionale · fuori solver 5 slot"
                          totalKcal={0}
                          carbsG={0}
                          proteinG={0}
                          fatG={0}
                          items={[]}
                          placeholder
                        />
                      );
                    }
                    const sl = intelligentMealPlan.slots.find((s) => s.slot === spec.key);
                    const meta = intelligentMealPlan.solverBasis.slots.find((x) => x.slot === spec.key);
                    const slotKey = spec.key as MealSlotKey;
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
                          key={spec.key}
                          slot={slotKey}
                          titleUpper={(meta?.labelIt ?? spec.labelIt).toUpperCase()}
                          subline={meta?.scheduledTimeLocal?.trim()}
                          totalKcal={fallback.kcal}
                          carbsG={fallback.carbsG}
                          proteinG={fallback.proteinG}
                          fatG={fallback.fatG}
                          items={[]}
                        />
                      );
                    }
                    const totals = sumVisibleSlotMacros(sl, isVis, fallback);
                    const expoItems = buildExpositionItemsFromPlan(sl.items, isVis);
                    return (
                      <EmpathyMealPlanExpositionCard
                        key={spec.key}
                        slot={slotKey}
                        titleUpper={(meta?.labelIt ?? spec.labelIt).toUpperCase()}
                        subline={meta?.scheduledTimeLocal?.trim()}
                        totalKcal={totals.kcal}
                        carbsG={totals.carbsG}
                        proteinG={totals.proteinG}
                        fatG={totals.fatG}
                        items={expoItems}
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
              <div className="empathy-meal-expo-grid">
                {NUTRITION_MEAL_GRID.map((spec) => {
                  if (spec.key === "pre_sleep") {
                    return (
                      <EmpathyMealPlanExpositionCard
                        key="pre_sleep-base"
                        slot="pre_sleep"
                        titleUpper={spec.labelIt.toUpperCase()}
                        subline="Opzionale · fuori solver 5 slot"
                        totalKcal={0}
                        carbsG={0}
                        proteinG={0}
                        fatG={0}
                        items={[]}
                        placeholder
                      />
                    );
                  }
                  const meal = mealDisplayByKey.get(spec.key as MealSlotKey);
                  if (!meal) return null;
                  const slotKey = meal.key as PathwayMealSlotKey;
                  const bundle = mealPathwayBySlot[slotKey];
                  const functionalGroupsRaw =
                    bundle && !bundle.loading
                      ? buildFunctionalFoodOptionGroupsForSlot({
                          pathwayTargets: bundle.pathwayTargets ?? [],
                          usdaFoods: bundle.foods ?? [],
                          pathwaySupportPathways: pathwayModulation?.pathways ?? null,
                          minPerGroup: 3,
                          maxPerGroup: 5,
                        }).filter((g) => g.options.length > 0)
                      : [];
                  const functionalGroups = filterFunctionalFoodGroupsForMealSlot(functionalGroupsRaw, slotKey);
                  const totals = {
                    kcal: meal.kcal,
                    carbsG: meal.carbs,
                    proteinG: meal.protein,
                    fatG: meal.fat,
                  };

                  if (!bundle || bundle.loading) {
                    return (
                      <EmpathyMealPlanExpositionCard
                        key={spec.key}
                        slot={slotKey}
                        titleUpper={meal.label.toUpperCase()}
                        subline={`${meal.time} · caricamento pathway`}
                        totalKcal={totals.kcal}
                        carbsG={totals.carbsG}
                        proteinG={totals.proteinG}
                        fatG={totals.fatG}
                        items={[]}
                      />
                    );
                  }

                  if (functionalGroups.length === 0) {
                    return (
                      <EmpathyMealPlanExpositionCard
                        key={spec.key}
                        slot={slotKey}
                        titleUpper={meal.label.toUpperCase()}
                        subline={meal.time}
                        totalKcal={totals.kcal}
                        carbsG={totals.carbsG}
                        proteinG={totals.proteinG}
                        fatG={totals.fatG}
                        items={[]}
                      />
                    );
                  }

                  const dryLines = buildDryMealPlanLinesForSlot(
                    slotKey,
                    {
                      kcal: meal.kcal,
                      carbsG: meal.carbs,
                      proteinG: meal.protein,
                      fatG: meal.fat,
                    },
                    functionalGroups,
                    bundle.pathwayTargets ?? [],
                  );
                  const expoItems = buildExpositionItemsFromDryLines(dryLines, totals);
                  const expoSum = expoItems.reduce(
                    (a, it) => ({
                      kcal: a.kcal + it.kcal,
                      carbsG: a.carbsG + it.carbsG,
                      proteinG: a.proteinG + it.proteinG,
                      fatG: a.fatG + it.fatG,
                    }),
                    { kcal: 0, carbsG: 0, proteinG: 0, fatG: 0 },
                  );
                  const slotTotals =
                    expoItems.length > 0
                      ? {
                          kcal: Math.round(expoSum.kcal),
                          carbsG: Math.round(expoSum.carbsG * 10) / 10,
                          proteinG: Math.round(expoSum.proteinG * 10) / 10,
                          fatG: Math.round(expoSum.fatG * 10) / 10,
                        }
                      : totals;

                  return (
                    <EmpathyMealPlanExpositionCard
                      key={spec.key}
                      slot={slotKey}
                      titleUpper={meal.label.toUpperCase()}
                      subline={meal.portionHint?.trim() || meal.time}
                      totalKcal={slotTotals.kcal}
                      carbsG={slotTotals.carbsG}
                      proteinG={slotTotals.proteinG}
                      fatG={slotTotals.fatG}
                      items={expoItems}
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
