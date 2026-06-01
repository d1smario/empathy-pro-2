import type { ReactNode } from "react";

type MobileModulePageShellProps = {
  title: string;
  eyebrow?: string;
  description?: ReactNode;
  children: ReactNode;
};

/** Contenitore pagina mobile: colonna stretta, safe-area, niente offset sidebar. */
export function MobileModulePageShell({ title, eyebrow, description, children }: MobileModulePageShellProps) {
  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-6 pt-2 sm:px-5">
      <header className="border-b border-white/10 pb-4">
        {eyebrow ? (
          <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.22em] text-orange-400">{eyebrow}</p>
        ) : null}
        <h1 className="mt-1 text-2xl font-black tracking-tight text-white">{title}</h1>
        {description ? <div className="mt-2 text-sm text-gray-400">{description}</div> : null}
      </header>
      <div className="mt-6 space-y-6">{children}</div>
    </div>
  );
}
