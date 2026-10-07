export const SPEND = { min: 10, max: 500, step: 10, start: 100 } as const;
export const PERCENT = { min: 1, max: 25, step: 1, start: 10 } as const;

/** Whole pounds saved in a year from the two slider values only. Out of range input is clamped. */
export function annualSaving(monthlySpend: number, percent: number): number {
  const s = Math.min(SPEND.max, Math.max(0, monthlySpend));
  const p = Math.min(100, Math.max(0, percent));
  return Math.round((s * 12 * p) / 100);
}
