import type { IntelligentMealPlanAssembledCore, IntelligentMealPlanRequest, IntelligentMealPlanResponseBody } from "@/lib/nutrition/intelligent-meal-plan-types";
import { attachSolverBasisToAssembled } from "@/lib/nutrition/meal-plan-solver-basis";
import { finalizeIntelligentMealPlanCore } from "@/lib/nutrition/meal-plan-response-finalize";
import {
  parseIntelligentMealPlanJson,
  rescaleSlotKcalToTarget,
  slotKcalWithinTolerance,
} from "@/lib/nutrition/intelligent-meal-plan-types";

function buildUserContent(req: IntelligentMealPlanRequest): string {
  return JSON.stringify(
    {
      task: "Costruire un piano pasti giornaliero in italiano: pasti reali (non elenchi casuali), coerenti con kcal/macros e con supporto metabolico.",
      rules: [
        "Non modificare target kcal/macros: vincoli rigidi (somma approxKcal per pasto entro ±12% del targetKcal dello slot).",
        "Modello mediterraneo semplice: colazione = latticini, cereali complessi/muesli/avena, pane/fette biscottate/gallette, frutta/smoothie, porridge, burro d’arachidi/marmellata, uova, insaccati cotti/crudi, salmone, semi/noci, proteine in polvere; NO olio d’oliva e NO olive a colazione. Pranzo/cena = UN solo carboidrato principale (pasta O riso O patate O farro, mai due insieme) + UNA sola proteina principale (carne O pesce O legumi O uova, mai mescolate nello stesso pasto) + verdure + olio a crudo + pane/focaccia piccola se serve. Spuntino dolce: yogurt+frutta+cereali/barretta/smoothie/gelato; spuntino salato: gallette/pane+affettato+un grasso (grana/avocado, olio ok qui). Somma approxKcal degli item deve avvicinarsi al targetKcal dello slot (±12%).",
        "Pesce a pranzo o cena: una SOLA specie per pasto (es. merluzzo O spigola O salmone), con UNA grammatura coerente col target kcal dello slot. Vietato elencare scenari multipli, confronti paralleli o tre porzioni identiche con totali diversi nello stesso pasto.",
        "Stesso giorno: non ripetere lo stesso alimento amido principale o la stessa famiglia proteica principale tra pranzo e cena (es. niente patate a pranzo e di nuovo patate a cena; niente pesce a pranzo e di nuovo pesce a cena). Vietato uova a pranzo e di nuovo uova a cena nello stesso giorno. Varia carboidrato e proteina.",
        "Settimana: non proporre lo stesso piatto ‘pesante’ (stesso amido o stessa fonte proteica animale principale) più di 2–3 volte; latte, olio, zucchero e condimenti possono ripetersi.",
        "Colazione: quando proponi latte/bevanda, preferisci rotazioni sensate (latte vaccino, senza lattosio, mandorla, riso, avena, capra) coerenti con il profilo; evita di copiare sempre la stessa etichetta se il contesto lo consente.",
        "Composizione pasti (Italia / senso comune): colazione e spuntini = colazione classica o salata leggera (latte/yogurt/cereali/avena/frutta/frutti di bosco; pane tostato; uova; salmone affumicato; bresaola/prosciutto; mandorle/crackers). Vietato in breakfast/snack_am/snack_pm: legumi, spinaci/bietola/cicoria/rucola/cavoli come piatto, patate da contorno, barbabietola/succo barbabietola, primi completi (pasta/carbonara/lasagne/risotto), pollo/tacchino/petto/manzo/maiale come piatto, tonno/sgombro/sardine (ok salmone a colazione se coerente). Pranzo e cena: verdure, legumi, carni/pesce, primi e piatti completi.",
        "Se un nutriente (es. folati) richiederebbe solo cibi vietati in colazione/spuntino, non proporre quei cibi: indica integrazione (es. acido folico / multivitaminico) nel functionalBridge e usa alimenti ammessi nello slot.",
        "functionalFoodGroups è la base: per ogni pasto scegli principalmente tra le opzioni elencate (curated e usda_fdc); combinali in piatti sensati. Evita alimenti assenti dai gruppi salvo sinergie ovvie italiane.",
        "Ogni item deve avere functionalBridge che citi esplicitamente nutrientId o displayNameIt del gruppo funzionale coperto.",
        "Rispetta dietType, allergies, intolerances, foodExclusions, foodPreferences, supplements, aggregateInhibitors.",
        "Le opzioni in functionalFoodGroups / foodCandidates sono già filtrate lato server per profilo (dieta + allergie/intolleranze/esclusioni): non reintrodurre alimenti esclusi; se uno slot è scarso, usa sinergie sicure coerenti con i vincoli.",
        "pathwayTimingLines + timingHalfLifeHint nei gruppi: usa scheduledTimeLocal di ogni slot e trainingDayLines per spiegare perché certi nutrienti/vie hanno senso in quell’orario (emivita qualitativa del JSON, non dosi cliniche).",
        "routineDigest: allinea abitudini se presente.",
        "macroRole: distribuzione sensata vs targetCarbsG/targetProteinG/targetFatG dello slot.",
        "portionHint: SOLO quantità secca (es. \"200 ml latte\", \"45 g cereali\", \"1 banana media\", \"20 g proteine in polvere\") — niente paragrafi né spiegazioni metaboliche (quelle vanno in functionalBridge).",
        "mealPlanSolverMeta: combina obbligatoriamente l’assemblaggio con dailyMealsKcalTotal e integrationLeverLines (solver pasti × training programmato); i target kcal/macro per slot restano quelli del request.",
        "dayInteractionSummary: 3-5 frasi che esplicitino il legame tra fabbisogno da solver, seduta/training e distribuzione pasti; linguaggio non clinico.",
        "slotTimingRationale: per ogni slot, 1-2 frasi su timing vs vie attivate e orario pasto.",
      ],
      request: req,
      outputSchema: {
        layer: "llm_orchestration_v1",
        disclaimer: "string breve: non sostituisce parere medico.",
        dayInteractionSummary: "string",
        slots: [
          {
            slot: "breakfast|lunch|dinner|snack_am|snack_pm",
            targetKcalEcho: "number = targetKcal dello slot in input",
            slotCoherence: "string: coerenza interna del pasto (piatti)",
            slotTimingRationale: "string: timing del pasto vs allenamento e hint emivita/fasi",
            items: [
              {
                name: "string",
                portionHint: "string: solo g/ml/pz (porzione secca)",
                functionalBridge: "string",
                approxKcal: "number",
                macroRole: "cho_heavy|protein|fat|mixed|veg",
              },
            ],
          },
        ],
      },
    },
    null,
    2,
  );
}

const SYSTEM = `Sei un assistente nutrizionale sportivo per EMPATHY. I fabbisogni e le liste USDA/curate arrivano da motori deterministici: tu assembli un piano quotidiano con timing e linguaggio chiaro.
Restituisci SOLO JSON valido, senza markdown, chiavi come in outputSchema.
Lingua: italiano. Non diagnosi. Non contraddire i vincoli numerici. Le "emivita" nel payload sono classi qualitative (pathway), non parametri farmacologici.`;

export async function generateIntelligentMealPlanWithOpenAI(
  req: IntelligentMealPlanRequest,
): Promise<{ ok: true; body: IntelligentMealPlanResponseBody } | { ok: false; error: string }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: "OPENAI_API_KEY non configurata sul server." };
  }

  const model = process.env.OPENAI_MEAL_PLAN_MODEL?.trim() || "gpt-4o-mini";

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        max_tokens: 4096,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: buildUserContent(req) },
        ],
      }),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "OpenAI network error" };
  }

  if (!response.ok) {
    const t = await response.text().catch(() => "");
    return { ok: false, error: `OpenAI HTTP ${response.status}: ${t.slice(0, 200)}` };
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) {
    return { ok: false, error: "Risposta OpenAI vuota." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, error: "JSON non parsabile dal modello." };
  }

  const body = parseIntelligentMealPlanJson(parsed);
  if (!body) {
    return { ok: false, error: "JSON non conforme allo schema atteso." };
  }

  const bySlotReq = new Map(req.slots.map((s) => [s.slot, s]));
  const fixedSlots = body.slots.map((slotOut) => {
    const need = bySlotReq.get(slotOut.slot);
    if (!need) return slotOut;
    let s = rescaleSlotKcalToTarget(slotOut, need.targetKcal);
    if (!slotKcalWithinTolerance(s, need.targetKcal, 0.16)) {
      s = rescaleSlotKcalToTarget(s, need.targetKcal);
    }
    return s;
  });

  const assembled: IntelligentMealPlanAssembledCore = {
    ...body,
    slots: fixedSlots,
  };

  const finalized = finalizeIntelligentMealPlanCore(assembled, req);
  const bodyOut: IntelligentMealPlanResponseBody = attachSolverBasisToAssembled(finalized, req);
  return { ok: true, body: bodyOut };
}
