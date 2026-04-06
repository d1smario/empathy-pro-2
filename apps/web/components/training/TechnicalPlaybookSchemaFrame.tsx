"use client";

/**
 * Frame grafico comune per preview schema tecnico / tattico (SVG V1-style).
 * Le future immagini raster manterranno stesso aspect e bordo.
 */
export function TechnicalPlaybookSchemaFrame({
  dataUrl,
  title,
  visualKey,
  className = "",
}: {
  dataUrl: string;
  title: string;
  /** Chiave memoria asset (playbook o riga). */
  visualKey: string;
  className?: string;
}) {
  return (
    <figure
      className={`relative overflow-hidden rounded-2xl border-2 border-violet-400/45 bg-gradient-to-br from-violet-950/50 to-black/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${className}`}
    >
      <div className="aspect-[640/360] w-full min-h-[7.5rem] bg-black/40">
        {/* eslint-disable-next-line @next/next/no-img-element -- data URI SVG da motore V1-style */}
        <img src={dataUrl} alt={`Schema esecuzione: ${title}`} className="h-full w-full object-cover object-center" loading="lazy" />
      </div>
      <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-2.5 pb-2 pt-6">
        <p className="text-[0.58rem] font-bold uppercase tracking-wider text-fuchsia-200/95">Memoria visiva · Pro 2</p>
        <p className="truncate font-mono text-[0.62rem] text-gray-300">key: {visualKey}</p>
        <p className="text-[0.58rem] text-gray-500">Raster generativo: in arrivo (oggi SVG campo V1)</p>
      </figcaption>
    </figure>
  );
}
