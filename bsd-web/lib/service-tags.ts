// Suggested "Services Offered" tags of a category. A tag is stored and typed without the leading #, screens show it with one.
// The Services offered field holds one service per line, so choosing a tag adds a line and choosing it again removes it.

export const showTag = (tag: string) => `#${tag}`;

const norm = (line: string) => line.trim().replace(/^#+/, "").trim().toLowerCase();

/** True when the field already has this tag as a line (any case, with or without the #). */
export function hasTag(text: string, tag: string): boolean {
  return text.split("\n").some((line) => norm(line) === tag.toLowerCase());
}

/** Adds the tag as a new line, or removes its line when it is already there. Other lines are left exactly as typed. */
export function toggleTag(text: string, tag: string): string {
  if (hasTag(text, tag)) return text.split("\n").filter((line) => norm(line) !== tag.toLowerCase()).join("\n");
  const base = text.replace(/\s+$/, "");
  return base ? `${base}\n${tag}` : tag;
}
