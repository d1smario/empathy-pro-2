"use client";

/**
 * Moduli pre-cablati senza lettura DB dedicata (roadmap Pro 2).
 */
export function FaseModuleStubCard({
  accentClass,
  kicker,
  title,
  body,
}: {
  accentClass: string;
  kicker: string;
  title: string;
  body: string;
}) {
  return (
    <section
      className="w-full max-w-lg rounded-2xl border border-white/10 bg-black/30 p-6 text-left backdrop-blur-md"
      aria-label={title}
    >
      <p className={`font-mono text-[0.6rem] uppercase tracking-[0.2em] ${accentClass}`}>{kicker}</p>
      <h2 className="mt-2 text-lg font-bold text-white">{title}</h2>
      <p className="mt-4 text-sm leading-relaxed text-gray-400">{body}</p>
    </section>
  );
}
