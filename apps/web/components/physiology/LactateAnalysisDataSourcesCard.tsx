"use client";

import { FileUp, FlaskConical, Link2, Stethoscope } from "lucide-react";
import { Pro2Link } from "@/components/ui/empathy";

export type SegmentAttachmentMeta = { name: string; size: number; type: string } | null;

export type HealthBioGlucoseMeta = {
  mmol_l: number;
  source: "blood_panel" | "physiological_baseline" | "session_roll";
};

function glucoseSourceLabel(source: HealthBioGlucoseMeta["source"]): string {
  if (source === "blood_panel") return "Pannello sangue (Health)";
  if (source === "physiological_baseline") return "Baseline glucosio (profilo fisiologico)";
  return "Media sessioni (glucose_mmol)";
}

/**
 * Linee guida operative: sensori da sessione / Health&Bio per microbiota / allegati traccia / manuale come fallback.
 */
export function LactateAnalysisDataSourcesCard({
  segmentAttachment,
  onSegmentFile,
  hasHealthMicrobiotaProfile = false,
  healthBioGlucose = null,
  healthBioCoreTempC = null,
}: {
  segmentAttachment: SegmentAttachmentMeta;
  onSegmentFile: (meta: SegmentAttachmentMeta) => void;
  hasHealthMicrobiotaProfile?: boolean;
  healthBioGlucose?: HealthBioGlucoseMeta | null;
  healthBioCoreTempC?: number | null;
}) {
  return (
    <div className="rounded-2xl border border-amber-500/25 bg-amber-950/10 px-4 py-4 text-sm text-slate-300">
      <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wide text-amber-200/90">
        <FlaskConical className="h-4 w-4" aria-hidden />
        Fonti dati · intestino &amp; sensori
      </div>
      {(healthBioGlucose != null || healthBioCoreTempC != null || hasHealthMicrobiotaProfile) ? (
        <div className="mt-3 rounded-lg border border-cyan-500/20 bg-cyan-950/20 px-3 py-2 text-[0.75rem] leading-relaxed text-slate-400">
          <span className="font-semibold text-cyan-200/90">Allineato da Health / profilo</span>
          {hasHealthMicrobiotaProfile ? (
            <span className="block mt-1">Microbiota: pannello <em>Health&amp;Bio</em> disponibile per i taxa.</span>
          ) : null}
          {healthBioGlucose != null ? (
            <span className="block mt-1">
              Glucosio: <strong className="text-slate-200">{healthBioGlucose.mmol_l.toFixed(2)} mmol/L</strong> ·{" "}
              {glucoseSourceLabel(healthBioGlucose.source)} (precompilato se il campo era vuoto; import sessione ha priorità operativa quando applichi il picker).
            </span>
          ) : null}
          {healthBioCoreTempC != null ? (
            <span className="block mt-1">
              Core temp baseline: <strong className="text-slate-200">{healthBioCoreTempC.toFixed(1)} °C</strong> da profilo fisiologico (solo se il campo era vuoto).
            </span>
          ) : null}
        </div>
      ) : null}
      <ul className="mt-3 list-inside list-disc space-y-1.5 text-[0.8rem] leading-relaxed text-slate-400">
        <li>
          <strong className="text-slate-200">Assorbimento / sequestro / training intestinale</strong> con fonte{" "}
          <em>Health&amp;Bio</em> o <em>Preset fenotipo</em>: valori <strong>derivati</strong> dal pannello microbiota o dal livello di disbiosi (non editabili finché non passi a{" "}
          <strong>Manuale</strong> nel tile Microbiota).
        </li>
        <li>
          <strong className="text-slate-200">VO₂, SmO₂, glucosio (mmol/L), temperatura core</strong>: precompilazione da{" "}
          <strong>pannello sangue</strong>, <strong>baseline profilo</strong> o <strong>media sessioni</strong> (ordine di priorità lato API); completamento con <strong>import sessione</strong> (picker) e VO₂ in modalità <strong>test</strong> dove serve.
        </li>
        <li>
          <strong className="text-slate-200">Traccia segmento</strong>: allega file di supporto (CSV/GPX/JSON esportati dal dispositivo); oggi viene registrato solo metadato nello snapshot (nessun upload storage in questa iterazione).
        </li>
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Pro2Link
          href="/health"
          variant="secondary"
          className="inline-flex items-center gap-2 border border-cyan-500/35 bg-cyan-500/10 text-xs hover:bg-cyan-500/15"
        >
          <Stethoscope className="h-3.5 w-3.5" aria-hidden />
          Health &amp; bio
        </Pro2Link>
        <span className="inline-flex items-center gap-1.5 text-[0.7rem] text-slate-500">
          <Link2 className="h-3.5 w-3.5" aria-hidden />
          Esami (sangue, microbiota) caricati lì si riflettono nel lab al caricamento atleta.
        </span>
      </div>
      <label className="mt-4 flex cursor-pointer flex-col gap-2 rounded-xl border border-dashed border-white/15 bg-black/25 px-3 py-3 text-xs text-slate-400 hover:border-amber-500/35">
        <span className="flex items-center gap-2 font-medium text-slate-200">
          <FileUp className="h-4 w-4 text-amber-300/90" aria-hidden />
          Allegato traccia segmento (opzionale)
        </span>
        <input
          type="file"
          accept=".csv,.json,.gpx,.txt,text/csv,application/json,text/xml,application/gpx+xml"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) {
              onSegmentFile(null);
              return;
            }
            onSegmentFile({ name: f.name, size: f.size, type: f.type || "application/octet-stream" });
            e.target.value = "";
          }}
        />
        <span className="text-[0.7rem] text-slate-500">
          {segmentAttachment ? (
            <>
              Selezionato: <strong className="text-slate-300">{segmentAttachment.name}</strong> (
              {(segmentAttachment.size / 1024).toFixed(1)} KB)
            </>
          ) : (
            "Nessun file — verrà citato nello snapshot Lactate come riferimento operativo."
          )}
        </span>
        {segmentAttachment ? (
          <button
            type="button"
            className="self-start text-[0.7rem] text-rose-300 underline"
            onClick={() => onSegmentFile(null)}
          >
            Rimuovi allegato
          </button>
        ) : null}
      </label>
    </div>
  );
}
