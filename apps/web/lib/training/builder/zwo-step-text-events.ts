/** Zwift ZWO: `<textevent timeoffset="N" message="…"/>` relativo all'inizio dello step. */

export type ZwoTextEvent = {
  offsetSec: number;
  message: string;
};

const MAX_MESSAGE_LEN = 120;

export function sanitizeCoachNoteForTextEvent(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  const withoutOrigin = t.replace(/\borigin=virya_planner\b/gi, "").replace(/\s*\|\s*/g, " ").trim();
  if (!withoutOrigin) return null;
  return withoutOrigin.slice(0, MAX_MESSAGE_LEN);
}

export function coachNoteToTextEvents(note: string | null | undefined): ZwoTextEvent[] {
  const msg = sanitizeCoachNoteForTextEvent(note);
  if (!msg) return [];
  return [{ offsetSec: 0, message: msg }];
}

export function formatZwoTextEventXml(events: ZwoTextEvent[], indent = "      "): string[] {
  const lines: string[] = [];
  for (const ev of events) {
    const off = Math.max(0, Math.round(ev.offsetSec));
    const msg = ev.message
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
    lines.push(`${indent}<textevent timeoffset="${off}" message="${msg}"/>`);
  }
  return lines;
}
