import type { ProductModuleId } from "@empathy/contracts";
import * as Bioenergetics from "@empathy/domain-bioenergetics";
import * as Knowledge from "@empathy/domain-knowledge";
import * as Nutrition from "@empathy/domain-nutrition";
import * as Physiology from "@empathy/domain-physiology";
import * as Reality from "@empathy/domain-reality";
import * as Training from "@empathy/domain-training";
import * as Twin from "@empathy/domain-twin";

export type ModuleDomainPanel = {
  packageId: string;
  title: string;
  summary: string;
};

const DOMAIN_LINE = [
  Training.DOMAIN,
  Twin.DOMAIN,
  Nutrition.DOMAIN,
  Physiology.DOMAIN,
  Knowledge.DOMAIN,
  Reality.DOMAIN,
  Bioenergetics.DOMAIN,
] as const;

/** Package `@empathy/domain-*` cablati ai contratti (step 3). */
export const DOMAIN_PACKAGES_WIRED = DOMAIN_LINE;

/** Collega ogni modulo prodotto al package di dominio (o copia statica se non esiste ancora). */
export function getModuleDomainPanel(module: ProductModuleId): ModuleDomainPanel | null {
  switch (module) {
    case "training":
      return {
        packageId: Training.DOMAIN,
        title: Training.DOMAIN_TITLE,
        summary: Training.DOMAIN_SUMMARY,
      };
    case "nutrition":
      return {
        packageId: Nutrition.DOMAIN,
        title: Nutrition.DOMAIN_TITLE,
        summary: Nutrition.DOMAIN_SUMMARY,
      };
    case "physiology":
      return {
        packageId: Physiology.DOMAIN,
        title: Physiology.DOMAIN_TITLE,
        summary: Physiology.DOMAIN_SUMMARY,
      };
    case "health":
      return {
        packageId: Bioenergetics.DOMAIN,
        title: "Health & bio layer",
        summary: `${Bioenergetics.DOMAIN_SUMMARY} Biomarker e pannelli restano tipizzati in @empathy/contracts (BiomarkerPanel).`,
      };
    case "dashboard":
      return {
        packageId: "@empathy/contracts",
        title: "Vista aggregata",
        summary: `Il dashboard aggrega twin, training, nutrition e health su tipi @empathy/contracts. Domain packages: ${DOMAIN_LINE.join(", ")}.`,
      };
    case "profile":
      return {
        packageId: "@empathy/contracts",
        title: "Profilo & memoria",
        summary:
          "AthleteProfile, AthleteMemory e PhysiologyState vivono in @empathy/contracts; resolver e persistenza arriveranno da integrations + domain.",
      };
    case "athletes":
      return {
        packageId: "@empathy/contracts",
        title: "Coach · roster",
        summary:
          "Scope coach e identity memory (AthleteIdentityMemory) sono definiti negli schemi contrattuali; UI atleti resta sullo shell senza logica generativa qui.",
      };
    case "biomechanics":
      return {
        packageId: "—",
        title: "Biomechanics",
        summary:
          "Modulo prodotto riservato; contratti di movimento/sensoristica saranno aggiunti in @empathy/contracts quando il modello sarà congelato.",
      };
    case "aerodynamics":
      return {
        packageId: "—",
        title: "Aerodynamics",
        summary:
          "Modulo prodotto riservato; tipi CFD / tunnel e integrazioni saranno versionati nei contratti prima dell’implementazione.",
      };
    case "settings":
      return {
        packageId: Reality.DOMAIN,
        title: "Impostazioni",
        summary: `Account e integrazioni device: ingest normalizzato da ${Reality.DOMAIN} + cataloghi account in @empathy/contracts.`,
      };
    default:
      return null;
  }
}
