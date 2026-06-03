import { performance } from "node:perf_hooks";

type ServerTimingMark = {
  name: string;
  durMs: number;
  desc?: string;
};

/** Lightweight Server-Timing header builder for hot API routes. */
export class ServerTiming {
  private readonly marks: ServerTimingMark[] = [];

  mark(name: string, startMs: number, desc?: string): void {
    this.marks.push({
      name,
      durMs: performance.now() - startMs,
      desc,
    });
  }

  headerValue(): string | null {
    if (!this.marks.length) return null;
    return this.marks
      .map((m) => {
        const dur = m.durMs.toFixed(1);
        if (m.desc) return `${m.name};dur=${dur};desc="${m.desc.replace(/"/g, "'")}"`;
        return `${m.name};dur=${dur}`;
      })
      .join(", ");
  }

  applyTo(headers: Headers): void {
    const value = this.headerValue();
    if (value) headers.set("Server-Timing", value);
  }
}

export function serverTimingNow(): number {
  return performance.now();
}
