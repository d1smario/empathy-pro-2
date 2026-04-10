"use client";

type ConsolePageHeaderProps = {
  title: string;
  tag?: string;
  hint?: string;
};

/** Intestazione compatibile V1 / Metabolic Lab (Pro 2 usa Tailwind). */
export function ConsolePageHeader({ title, tag, hint }: ConsolePageHeaderProps) {
  return (
    <section className="mb-6 border-b border-white/10 pb-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {tag ? (
            <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-orange-400/90">{tag}</p>
          ) : null}
          <h2 className="mt-1 text-xl font-bold tracking-tight text-white sm:text-2xl">{title}</h2>
        </div>
        {hint ? <p className="max-w-md text-right text-sm text-zinc-400">{hint}</p> : null}
      </div>
    </section>
  );
}
