import { cn } from "@/lib/cn";

export type Pro2ButtonVariant = "primary" | "secondary" | "ghost";

const base =
  "inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-400 disabled:pointer-events-none disabled:opacity-40";

const variants: Record<Pro2ButtonVariant, string> = {
  primary:
    "empathy-btn-gradient text-white focus-visible:outline-pink-400 shadow-lg shadow-purple-500/25",
  secondary:
    "border border-white/15 bg-white/5 text-white backdrop-blur-xl hover:border-purple-500/40 hover:bg-white/10",
  ghost: "border border-transparent text-gray-400 hover:bg-white/10 hover:text-white",
};

export function pro2ButtonClassName(variant: Pro2ButtonVariant = "primary", className?: string): string {
  return cn(base, variants[variant], className);
}

type Pro2ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Pro2ButtonVariant;
};

export function Pro2Button({ className, variant = "primary", type = "button", ...props }: Pro2ButtonProps) {
  return <button type={type} className={pro2ButtonClassName(variant, className)} {...props} />;
}
