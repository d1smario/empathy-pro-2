import type { EmpathyAccountCatalog } from "@empathy/contracts";

/** Catalogo piani allineato a V1 (`nextjs-empathy-pro/lib/account/plan-catalog.ts`). */
export const EMPATHY_ACCOUNT_CATALOG: EmpathyAccountCatalog = {
  billingProvider: "stripe",
  basePlans: [
    {
      id: "silver",
      kind: "base",
      label: "EMPATHY Silver",
      monthlyPrice: 99,
      currency: "EUR",
      interval: "month",
      trialEligible: true,
      summary: "Accesso core a fisiologia, training, nutrizione e health con memoria atleta canonica.",
      features: [
        "Memoria atleta e moduli operativi",
        "Training, nutrizione, fisiologia e health",
        "Insight generativi sullo stato canonico",
        "Idoneo a prova gratuita sui piani base",
      ],
      stripe: {
        productLookupKey: "empathy_silver_monthly",
        priceLookupKey: "empathy_silver_monthly_eur",
      },
    },
    {
      id: "gold",
      kind: "base",
      label: "EMPATHY Gold",
      monthlyPrice: 149,
      currency: "EUR",
      interval: "month",
      trialEligible: true,
      summary: "Profondità operativa estesa e orchestrazione adattiva tra i moduli.",
      features: [
        "Tutto ciò che include Silver",
        "Flussi adattivi estesi tra moduli",
        "Funzioni account premium in evoluzione",
        "Idoneo a prova gratuita sui piani base",
      ],
      stripe: {
        productLookupKey: "empathy_gold_monthly",
        priceLookupKey: "empathy_gold_monthly_eur",
      },
    },
  ],
  coachAddOns: [
    {
      id: "elite",
      kind: "coach_addon",
      label: "Elite",
      monthlyPrice: 99,
      currency: "EUR",
      interval: "month",
      trialEligible: false,
      summary: "Strato coach sul piano base con interazione settimanale e messaggistica.",
      features: [
        "Piano base richiesto",
        "1 call a settimana",
        "Fino a 7 interazioni SMS a settimana",
      ],
      stripe: {
        productLookupKey: "empathy_elite_addon_monthly",
        priceLookupKey: "empathy_elite_addon_monthly_eur",
      },
    },
    {
      id: "pro",
      kind: "coach_addon",
      label: "Pro",
      monthlyPrice: 199,
      currency: "EUR",
      interval: "month",
      trialEligible: false,
      summary: "Supporto coach giorno per giorno con più call, messaggi e revisione operativa.",
      features: [
        "Piano base richiesto",
        "Interazione coach più frequente",
        "Analisi continua sull’adattamento",
      ],
      stripe: {
        productLookupKey: "empathy_pro_addon_monthly",
        priceLookupKey: "empathy_pro_addon_monthly_eur",
      },
    },
    {
      id: "olimpic",
      kind: "coach_addon",
      label: "Olimpic",
      monthlyPrice: 399,
      currency: "EUR",
      interval: "month",
      trialEligible: false,
      summary: "Coach dedicato, monitoraggio stretto e workflow test fisiologici.",
      features: [
        "Piano base richiesto",
        "Coach dedicato",
        "Monitoraggio giornaliero",
        "Supporto test e analisi fisiologica",
      ],
      stripe: {
        productLookupKey: "empathy_olimpic_addon_monthly",
        priceLookupKey: "empathy_olimpic_addon_monthly_eur",
      },
    },
  ],
  trialPolicy: {
    trialDays: 15,
    eligiblePlanIds: ["silver", "gold"],
    notes: [
      "La prova gratuita è pensata per i piani base.",
      "Gli add-on coach si attivano sul piano base dopo setup fatturazione.",
    ],
  },
  compliance: [
    {
      id: "privacy",
      title: "Privacy",
      summary: "Consensi, visibilità dati, export e cancellazione.",
    },
    {
      id: "legal",
      title: "Legal",
      summary: "Termini, condizioni di fatturazione e limiti d’uso.",
    },
    {
      id: "account",
      title: "Account",
      summary: "Stato abbonamento, fatture e metodi di pagamento.",
    },
    {
      id: "future",
      title: "Estensioni",
      summary: "Piani enterprise, team e nuovi domini compliance.",
    },
  ],
};

export function getEmpathyAccountCatalog(): EmpathyAccountCatalog {
  return EMPATHY_ACCOUNT_CATALOG;
}
