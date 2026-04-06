import type { IntelligentMealPlanRequest, MealPlanHydrationRoutine, MealPlanHydrationWindow } from "@/lib/nutrition/intelligent-meal-plan-types";

function parseMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm).trim());
  if (!m) return null;
  const h = Math.min(23, Math.max(0, parseInt(m[1]!, 10)));
  const min = Math.min(59, Math.max(0, parseInt(m[2]!, 10)));
  return h * 60 + min;
}

function formatMinutes(total: number): string {
  const day = 24 * 60;
  const t = ((total % day) + day) % day;
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Stima ml giornalieri e finestre con minerali (educativo; non prescrizione clinica). */
export function buildHydrationRoutineFromMealPlanRequest(req: IntelligentMealPlanRequest): MealPlanHydrationRoutine {
  const totalKcal = Math.max(800, req.mealPlanSolverMeta.dailyMealsKcalTotal);
  const baselineDailyMl = Math.max(2200, Math.round(Math.min(4200, totalKcal * 0.62 + 1350)));
  const hasTraining = req.trainingDayLines.some((l) => String(l).trim().length > 0);
  let trainingExtraMl = hasTraining ? 720 : 320;
  const joined = req.trainingDayLines.join(" ");
  const durMatch = joined.match(/(\d+)\s*min/);
  if (durMatch) {
    const dm = parseInt(durMatch[1]!, 10);
    if (Number.isFinite(dm) && dm > 0) trainingExtraMl = Math.max(480, Math.round(dm * 11));
  }
  const totalTargetMl = baselineDailyMl + trainingExtraMl;

  const ordered = [...req.slots]
    .map((s) => ({
      slot: s.slot,
      labelIt: s.labelIt,
      scheduledTimeLocal: s.scheduledTimeLocal,
      m: parseMinutes(s.scheduledTimeLocal) ?? 12 * 60,
    }))
    .sort((a, b) => a.m - b.m);

  const windows: MealPlanHydrationWindow[] = [];

  const first = ordered[0];
  if (first) {
    const wakeM = Math.max(6 * 60, first.m - 50);
    windows.push({
      labelIt: "Mattino — idratazione iniziale / pre-primo pasto",
      scheduledTimeLocal: formatMinutes(wakeM),
      volumeMl: 420,
      notesIt: "Acqua a piccoli sorsi; utile prima della colazione o al risveglio.",
      sodiumMg: 0,
      potassiumMg: 0,
      magnesiumMg: 0,
    });
  }

  for (const s of ordered) {
    if (s.slot === "breakfast" || s.slot === "lunch" || s.slot === "dinner") {
      const ml = s.slot === "lunch" ? 450 : s.slot === "dinner" ? 380 : 360;
      windows.push({
        labelIt: `Pasto — ${s.labelIt}`,
        scheduledTimeLocal: s.scheduledTimeLocal?.trim() ? s.scheduledTimeLocal : formatMinutes(s.m),
        volumeMl: ml,
        notesIt: "Durante il pasto o nei 20' precedenti; distribuisci in più bicchieri.",
        sodiumMg: Math.round(ml * 0.035),
        potassiumMg: Math.round(ml * 0.018),
        magnesiumMg: Math.round(ml * 0.012),
      });
    }
    if (s.slot === "snack_am" || s.slot === "snack_pm") {
      windows.push({
        labelIt: `Spuntino — ${s.labelIt}`,
        scheduledTimeLocal: s.scheduledTimeLocal?.trim() ? s.scheduledTimeLocal : formatMinutes(s.m),
        volumeMl: 300,
        notesIt: "Associa acqua alla merenda; se allenamento intenso entro 2h, +150 ml.",
        sodiumMg: 8,
        potassiumMg: 5,
        magnesiumMg: 3,
      });
    }
  }

  if (hasTraining) {
    windows.push({
      labelIt: "Allenamento — peri / post (fluidi + elettroliti se seduta lunga o caldo)",
      scheduledTimeLocal: "—",
      volumeMl: trainingExtraMl,
      notesIt: "Se sudorazione elevata: integra Na/K/Mg (bevanda o protocollo concordato).",
      sodiumMg: Math.min(900, Math.round(trainingExtraMl * 0.5)),
      potassiumMg: Math.round(trainingExtraMl * 0.11),
      magnesiumMg: Math.round(trainingExtraMl * 0.035),
    });
  }

  windows.push({
    labelIt: "Sera — chiusura idratazione",
    scheduledTimeLocal: "21:15",
    volumeMl: 260,
    notesIt: "Volume moderato se sensibilità a risvegli notturni per diuresi.",
    sodiumMg: 0,
    potassiumMg: 0,
    magnesiumMg: 0,
  });

  const sumVol = windows.reduce((a, w) => a + w.volumeMl, 0);
  const scale = sumVol > 0 ? totalTargetMl / sumVol : 1;
  const scaled: MealPlanHydrationWindow[] = windows.map((w) => ({
    ...w,
    volumeMl: Math.max(100, Math.round(w.volumeMl * scale)),
  }));

  return {
    baselineDailyMl,
    trainingExtraMl,
    totalTargetMl,
    windows: scaled,
  };
}
