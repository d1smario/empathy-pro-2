"use client";

type ModuleHeroStat = {
  label: string;
  value: string;
};

type ModuleHeroPanelProps = {
  kicker: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  stats?: ModuleHeroStat[];
};

/** Hero compatibile V1 (immagine + KPI strip) per moduli importati da V1. */
export function ModuleHeroPanel({ kicker, title, subtitle, imageUrl, stats = [] }: ModuleHeroPanelProps) {
  return (
    <section
      className="relative mb-6 overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/60 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] md:p-8"
      style={{
        backgroundImage: `linear-gradient(130deg, rgba(4, 7, 10, 0.92), rgba(7, 9, 12, 0.82)), url(${imageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="relative z-[1] max-w-2xl">
        <span className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.22em] text-cyan-300/90">{kicker}</span>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-300">{subtitle}</p>
      </div>
      {stats.length > 0 ? (
        <div className="relative z-[1] mt-6 flex flex-wrap gap-3">
          {stats.map((s) => (
            <div
              key={`${s.label}-${s.value}`}
              className="min-w-[100px] rounded-xl border border-white/10 bg-black/45 px-4 py-3 backdrop-blur-sm"
            >
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{s.label}</div>
              <div className="mt-1 text-lg font-bold text-white">{s.value}</div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
