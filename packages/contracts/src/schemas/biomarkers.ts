/**
 * Biomarkers: sangue, microbiota, genomica/epigenetica, sintomi.
 */

import type { IsoDate } from "./common";

export type BiomarkerPanel = {
  id: string;
  athleteId: string;
  /** Tipo pannello */
  type: "blood" | "microbiota" | "genomics" | "epigenetics" | "symptoms" | "combined";
  /** Data referto / raccolta */
  sampleDate?: IsoDate;
  reportedAt?: string;
  /** Valori (nome → valore + unità) */
  values: BiomarkerValue[];
  /** Flag clinici (es. "ferritina bassa", "vit D insufficiente") */
  flags?: string[];
  /** Fonte (lab, device, self-reported) */
  source?: string;
  /** Riferimento a file (Supabase Storage) */
  attachmentUrl?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type BiomarkerValue = {
  name: string;
  value: number | string;
  unit?: string;
  referenceRange?: string;
  interpretation?: "low" | "normal" | "high" | "critical";
};
