/** Durata seduta sul calendario (coach): scelte nel Builder e in libreria. */
export const PLANNED_SESSION_DURATION_MAX_MIN = 720;

const FINE_STEP_MIN = 5;
const FINE_END_MIN = 120;
const COARSE_STEP_MIN = 15;
const COARSE_START_MIN = 135;

function buildChoices(): number[] {
  const fine: number[] = [];
  for (let m = 30; m <= FINE_END_MIN; m += FINE_STEP_MIN) fine.push(m);
  const coarse: number[] = [];
  for (let m = COARSE_START_MIN; m <= PLANNED_SESSION_DURATION_MAX_MIN; m += COARSE_STEP_MIN) {
    coarse.push(m);
  }
  if (coarse[coarse.length - 1] !== PLANNED_SESSION_DURATION_MAX_MIN) {
    coarse.push(PLANNED_SESSION_DURATION_MAX_MIN);
  }
  return [...fine, ...coarse];
}

export const SESSION_DURATION_CHOICES: readonly number[] = buildChoices();

export function normalizeSessionDurationMinutes(raw: number): number {
  const n = Math.round(Number(raw) || 0);
  if (!Number.isFinite(n) || n <= 0) return SESSION_DURATION_CHOICES[0] ?? 30;
  const clamped = Math.max(1, Math.min(PLANNED_SESSION_DURATION_MAX_MIN, n));
  if (SESSION_DURATION_CHOICES.includes(clamped)) return clamped;
  let best = SESSION_DURATION_CHOICES[0] ?? 30;
  let bestDist = Math.abs(clamped - best);
  for (const c of SESSION_DURATION_CHOICES) {
    const d = Math.abs(clamped - c);
    if (d < bestDist) {
      best = c;
      bestDist = d;
    }
  }
  return best;
}
