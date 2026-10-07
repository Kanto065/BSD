// Mirrors bsd-api DESCRIPTION_MIN_CHARS and the 150 word maximum. Keep the two in step.
export const DESCRIPTION_MIN_CHARS = 150;
export const DESCRIPTION_MAX_WORDS = 150;
export const DESCRIPTION_TOO_SHORT = `The short description must be at least ${DESCRIPTION_MIN_CHARS} characters.`;
export const DESCRIPTION_TOO_LONG = `The short description must be ${DESCRIPTION_MAX_WORDS} words or fewer.`;

export function descriptionStatus(text: string) {
  const trimmed = text.trim();
  const chars = trimmed.length;
  const words = trimmed.split(/\s+/).filter(Boolean).length;
  const ok = chars >= DESCRIPTION_MIN_CHARS && words <= DESCRIPTION_MAX_WORDS;
  const message = chars < DESCRIPTION_MIN_CHARS ? DESCRIPTION_TOO_SHORT : words > DESCRIPTION_MAX_WORDS ? DESCRIPTION_TOO_LONG : "";
  let counter = chars >= DESCRIPTION_MIN_CHARS ? `${chars} characters` : `${chars} of ${DESCRIPTION_MIN_CHARS} characters minimum`;
  if (chars > 0 && chars < DESCRIPTION_MIN_CHARS) counter += `, ${DESCRIPTION_MIN_CHARS - chars} more needed`;
  if (words > DESCRIPTION_MAX_WORDS) counter += `, ${words - DESCRIPTION_MAX_WORDS} words over the limit`;
  return { chars, words, ok, message, counter };
}
