/** Same rule as the API: a rejection reason is 5 to 300 characters once trimmed. Returns an error message or null. */
export function rejectReasonError(reason: string): string | null {
  const n = reason.trim().length;
  if (n < 5) return "Give a reason of at least 5 characters.";
  if (n > 300) return "Keep the reason to 300 characters.";
  return null;
}

export const fmtOfferPercent = (p: number | null | undefined) => (p == null ? "No percentage" : `${Number.isInteger(p) ? p : p.toFixed(1)}% off`);
