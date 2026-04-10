"use client";

import {
  Activity,
  Apple,
  Bed,
  Coffee,
  Droplets,
  Flame,
  Moon,
  ShoppingBag,
  Sunrise,
  Sun,
  TrendingUp,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { MealSlotKey } from "@/lib/nutrition/intelligent-meal-plan-types";
import {
  approxMacrosForPlanItem,
  bandFromGi,
  estimatedItemGlycemicIndex,
  giBandLabelIt,
  parseGramsFromPortion,
  stimulusLabelFromAvgGi,
  weightedAvgGlycemicIndex,
  type GiBand,
} from "@/lib/nutrition/meal-exposition-helpers";
import type { IntelligentMealPlanItemOut } from "@/lib/nutrition/intelligent-meal-plan-types";

function slotHeaderIcon(slot: MealSlotKey | "pre_sleep"): LucideIcon {
  switch (slot) {
    case "breakfast":
      return Sunrise;
    case "lunch":
      return Sun;
    case "dinner":
      return Moon;
    case "snack_am":
      return Apple;
    case "snack_pm":
      return Coffee;
    case "pre_sleep":
      return Bed;
    default:
      return ShoppingBag;
  }
}

function giPillClass(band: GiBand): string {
  switch (band) {
    case "low":
      return "empathy-meal-expo-igpill--low";
    case "med":
      return "empathy-meal-expo-igpill--med";
    case "high":
      return "empathy-meal-expo-igpill--high";
    case "vhigh":
      return "empathy-meal-expo-igpill--vhigh";
    default:
      return "";
  }
}

export type EmpathyExpositionItem = {
  sourceIndex: number;
  name: string;
  portionHint?: string;
  kcal: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
  ig: number;
  weightG?: number;
};

export function buildExpositionItemsFromPlan(
  items: IntelligentMealPlanItemOut[],
  visible: (idx: number) => boolean,
): EmpathyExpositionItem[] {
  return items
    .map((it, ii) => ({ it, ii }))
    .filter(({ ii }) => visible(ii))
    .map(({ it, ii }) => {
      const m = approxMacrosForPlanItem(it);
      const ig = estimatedItemGlycemicIndex(it);
      return {
        sourceIndex: ii,
        name: it.name,
        portionHint: it.portionHint?.trim() || undefined,
        kcal: m.kcal,
        carbsG: m.carbsG,
        proteinG: m.proteinG,
        fatG: m.fatG,
        ig,
        weightG: parseGramsFromPortion(`${it.portionHint ?? ""} ${it.name}`.trim()),
      };
    });
}

type EmpathyMealPlanExpositionCardProps = {
  slot: MealSlotKey | "pre_sleep";
  titleUpper: string;
  subline?: string;
  totalKcal: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
  items: EmpathyExpositionItem[];
  placeholder?: boolean;
  showCoachControls?: boolean;
  onCoachRemove?: (sourceIndex: number) => void;
  onCoachExcludeProfile?: (sourceIndex: number) => void;
  profileFoodExcludeBusyLabel?: string | null;
  athleteId?: string | null;
};

export function EmpathyMealPlanExpositionCard({
  slot,
  titleUpper,
  subline,
  totalKcal,
  carbsG,
  proteinG,
  fatG,
  items,
  placeholder,
  showCoachControls,
  onCoachRemove,
  onCoachExcludeProfile,
  profileFoodExcludeBusyLabel,
  athleteId,
}: EmpathyMealPlanExpositionCardProps) {
  const Icon = slotHeaderIcon(slot);
  const kcalDenom = Math.max(1, totalKcal);
  const choPct = Math.round(((carbsG * 4) / kcalDenom) * 100);
  const proPct = Math.round(((proteinG * 4) / kcalDenom) * 100);
  const fatPct = Math.max(0, 100 - choPct - proPct);

  const igWeighted =
    items.length > 0
      ? weightedAvgGlycemicIndex(items.map((i) => ({ ig: i.ig, kcal: i.kcal })))
      : Math.round(38 + (choPct / 100) * 38);
  const slotBand = bandFromGi(igWeighted);
  const stimulus = stimulusLabelFromAvgGi(slotBand);

  if (placeholder) {
    return (
      <article className="empathy-meal-expo-card empathy-meal-expo-card--placeholder">
        <header className="empathy-meal-expo-head">
          <div className="empathy-meal-expo-icon-wrap" aria-hidden>
            <Icon className="empathy-meal-expo-icon" strokeWidth={1.75} />
          </div>
          <div className="empathy-meal-expo-head-text">
            <h3 className="empathy-meal-expo-title">{titleUpper}</h3>
            {subline ? <p className="empathy-meal-expo-sub">{subline}</p> : null}
          </div>
        </header>
        <p className="empathy-meal-expo-placeholder-note">
          Segnaposto visivo · il solver opera su cinque slot pasto; pre-sonno è opzionale fuori pipeline.
        </p>
      </article>
    );
  }

  return (
    <article className="empathy-meal-expo-card">
      <header className="empathy-meal-expo-banner">
        <div className="empathy-meal-expo-icon-wrap empathy-meal-expo-icon-wrap--banner" aria-hidden>
          <Icon className="empathy-meal-expo-icon" strokeWidth={1.75} />
        </div>
        <div className="empathy-meal-expo-banner-center">
          <h3 className="empathy-meal-expo-title-banner">{titleUpper}</h3>
          {subline ? <p className="empathy-meal-expo-sub-banner">{subline}</p> : null}
        </div>
        <div className="empathy-meal-expo-kcal-tile" aria-label={`${totalKcal} chilocalorie`}>
          <span className="empathy-meal-expo-kcal-num">{Math.round(totalKcal)}</span>
          <span className="empathy-meal-expo-kcal-unit">KCAL</span>
        </div>
      </header>

      <div className="empathy-meal-expo-macros">
        <div className="empathy-meal-expo-macro empathy-meal-expo-macro--cho">
          <Activity className="empathy-meal-expo-macro-ic" strokeWidth={1.6} aria-hidden />
          <span className="empathy-meal-expo-macro-label">CARBOIDRATI</span>
          <span className="empathy-meal-expo-macro-val">{Math.round(carbsG)} g</span>
        </div>
        <div className="empathy-meal-expo-macro empathy-meal-expo-macro--pro">
          <Zap className="empathy-meal-expo-macro-ic" strokeWidth={1.6} aria-hidden />
          <span className="empathy-meal-expo-macro-label">PROTEINE</span>
          <span className="empathy-meal-expo-macro-val">{Math.round(proteinG)} g</span>
        </div>
        <div className="empathy-meal-expo-macro empathy-meal-expo-macro--fat">
          <Droplets className="empathy-meal-expo-macro-ic" strokeWidth={1.6} aria-hidden />
          <span className="empathy-meal-expo-macro-label">GRASSI</span>
          <span className="empathy-meal-expo-macro-val">{Math.round(fatG)} g</span>
        </div>
      </div>

      <div className="empathy-meal-expo-igbar">
        <div className="empathy-meal-expo-igbar-left">
          <TrendingUp className="empathy-meal-expo-ig-ic" strokeWidth={1.6} aria-hidden />
          <div>
            <div className="empathy-meal-expo-ig-label">Indice Glicemico Medio</div>
            <div className="empathy-meal-expo-ig-num">{igWeighted}</div>
          </div>
        </div>
        <div className="empathy-meal-expo-igbar-pills">
          <span className={cn("empathy-meal-expo-igpill", giPillClass(slotBand))}>
            IG {igWeighted} · {giBandLabelIt(slotBand)}
          </span>
          <span
            className={cn(
              "empathy-meal-expo-stimpill",
              stimulus.tone === "alto" && "empathy-meal-expo-stimpill--high",
              stimulus.tone === "medio" && "empathy-meal-expo-stimpill--med",
              stimulus.tone === "basso" && "empathy-meal-expo-stimpill--low",
            )}
          >
            <Zap className="inline h-3.5 w-3.5 opacity-90" strokeWidth={2.2} aria-hidden />
            {stimulus.text}
          </span>
        </div>
      </div>

      <div className="empathy-meal-expo-macro-bar">
        <span className="empathy-meal-expo-macro-seg empathy-meal-expo-macro-seg--cho">CHO {choPct}%</span>
        <span className="empathy-meal-expo-macro-seg empathy-meal-expo-macro-seg--pro">PRO {proPct}%</span>
        <span className="empathy-meal-expo-macro-seg empathy-meal-expo-macro-seg--fat">FAT {fatPct}%</span>
      </div>

      <section className="empathy-meal-expo-detail-head">
        <span className="empathy-meal-expo-detail-bar" aria-hidden />
        <h4 className="empathy-meal-expo-detail-title">ALIMENTI DETTAGLIATI</h4>
      </section>

      <ul className="empathy-meal-expo-food-list">
        {items.length === 0 ? (
          <li className="empathy-meal-expo-food-empty muted-copy">Nessuna voce per questo pasto.</li>
        ) : (
          items.map((food) => {
            const b = bandFromGi(food.ig);
            const busy = profileFoodExcludeBusyLabel === food.name.trim();
            return (
              <li key={`${food.name}-${food.sourceIndex}`} className="empathy-meal-expo-food-card">
                <div className="empathy-meal-expo-food-top">
                  <div className="empathy-meal-expo-food-name-row">
                    <span className="empathy-meal-expo-dot" aria-hidden />
                    <span className="empathy-meal-expo-food-name">{food.name}</span>
                  </div>
                  <div className="empathy-meal-expo-food-pills">
                    {food.weightG != null ? (
                      <span className="empathy-meal-expo-pill empathy-meal-expo-pill--wt">{food.weightG}g</span>
                    ) : null}
                    <span className="empathy-meal-expo-pill empathy-meal-expo-pill--kcal">
                      <Flame className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                      {food.kcal}
                    </span>
                    <span className={cn("empathy-meal-expo-pill", "empathy-meal-expo-pill--ig", giPillClass(b))}>
                      IG {food.ig} · {giBandLabelIt(b)}
                    </span>
                  </div>
                </div>
                <div className="empathy-meal-expo-food-macros">
                  <div className="empathy-meal-expo-pod empathy-meal-expo-pod--cho">
                    <span className="empathy-meal-expo-pod-dot" />
                    <span className="empathy-meal-expo-pod-lab">CHO</span>
                    <span className="empathy-meal-expo-pod-val">{food.carbsG}g</span>
                  </div>
                  <div className="empathy-meal-expo-pod empathy-meal-expo-pod--pro">
                    <span className="empathy-meal-expo-pod-dot" />
                    <span className="empathy-meal-expo-pod-lab">PRO</span>
                    <span className="empathy-meal-expo-pod-val">{food.proteinG}g</span>
                  </div>
                  <div className="empathy-meal-expo-pod empathy-meal-expo-pod--fat">
                    <span className="empathy-meal-expo-pod-dot" />
                    <span className="empathy-meal-expo-pod-lab">FAT</span>
                    <span className="empathy-meal-expo-pod-val">{food.fatG}g</span>
                  </div>
                </div>
                {showCoachControls && onCoachRemove && onCoachExcludeProfile ? (
                  <div className="empathy-meal-expo-coach">
                    <button
                      type="button"
                      className="nutrition-ui-chip text-[11px] py-0.5 px-2"
                      onClick={() => onCoachRemove(food.sourceIndex)}
                    >
                      Rimuovi
                    </button>
                    <button
                      type="button"
                      className="nutrition-ui-chip text-[11px] py-0.5 px-2"
                      disabled={!athleteId || busy}
                      onClick={() => onCoachExcludeProfile(food.sourceIndex)}
                    >
                      {busy ? "Salvo…" : "Escludi profilo"}
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })
        )}
      </ul>
    </article>
  );
}

export function EmpathyMealPlanGlycemicLegend() {
  return (
    <section className="empathy-meal-expo-legend" aria-label="Legenda indice glicemico">
      <div className="empathy-meal-expo-detail-head empathy-meal-expo-detail-head--legend">
        <TrendingUp className="h-4 w-4 text-[var(--nutri-expo-pink)]" strokeWidth={2} aria-hidden />
        <h4 className="empathy-meal-expo-detail-title">LEGENDA INDICE GLICEMICO (IG)</h4>
      </div>
      <div className="empathy-meal-expo-legend-grid">
        <div className="empathy-meal-expo-legend-card empathy-meal-expo-legend-card--low">
          <strong>BASSO</strong>
          <span>&lt; 35</span>
        </div>
        <div className="empathy-meal-expo-legend-card empathy-meal-expo-legend-card--med">
          <strong>MEDIO</strong>
          <span>35–55</span>
        </div>
        <div className="empathy-meal-expo-legend-card empathy-meal-expo-legend-card--high">
          <strong>ALTO</strong>
          <span>55–70</span>
        </div>
        <div className="empathy-meal-expo-legend-card empathy-meal-expo-legend-card--vhigh">
          <strong>MOLTO ALTO</strong>
          <span>&gt; 70</span>
        </div>
      </div>
      <p className="empathy-meal-expo-legend-note muted-copy text-[11px] leading-snug">
        IG mostrati sono stime educative da composizione macro stimata, non valori di laboratorio o tabella IG ufficiale per alimento.
      </p>
    </section>
  );
}
