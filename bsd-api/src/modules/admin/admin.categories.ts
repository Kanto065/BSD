import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { rolesFrom } from "../../plugins/auth.js";
import { CATEGORY_ICONS } from "../../common/category-icons.js";
import { sanitizeText } from "../../common/sanitize.js";
import { slugify } from "../../common/slug.js";
import { audit, idParams, invalid } from "./admin.service.js";

// Category and subcategory management (ADMIN and SUPER_ADMIN). The website reads categories from the public API, so
// changes appear on the site within about a minute. Nothing that a listing uses can be deleted, and a slug (the web
// address) only changes when someone changes it on purpose.

const name = z.string().trim().min(2, "Enter a name.").max(80, "Keep the name under 80 characters.");
const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens.")
  .max(80);
const icon = z.enum(CATEGORY_ICONS, { errorMap: () => ({ message: "Choose an icon from the list." }) });
const description = z.string().trim().max(300).nullable();

const createCategory = z.object({ name, description: description.optional(), icon: icon.optional(), requiresOwnerName: z.boolean().optional() }).strict();
const updateCategory = z.object({ name, slug, description, icon, requiresOwnerName: z.boolean() }).partial().strict();
const reorder = z.object({ ids: z.array(z.string().min(1).max(64)).min(1).max(200) }).strict();
const subBody = z.object({ name }).strict();

const categoriesAdminRoutes: FastifyPluginAsync = async (app) => {
  const admins = { preHandler: app.requireRole(...rolesFrom("ADMIN")) };

  app.get("/categories", admins, async () => {
    const rows = await app.prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        _count: { select: { businesses: true } },
        subcategories: { orderBy: { name: "asc" }, include: { _count: { select: { businesses: true } } } },
      },
    });
    return {
      icons: CATEGORY_ICONS,
      categories: rows.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        icon: c.icon,
        sortOrder: c.sortOrder,
        requiresOwnerName: c.requiresOwnerName,
        listingCount: c._count.businesses,
        subcategories: c.subcategories.map((s) => ({ id: s.id, name: s.name, slug: s.slug, listingCount: s._count.businesses })),
      })),
    };
  });

  app.post("/categories", admins, async (req, reply) => {
    const body = createCategory.safeParse(req.body);
    if (!body.success) return invalid(reply, body.error);
    const clean = sanitizeText(body.data.name);
    const newSlug = slugify(clean);
    if (!newSlug) return reply.code(400).send({ error: "Please check the highlighted fields.", fieldErrors: { name: "Use letters or numbers in the name." } });
    const clash = await app.prisma.category.findFirst({ where: { OR: [{ name: clean }, { slug: newSlug }] } });
    if (clash) return reply.code(409).send({ error: "Please check the highlighted fields.", fieldErrors: { name: "A category with this name already exists." } });
    const last = await app.prisma.category.aggregate({ _max: { sortOrder: true } });
    const category = await app.prisma.$transaction(async (tx) => {
      const c = await tx.category.create({
        data: {
          name: clean,
          slug: newSlug,
          description: body.data.description ? sanitizeText(body.data.description) : null,
          icon: body.data.icon ?? "package",
          requiresOwnerName: body.data.requiresOwnerName ?? false,
          sortOrder: (last._max.sortOrder ?? -1) + 1,
        },
      });
      await audit(tx, req.admin!.id, "CREATE_CATEGORY", "Category", c.id, { name: c.name, slug: c.slug });
      return c;
    });
    return reply.code(201).send({ category });
  });

  app.patch("/categories/:id", admins, async (req, reply) => {
    const p = idParams.safeParse(req.params);
    if (!p.success) return reply.code(404).send({ error: "Not found" });
    const body = updateCategory.safeParse(req.body);
    if (!body.success) return invalid(reply, body.error);
    const current = await app.prisma.category.findUnique({ where: { id: p.data.id } });
    if (!current) return reply.code(404).send({ error: "Not found" });

    const data: Record<string, unknown> = {};
    if (body.data.name !== undefined) data.name = sanitizeText(body.data.name);
    if (body.data.slug !== undefined) data.slug = body.data.slug;
    if (body.data.description !== undefined) data.description = body.data.description ? sanitizeText(body.data.description) : null;
    if (body.data.icon !== undefined) data.icon = body.data.icon;
    if (body.data.requiresOwnerName !== undefined) data.requiresOwnerName = body.data.requiresOwnerName;

    const errors: Record<string, string> = {};
    if (data.name && data.name !== current.name && (await app.prisma.category.findUnique({ where: { name: data.name as string } }))) {
      errors.name = "A category with this name already exists.";
    }
    if (data.slug && data.slug !== current.slug && (await app.prisma.category.findUnique({ where: { slug: data.slug as string } }))) {
      errors.slug = "Another category already uses this web address.";
    }
    if (Object.keys(errors).length) return reply.code(409).send({ error: "Please check the highlighted fields.", fieldErrors: errors });

    const changes = Object.fromEntries(
      Object.entries(data)
        .filter(([k, v]) => (current as Record<string, unknown>)[k] !== v)
        .map(([k, v]) => [k, { from: (current as Record<string, unknown>)[k], to: v }])
    );
    if (!Object.keys(changes).length) return { ok: true, changed: [] };
    await app.prisma.$transaction([
      app.prisma.category.update({ where: { id: current.id }, data }),
      audit(app.prisma, req.admin!.id, "EDIT_CATEGORY", "Category", current.id, changes as never),
    ]);
    return { ok: true, changed: Object.keys(changes) };
  });

  // The order the categories appear in on the site. The first 14 are the homepage tiles.
  app.post("/categories/reorder", admins, async (req, reply) => {
    const body = reorder.safeParse(req.body);
    if (!body.success) return invalid(reply, body.error);
    const all = await app.prisma.category.findMany({ select: { id: true } });
    const ids = new Set(all.map((c) => c.id));
    if (body.data.ids.length !== ids.size || new Set(body.data.ids).size !== ids.size || body.data.ids.some((id) => !ids.has(id))) {
      return reply.code(400).send({ error: "Send every category exactly once." });
    }
    await app.prisma.$transaction([
      ...body.data.ids.map((id, index) => app.prisma.category.update({ where: { id }, data: { sortOrder: index } })),
      audit(app.prisma, req.admin!.id, "REORDER_CATEGORIES", "Category", "all", { order: body.data.ids }),
    ]);
    return { ok: true };
  });

  app.delete("/categories/:id", admins, async (req, reply) => {
    const p = idParams.safeParse(req.params);
    if (!p.success) return reply.code(404).send({ error: "Not found" });
    const c = await app.prisma.category.findUnique({ where: { id: p.data.id }, include: { _count: { select: { businesses: true } } } });
    if (!c) return reply.code(404).send({ error: "Not found" });
    if (c._count.businesses > 0) {
      return reply.code(409).send({ error: `This category has ${c._count.businesses} listing(s). Move them to another category first.` });
    }
    await app.prisma.$transaction([
      app.prisma.subcategory.deleteMany({ where: { categoryId: c.id } }),
      app.prisma.category.delete({ where: { id: c.id } }),
      audit(app.prisma, req.admin!.id, "DELETE_CATEGORY", "Category", c.id, { name: c.name, slug: c.slug }),
    ]);
    return { ok: true };
  });

  // --- subcategories --------------------------------------------------------------------------------------------

  app.post("/categories/:id/subcategories", admins, async (req, reply) => {
    const p = idParams.safeParse(req.params);
    if (!p.success) return reply.code(404).send({ error: "Not found" });
    const body = subBody.safeParse(req.body);
    if (!body.success) return invalid(reply, body.error);
    const c = await app.prisma.category.findUnique({ where: { id: p.data.id } });
    if (!c) return reply.code(404).send({ error: "Not found" });
    const clean = sanitizeText(body.data.name);
    if (await app.prisma.subcategory.findFirst({ where: { categoryId: c.id, name: clean } })) {
      return reply.code(409).send({ error: "Please check the highlighted fields.", fieldErrors: { name: "This category already has that subcategory." } });
    }
    // Same slug rule as the seed ("category-name-subcategory-name"), made unique if a renamed category collides.
    let s = slugify(`${c.name}-${clean}`);
    if (await app.prisma.subcategory.findUnique({ where: { slug: s } })) s = `${s}-${Date.now().toString(36)}`;
    const sub = await app.prisma.$transaction(async (tx) => {
      const created = await tx.subcategory.create({ data: { name: clean, slug: s, categoryId: c.id } });
      await audit(tx, req.admin!.id, "CREATE_SUBCATEGORY", "Category", c.id, { subcategory: clean });
      return created;
    });
    return reply.code(201).send({ subcategory: sub });
  });

  app.patch("/subcategories/:id", admins, async (req, reply) => {
    const p = idParams.safeParse(req.params);
    if (!p.success) return reply.code(404).send({ error: "Not found" });
    const body = subBody.safeParse(req.body);
    if (!body.success) return invalid(reply, body.error);
    const sub = await app.prisma.subcategory.findUnique({ where: { id: p.data.id } });
    if (!sub) return reply.code(404).send({ error: "Not found" });
    const clean = sanitizeText(body.data.name);
    if (clean !== sub.name && (await app.prisma.subcategory.findFirst({ where: { categoryId: sub.categoryId, name: clean } }))) {
      return reply.code(409).send({ error: "Please check the highlighted fields.", fieldErrors: { name: "This category already has that subcategory." } });
    }
    // The slug stays the same, so links and listings keep working after a rename.
    await app.prisma.$transaction([
      app.prisma.subcategory.update({ where: { id: sub.id }, data: { name: clean } }),
      audit(app.prisma, req.admin!.id, "RENAME_SUBCATEGORY", "Category", sub.categoryId, { from: sub.name, to: clean }),
    ]);
    return { ok: true };
  });

  app.delete("/subcategories/:id", admins, async (req, reply) => {
    const p = idParams.safeParse(req.params);
    if (!p.success) return reply.code(404).send({ error: "Not found" });
    const sub = await app.prisma.subcategory.findUnique({ where: { id: p.data.id }, include: { _count: { select: { businesses: true } } } });
    if (!sub) return reply.code(404).send({ error: "Not found" });
    if (sub._count.businesses > 0) {
      return reply.code(409).send({ error: `This subcategory has ${sub._count.businesses} listing(s). Change their subcategory first.` });
    }
    await app.prisma.$transaction([
      app.prisma.subcategory.delete({ where: { id: sub.id } }),
      audit(app.prisma, req.admin!.id, "DELETE_SUBCATEGORY", "Category", sub.categoryId, { subcategory: sub.name }),
    ]);
    return { ok: true };
  });
};

export default categoriesAdminRoutes;
