import sanitizeHtml from "sanitize-html";

// Turns user-submitted free text into plain text before it is stored. These fields (description, servicesOffered,
// ownerName, address, openingHours, specialNotes, otherAreaText...) render back on public pages, so this runs at write
// time, not just at render time. Plain-text directory fields have no use for HTML, so every tag is removed.
//
// sanitize-html returns HTML-escaped text ("Fish & Chips" becomes "Fish &amp; Chips"). The directory stores plain
// text and the website escapes it when rendering, so the escaping is undone here. Otherwise visitors would see
// "&amp;" on the page.
const ENTITIES: Record<string, string> = { "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&#x27;": "'", "&nbsp;": " " };

function unescapeText(value: string): string {
  return value.replace(/&(lt|gt|quot|#39|#x27|nbsp);/g, (m) => ENTITIES[m]).replace(/&amp;/g, "&");
}

export function sanitizeText(value: string): string {
  const stripped = sanitizeHtml(value, { allowedTags: [], allowedAttributes: {}, disallowedTagsMode: "discard" });
  return unescapeText(stripped)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "") // control characters, keeping tab and newlines
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function sanitizeTextArray(values: string[]): string[] {
  return values.map(sanitizeText).filter((v) => v.length > 0);
}
