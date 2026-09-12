import sanitizeHtml from "sanitize-html";

// Strips all markup from user-submitted free text before it's stored — these fields
// (description, servicesOffered, ownerName, address, openingHours, specialNotes,
// otherAreaText) render back on public listing pages, so this must run at write time,
// not just at render time. Plain-text directory fields have no legitimate use for
// HTML, so the allowlist is empty rather than permitting a "safe" subset of tags.
export function sanitizeText(value: string): string {
  return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }).trim();
}

export function sanitizeTextArray(values: string[]): string[] {
  return values.map(sanitizeText).filter((v) => v.length > 0);
}
