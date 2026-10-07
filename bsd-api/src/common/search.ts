import { Prisma, type PrismaClient } from "@prisma/client";

// Public search text handling, including the admin-editable synonym table (M10-A). A search for a Bangla word or a
// Banglish spelling also matches the English expansions and category the admin mapped it to. A word with no synonym
// is searched exactly as before.

const BANGLA_DIGITS = "০১২৩৪৫৬৭৮৯";

/** One form for a word so spellings compare equal: NFC, lowercase, no zero width characters, ASCII digits, single spaces. */
export function normaliseTerm(s: string): string {
  return s
    .normalize("NFC")
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[০-৯]/g, (d) => String(BANGLA_DIGITS.indexOf(d)))
    .replace(/\s+/g, " ")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{M}\p{N}]+$/gu, "")
    .trim();
}

// LIKE wildcards in the search text would otherwise match far too much.
export const cleanWord = (w: string) => w.replace(/[%_\\]/g, "");

export type SynonymEntry = { term: string; expansions: string[]; categoryId: string | null };
export type ExpandedFrom = { term: string; expansions: string[] };

let cache: { at: number; map: Map<string, SynonymEntry> } | null = null;
const TTL_MS = 60_000;

/** Called after every admin write so a change shows at once on this server. */
export function clearSynonymCache() {
  cache = null;
}

async function synonymMap(prisma: PrismaClient): Promise<Map<string, SynonymEntry>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.map;
  const rows = await prisma.searchSynonym.findMany({ select: { term: true, expansions: true, categoryId: true } });
  cache = { at: Date.now(), map: new Map(rows.map((r) => [r.term, r])) };
  return cache.map;
}

/**
 * Ids of APPROVED listings with a service that contains one of the words, ignoring case. Prisma cannot do a
 * case-insensitive match on the elements of a text[] column, so this one field uses a parameterised query.
 * The ids are only ever used as one more condition inside publicWhere(), so this cannot widen what is public.
 */
async function serviceMatchIds(prisma: PrismaClient, words: string[]): Promise<string[]> {
  const patterns = words.map((w) => "%" + w + "%");
  const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT "id" FROM "Business"
    WHERE "status" = 'APPROVED' AND array_to_string("servicesOffered", ' ') ILIKE ANY (${patterns}::text[])`);
  return rows.map((r) => r.id);
}

/** The fields a word may match: name, description, category, subcategory and services. */
async function fieldClauses(prisma: PrismaClient, words: string[]): Promise<Prisma.BusinessWhereInput[]> {
  const ids = await serviceMatchIds(prisma, words);
  return [
    ...words.flatMap((w) => [
      { name: { contains: w, mode: "insensitive" as const } },
      { description: { contains: w, mode: "insensitive" as const } },
      { category: { name: { contains: w, mode: "insensitive" as const } } },
      { subcategory: { name: { contains: w, mode: "insensitive" as const } } },
    ]),
    { id: { in: ids } },
  ];
}

/** Everything one synonym adds: its expansions on every field, and its category. Also used for the import match counts. */
export async function expansionClauses(prisma: PrismaClient, e: { expansions: string[]; categoryId: string | null }): Promise<Prisma.BusinessWhereInput[]> {
  const words = e.expansions.map(cleanWord).filter((w) => w.length > 0);
  const clauses = words.length ? await fieldClauses(prisma, words) : [];
  if (e.categoryId) clauses.push({ categoryId: e.categoryId });
  return clauses;
}

const splitWords = (q: string) =>
  q
    .split(/\s+/)
    .map(cleanWord)
    .filter((w) => w.length > 0)
    .slice(0, 5);

/** What the synonym table added for this search text, for the "Also showing results for" line. Empty for most searches. */
export async function expandedFrom(prisma: PrismaClient, q: string): Promise<ExpandedFrom[]> {
  return (await lookup(prisma, q)).hits.map(({ term, expansions }) => ({ term, expansions }));
}

async function lookup(prisma: PrismaClient, q: string) {
  const words = splitWords(q);
  const map = await synonymMap(prisma);
  const perWord = words.map((w) => map.get(normaliseTerm(w)));
  const phrase = words.length > 1 ? map.get(normaliseTerm(words.join(" "))) : undefined;
  const hits = [...(phrase ? [phrase] : []), ...perWord.filter((e): e is SynonymEntry => !!e)];
  return { words, perWord, phrase, hits };
}

export async function searchClause(prisma: PrismaClient, q: string): Promise<Prisma.BusinessWhereInput[]> {
  const { words, perWord, phrase } = await lookup(prisma, q);
  // Search text made only of wildcard characters has no usable words, so it matches nothing.
  if (words.length === 0) return [{ id: { in: [] } }];
  // Every word must match somewhere, in any of these fields or in what its synonym adds.
  const clauses = await Promise.all(
    words.map(async (w, i) => ({
      OR: [...(await fieldClauses(prisma, [w])), ...(perWord[i] ? await expansionClauses(prisma, perWord[i]!) : [])],
    }))
  );
  // A whole phrase mapping (for example "cupping therapy") is an alternative to the word by word match.
  if (phrase) return [{ OR: [{ AND: clauses }, ...(await expansionClauses(prisma, phrase))] }];
  return clauses;
}
