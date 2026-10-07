import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { z } from "zod";
import { rolesFrom } from "../../plugins/auth.js";
import { sanitizeText } from "../../common/sanitize.js";
import { clearSynonymCache, expansionClauses, normaliseTerm } from "../../common/search.js";
import { publicWhere } from "../../common/public.js";
import { audit, idParams, invalid, pageQuery } from "./admin.service.js";

// Search synonyms (ADMIN and SUPER_ADMIN). A Bangla word or a Banglish spelling is mapped to English words and an
// optional category, and the public search then matches those too. Changes show within seconds: every write clears
// the search cache of this server. Rows from the shipped starter list carry starter=true until a person edits them.

const MAX_ROWS = 2000;
const MAX_IMPORT_LINES = 500;

const term = z
  .string()
  .trim()
  .min(1, "Enter the word people search for.")
  .max(60, "Keep the word under 60 characters.")
  .transform(normaliseTerm)
  .refine((v) => v.length > 0, "Enter the word people search for.")
  .refine((v) => /^[ঀ-৿a-z0-9 -]+$/.test(v), "Use Bangla or English letters, numbers, spaces and hyphens only.");

// A leading # is dropped because service tags are written with it, the search does not need it.
const expansion = z
  .string()
  .trim()
  .transform((v) => sanitizeText(v).replace(/^#+/, "").trim())
  .refine((v) => v.length >= 2 && v.length <= 40, "Each expansion needs 2 to 40 characters.");
const expansions = z.array(expansion).min(1, "Add at least one expansion.").max(8, "Use at most 8 expansions.");
const categoryId = z.string().min(1).max(64).nullable().optional();

const entry = z
  .object({ term, expansions, categoryId })
  .strict()
  .superRefine((v, ctx) => {
    const seen = new Set<string>();
    for (const e of v.expansions) {
      const n = normaliseTerm(e);
      if (n === v.term) ctx.addIssue({ code: "custom", path: ["expansions"], message: "An expansion cannot be the same as the word itself." });
      if (seen.has(n)) ctx.addIssue({ code: "custom", path: ["expansions"], message: "Remove the repeated expansion." });
      seen.add(n);
    }
  });
const patch = z.object({ term: term.optional(), expansions: expansions.optional(), categoryId }).strict();
const listQuery = pageQuery.extend({ q: z.string().trim().max(60).optional() });
const importBody = z.object({ text: z.string().max(100_000), apply: z.boolean().default(false) }).strict();

const synonymsAdminRoutes: FastifyPluginAsync = async (app) => {
  const admins = { preHandler: app.requireRole(...rolesFrom("ADMIN")) };
  const include = { category: { select: { id: true, name: true, slug: true } } } as const;

  app.get("/synonyms", admins, async (req, reply) => {
    const q = listQuery.safeParse(req.query);
    if (!q.success) return invalid(reply, q.error);
    const needle = q.data.q ? normaliseTerm(q.data.q) : "";
    const where = q.data.q
      ? { OR: [{ term: { contains: needle || q.data.q } }, { expansions: { has: q.data.q.replace(/^#+/, "") } }] }
      : {};
    const [total, items, starterCount, categories] = await app.prisma.$transaction([
      app.prisma.searchSynonym.count({ where }),
      app.prisma.searchSynonym.findMany({ where, include, orderBy: { term: "asc" }, skip: (q.data.page - 1) * q.data.pageSize, take: q.data.pageSize }),
      app.prisma.searchSynonym.count({ where: { starter: true } }),
      app.prisma.category.findMany({ where: { status: "APPROVED" }, select: { id: true, name: true, slug: true }, orderBy: { sortOrder: "asc" } }),
    ]);
    return { items, total, page: q.data.page, pageSize: q.data.pageSize, starterCount, categories, maxRows: MAX_ROWS };
  });

  async function categoryExists(id: string | null | undefined) {
    return !id || !!(await app.prisma.category.findUnique({ where: { id }, select: { id: true } }));
  }
  const clash = (reply: FastifyReply, field: string, message: string, code = 400) =>
    reply.code(code).send({ error: "Please check the highlighted fields.", fieldErrors: { [field]: message } });

  app.post("/synonyms", admins, async (req, reply) => {
    const body = entry.safeParse(req.body);
    if (!body.success) return invalid(reply, body.error);
    if (!(await categoryExists(body.data.categoryId))) return clash(reply, "categoryId", "Choose a category from the list.");
    if (await app.prisma.searchSynonym.findUnique({ where: { term: body.data.term } })) return clash(reply, "term", "This word is already in the list. Edit that row instead.", 409);
    if ((await app.prisma.searchSynonym.count()) >= MAX_ROWS) return clash(reply, "term", `The list is full (${MAX_ROWS} rows). Remove rows you no longer need.`);
    const row = await app.prisma.$transaction(async (tx) => {
      const r = await tx.searchSynonym.create({ data: { term: body.data.term, expansions: body.data.expansions, categoryId: body.data.categoryId ?? null }, include });
      await audit(tx, req.admin!.id, "CREATE_SYNONYM", "SearchSynonym", r.id, { term: r.term, expansions: r.expansions, categoryId: r.categoryId });
      return r;
    });
    clearSynonymCache();
    return reply.code(201).send(row);
  });

  app.patch("/synonyms/:id", admins, async (req, reply) => {
    const p = idParams.safeParse(req.params);
    if (!p.success) return reply.code(404).send({ error: "Not found" });
    const body = patch.safeParse(req.body);
    if (!body.success) return invalid(reply, body.error);
    const current = await app.prisma.searchSynonym.findUnique({ where: { id: p.data.id } });
    if (!current) return reply.code(404).send({ error: "Not found" });
    // The merged row has to pass the same rules as a new one.
    const merged = entry.safeParse({
      term: body.data.term ?? current.term,
      expansions: body.data.expansions ?? current.expansions,
      categoryId: body.data.categoryId === undefined ? current.categoryId : body.data.categoryId,
    });
    if (!merged.success) return invalid(reply, merged.error);
    if (!(await categoryExists(merged.data.categoryId))) return clash(reply, "categoryId", "Choose a category from the list.");
    if (merged.data.term !== current.term && (await app.prisma.searchSynonym.findUnique({ where: { term: merged.data.term } }))) {
      return clash(reply, "term", "This word is already in the list.", 409);
    }
    const row = await app.prisma.$transaction(async (tx) => {
      const r = await tx.searchSynonym.update({
        where: { id: current.id },
        data: { term: merged.data.term, expansions: merged.data.expansions, categoryId: merged.data.categoryId ?? null, starter: false },
        include,
      });
      await audit(tx, req.admin!.id, "UPDATE_SYNONYM", "SearchSynonym", r.id, {
        from: { term: current.term, expansions: current.expansions, categoryId: current.categoryId },
        to: { term: r.term, expansions: r.expansions, categoryId: r.categoryId },
      });
      return r;
    });
    clearSynonymCache();
    return row;
  });

  app.delete("/synonyms/:id", admins, async (req, reply) => {
    const p = idParams.safeParse(req.params);
    if (!p.success) return reply.code(404).send({ error: "Not found" });
    const current = await app.prisma.searchSynonym.findUnique({ where: { id: p.data.id } });
    if (!current) return reply.code(404).send({ error: "Not found" });
    await app.prisma.$transaction(async (tx) => {
      await tx.searchSynonym.delete({ where: { id: current.id } });
      await audit(tx, req.admin!.id, "DELETE_SYNONYM", "SearchSynonym", current.id, { term: current.term, expansions: current.expansions });
    });
    clearSynonymCache();
    return { ok: true };
  });

  // Lines look like: term | expansion1, expansion2 | category-slug. The category is optional. A dry run (apply false)
  // writes nothing and shows what each line would do and how many public listings its expansions match. Apply only
  // runs when every line is valid.
  app.post("/synonyms/import", admins, async (req, reply) => {
    const body = importBody.safeParse(req.body);
    if (!body.success) return invalid(reply, body.error);
    const lines = body.data.text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length === 0) return clash(reply, "text", "Paste at least one line.");
    if (lines.length > MAX_IMPORT_LINES) return clash(reply, "text", `Paste at most ${MAX_IMPORT_LINES} lines at a time.`);
    const cats = new Map((await app.prisma.category.findMany({ select: { id: true, slug: true } })).map((c) => [c.slug, c.id]));
    const existing = new Set((await app.prisma.searchSynonym.findMany({ select: { term: true } })).map((r) => r.term));
    type Line = { line: number; text: string; status: "new" | "update" | "error"; error?: string; term?: string; expansions?: string[]; categoryId?: string | null; matches?: number };
    const seen = new Set<string>();
    const out: Line[] = [];
    for (const [i, text] of lines.entries()) {
      const parts = text.split("|").map((s) => s.trim());
      const fail = (error: string) => out.push({ line: i + 1, text, status: "error", error });
      if (parts.length < 2 || parts.length > 3) { fail("Use: word | expansion, expansion | category-slug"); continue; }
      let cat: string | null = null;
      if (parts[2]) {
        cat = cats.get(parts[2]) ?? null;
        if (!cat) { fail(`Unknown category "${parts[2]}".`); continue; }
      }
      const parsed = entry.safeParse({ term: parts[0], expansions: parts[1]!.split(",").map((s) => s.trim()).filter(Boolean), categoryId: cat });
      if (!parsed.success) { fail(parsed.error.issues[0]!.message); continue; }
      if (seen.has(parsed.data.term)) { fail("This word appears twice in the pasted lines."); continue; }
      seen.add(parsed.data.term);
      const matches = await app.prisma.business.count({ where: publicWhere({ OR: await expansionClauses(app.prisma, { expansions: parsed.data.expansions, categoryId: cat }) }) });
      out.push({ line: i + 1, text, status: existing.has(parsed.data.term) ? "update" : "new", term: parsed.data.term, expansions: parsed.data.expansions, categoryId: cat, matches });
    }
    const errors = out.filter((l) => l.status === "error").length;
    const created = out.filter((l) => l.status === "new").length;
    const updated = out.filter((l) => l.status === "update").length;
    const summary = { created, updated, errors, lines: out };
    if (!body.data.apply) return { applied: false, ...summary };
    if (errors > 0) return reply.code(400).send({ error: "Fix the lines marked with an error first. Nothing was saved.", applied: false, ...summary });
    if (existing.size + created > MAX_ROWS) return clash(reply, "text", `The list would pass ${MAX_ROWS} rows. Nothing was saved.`);
    await app.prisma.$transaction(async (tx) => {
      for (const l of out) {
        const data = { expansions: l.expansions!, categoryId: l.categoryId ?? null, starter: false };
        await tx.searchSynonym.upsert({ where: { term: l.term! }, update: data, create: { term: l.term!, ...data } });
      }
      await audit(tx, req.admin!.id, "IMPORT_SYNONYMS", "SearchSynonym", "import", { created, updated });
    });
    clearSynonymCache();
    return { applied: true, ...summary };
  });
};

export default synonymsAdminRoutes;
