import { cn } from "@/lib/cn";

/**
 * EMPATHY in evidenza + Pro 2.0 a gradiente + titolo modulo (es. Dashboard, Training).
 */
export function ProductBrandHeader({
  moduleTitle,
  className,
}: {
  moduleTitle: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-3xl font-black tracking-[0.12em] text-white sm:text-4xl lg:text-5xl">EMPATHY</p>
      <h1 className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl">
        <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">
          Pro 2.0
        </span>
        <span className="text-lg font-bold text-gray-400 sm:text-xl lg:text-2xl">· {moduleTitle}</span>
      </h1>
    </div>
  );
}
