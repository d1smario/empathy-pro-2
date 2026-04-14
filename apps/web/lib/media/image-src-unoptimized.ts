/** True when `next/image` should skip optimization (remote, dynamic API, SVG). */
export function imageSrcUnoptimized(src: string): boolean {
  return (
    src.startsWith("http://") ||
    src.startsWith("https://") ||
    src.startsWith("/api/") ||
    src.endsWith(".svg")
  );
}
