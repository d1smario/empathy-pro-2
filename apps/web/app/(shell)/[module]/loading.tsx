/** Skeleton leggero per transizione tra moduli (stesso linguaggio cromatico preview). */
export default function ModuleRouteLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6">
      <div
        className="h-1 w-36 animate-pulse rounded-full bg-gradient-to-r from-purple-500/50 via-pink-500/50 to-orange-500/50"
        aria-hidden
      />
      <p className="font-mono text-[0.6rem] uppercase tracking-[0.3em] text-gray-600">Caricamento</p>
    </div>
  );
}
