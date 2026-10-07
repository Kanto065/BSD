import { z } from "zod";

// "Services Offered" hashtags of a category. Stored without the leading #, shown with it. They are suggestions on the
// forms, not a closed list, so people can still type their own.
export const MAX_SERVICE_TAGS = 20;
export const TAG_PATTERN = /^[\p{L}\p{N}]{2,40}$/u;

/** One tag as typed: "#Halal Meat", "halal" or "#SEO," become the stored form, or null when it is not a valid tag. */
export function cleanTag(raw: string): string | null {
  const tag = raw.trim().replace(/^#+/, "").trim();
  return TAG_PATTERN.test(tag) ? tag : null;
}

/**
 * The admin field: a list, or one text with tags separated by commas, new lines or spaces. Rejects the whole input if
 * any tag is invalid or there are too many, repeats (any case) are dropped.
 */
export const serviceTagsInput = z
  .union([z.string().max(2000), z.array(z.string().max(100)).max(100)])
  .transform((value, ctx) => {
    const parts = Array.isArray(value) ? value : value.split(/[\n,\s]+/);
    const seen = new Set<string>();
    const tags: string[] = [];
    for (const part of parts) {
      if (!part.trim()) continue;
      const tag = cleanTag(part);
      if (!tag) {
        ctx.addIssue({ code: "custom", message: `"${part.trim().slice(0, 40)}" is not a valid tag. Use 2 to 40 letters or digits, no spaces.` });
        return z.NEVER;
      }
      if (seen.has(tag.toLowerCase())) continue;
      seen.add(tag.toLowerCase());
      tags.push(tag);
    }
    if (tags.length > MAX_SERVICE_TAGS) {
      ctx.addIssue({ code: "custom", message: `Use at most ${MAX_SERVICE_TAGS} tags.` });
      return z.NEVER;
    }
    return tags;
  });
