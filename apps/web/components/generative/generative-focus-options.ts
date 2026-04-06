import type { ProductModuleId } from "@empathy/contracts";
import type { ModeSelectOption } from "@/components/ui/empathy";

export type GenerativeFocusConfig = {
  options: ModeSelectOption[];
  defaultValue: string;
  /** Etichetta azione principale (disabilitata finché non c’è pipeline). */
  primaryCtaLabel: string;
};

/**
 * Hub operativo: query stabili per future pipeline (shell / dashboard possono leggerle).
 */
export function getGenerativeContinueHref(module: ProductModuleId, focus: string): string {
  const q = new URLSearchParams({ genModule: module, genFocus: focus });
  return `/dashboard?${q.toString()}`;
}

export function getGenerativeFocusConfig(module: ProductModuleId): GenerativeFocusConfig {
  switch (module) {
    case "training":
      return {
        options: [
          { value: "session", label: "Sessione (builder)" },
          { value: "calendar", label: "Calendario" },
          { value: "plan", label: "Piano" },
        ],
        defaultValue: "session",
        primaryCtaLabel: "Continua",
      };
    case "nutrition":
      return {
        options: [
          { value: "day", label: "Giornata energetica" },
          { value: "meal", label: "Pasto" },
          { value: "constraints", label: "Vincoli" },
        ],
        defaultValue: "day",
        primaryCtaLabel: "Calcola",
      };
    case "physiology":
      return {
        options: [
          { value: "snapshot", label: "Snapshot" },
          { value: "metabolic", label: "Metabolico" },
          { value: "lactate", label: "Lattato" },
        ],
        defaultValue: "snapshot",
        primaryCtaLabel: "Aggiorna",
      };
    case "health":
      return {
        options: [
          { value: "bio", label: "Bio-layer" },
          { value: "panels", label: "Pannelli" },
        ],
        defaultValue: "bio",
        primaryCtaLabel: "Sintetizza",
      };
    case "biomechanics":
      return {
        options: [
          { value: "session", label: "Sessione" },
          { value: "library", label: "Libreria movimenti" },
        ],
        defaultValue: "session",
        primaryCtaLabel: "Analizza",
      };
    case "aerodynamics":
      return {
        options: [
          { value: "position", label: "Posa" },
          { value: "equipment", label: "Equipaggiamento" },
        ],
        defaultValue: "position",
        primaryCtaLabel: "Simula",
      };
    default:
      return {
        options: [{ value: "default", label: "Generativo" }],
        defaultValue: "default",
        primaryCtaLabel: "Continua",
      };
  }
}
