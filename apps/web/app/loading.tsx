/** Fallback navigazione globale (allineato allo skeleton moduli shell). */
export default function RootLoading() {
  return (
    <div
      id="main-content"
      tabIndex={-1}
      className="flex min-h-screen scroll-mt-0 flex-col items-center justify-center gap-4 px-6 outline-none"
    >
      <div
        className="h-1 w-36 animate-pulse rounded-full bg-gradient-to-r from-purple-500/50 via-pink-500/50 to-orange-500/50"
        aria-hidden
      />
      <p className="font-mono text-[0.6rem] uppercase tracking-[0.3em] text-gray-600">Caricamento</p>
    </div>
  );
}
