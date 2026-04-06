import { ShellWithAdaptiveBackdrop } from "@/components/shell/ShellWithAdaptiveBackdrop";

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return <ShellWithAdaptiveBackdrop>{children}</ShellWithAdaptiveBackdrop>;
}
