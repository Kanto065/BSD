import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { rolesFrom } from "../../plugins/auth.js";
import { CATEGORY_ICONS } from "../../common/category-icons.js";
import { sanitizeText } from "../../common/sanitize.js";
import { serviceTagsInput } from "../../common/service-tags.js";
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

// Subcategories can be added with the category in one go, in the order given.
const createCategory = z
  .object({ name, description: description.optional(), icon: icon.optional(), requiresOwnerName: z.boolean().optional(), serviceTags: serviceTagsInput.optional(), subcategories: z.array(name).max(40).optional() })
  .strict();
// staged true hides the category from the public lists and from new choices, false unlocks it. Tags come as a list or as
// one text separated by commas or new lines.
const updateCategory = z.object({ name, slug, description, icon, requiresOwnerName: z.boolean(), staged: z.boolean(), serviceTags: serviceTagsInput }).partial().strict();
const reorder = z.object({ ids: z.array(z.string().min(1).max(64)).min(1).max(200) }).strict();
const approveBody = z.object({ name: name.optional() }).strict();
const rejectBody = z.object({ reason: z.string().trim().max(300).optional() }).strict();
// Merge moves every listing and subcategory of the source into the target, then deletes the source. Listings that
// had no subcategory can be put into an existing subcategory of the target, or into a new one (created if missing).
const mergeBody = z
  .object({ targetId: z.string().min(1).max(64), subcategoryId: z.string().min(1).max(64).optional(), newSubcategoryName: name.optional() })
  .strict()
  .refine((b) => !(b.subcategoryId && b.newSubcategoryName), { message: "Choose an existing subcategory or a new one, not both.", path: ["subcategoryId"] });
const subBody = z.object({ name }).strict();

const categoriesAdminRoutes: FastifyPluginAsync = async (app) => {
  const admins = { preHandler: app.requireRole(...rolesFrom("ADMIN")) };

  app.get("/categories", admins, async () => {
    const rows = await app.prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        _count: { select: { businesses: true } },
        businesses: { select: { id: true, name: true }, take: 5, orderBy: { submittedAt: "asc" } },
        subcategories: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { _count: { select: { businesses: true } } } },
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
        serviceTags: c.serviceTags,
        staged: c.staged,
        status: c.status,
        submittedAt: c.submittedAt,
        // A few listings that use a category waiting for review, so the admin can judge the suggestion.
        sampleListings: c.status === "APPROVED" ? [] : c.businesses.map((b) => ({ id: b.id, name: b.name })),
        listingCount: c._count.businesses,
        subcategories: c.subcategories.map((s) => ({ id: s.id, name: s.name, slug: s.slug, sortOrder: s.sortOrder, listingCount: s._count.businesses })),
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
    const subNames = [...new Set((body.data.subcategories ?? []).map((n) => sanitizeText(n)).filter(Boolean))];
    const last = await app.prisma.category.aggregate({ _max: { sortOrder: true } });
    const category = await app.prisma.$transaction(async (tx) => {
      const c = await tx.category.create({
        data: {
          name: clean,
          slug: newSlug,
          description: body.data.description ? sanitizeText(body.data.description) : null,
          icon: body.data.icon ?? "package",
          requiresOwnerName: body.data.requiresOwnerName ?? false,
          serviceTags: body.data.serviceTags ?? [],
          sortOrder: (last._max.sortOrder ?? -1) + 1,
        },
      });
      for (const [i, subName] of subNames.entries()) {
        let s = slugify(`${c.name}-${subName}`);
        if (await tx.subcategory.findUnique({ where: { slug: s } })) s = `${s}-${Date.now().toString(36)}${i}`;
        await tx.subcategory.create({ data: { name: subName, slug: s, categoryId: c.id, sortOrder: i } });
      }
      await audit(tx, req.admin!.id, "CREATE_CATEGORY", "Category", c.id, { name: c.name, slug: c.slug, ...(subNames.length ? { subcategories: subNames } : {}) });
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
    if (body.data.staged !== undefined) data.staged = body.data.staged;
    if (body.data.serviceTags !== undefined) data.serviceTags = body.data.serviceTags;

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
        .filter(([k, v]) => JSON.stringify((current as Record<string, unknown>)[k]) !== JSON.stringify(v))
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
    // Suggested (pending or rejected) categories are not on the site, so they are not part of the order.
    const all = await app.prisma.category.findMany({ where: { status: "APPROVED" }, select: { id: true } });
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

  // "Others" moderation and merge

  // Approve a category that came from the Others field (optionally correcting its name). It then goes live on the site.
  app.post("/categories/:id/approve", admins, async (req, reply) => {
    const p = idParams.safeParse(req.params);
    if (!p.success) return reply.code(404).send({ error: "Not found" });
    const body = approveBody.safeParse(req.body ?? {});
    if (!body.success) return invalid(reply, body.error);
    const c = await app.prisma.category.findUnique({ where: { id: p.data.id } });
    if (!c) return reply.code(404).send({ error: "Not found" });
    if (c.status === "APPROVED") return reply.code(409).send({ error: "This category is already approved." });
    const newName = body.data.name ? sanitizeText(body.data.name) : c.name;
    const newSlug = newName === c.name ? c.slug : slugify(newName);
    if (!newSlug) return reply.code(400).send({ error: "Please check the highlighted fields.", fieldErrors: { name: "Use letters or numbers in the name." } });
    if (newName !== c.name) {
      const clash = await app.prisma.category.findFirst({ where: { id: { not: c.id }, OR: [{ name: { equals: newName, mode: "insensitive" } }, { slug: newSlug }] } });
      if (clash) return reply.code(409).send({ error: "Please check the highlighted fields.", fieldErrors: { name: "A category with this name already exists." } });
    }
    await app.prisma.$transaction([
      app.prisma.category.update({ where: { id: c.id }, data: { status: "APPROVED", name: newName, slug: newSlug } }),
      audit(app.prisma, req.admin!.id, "APPROVE_CATEGORY", "Category", c.id, { from: c.status, name: newName }),
    ]);
    return { ok: true };
  });

  // Reject a suggested category. Its waiting listings are rejected with the reason, and the category row stays (hidden)
  // so the same text is not suggested again.
  app.post("/categories/:id/reject", admins, async (req, reply) => {
    const p = idParams.safeParse(req.params);
    if (!p.success) return reply.code(404).send({ error: "Not found" });
    const body = rejectBody.safeParse(req.body ?? {});
    if (!body.success) return invalid(reply, body.error);
    const c = await app.prisma.category.findUnique({ where: { id: p.data.id } });
    if (!c) return reply.code(404).send({ error: "Not found" });
    if (c.status !== "PENDING") return reply.code(409).send({ error: "Only a category waiting for review can be rejected." });
    const reason = body.data.reason ? sanitizeText(body.data.reason) : "The category you suggested was not accepted.";
    const [, moved] = await app.prisma.$transaction([
      app.prisma.category.update({ where: { id: c.id }, data: { status: "REJECTED" } }),
      app.prisma.business.updateMany({
        where: { categoryId: c.id, status: "PENDING" },
        data: { status: "REJECTED", reviewedAt: new Date(), reviewedById: req.admin!.id, rejectionReason: reason },
      }),
      audit(app.prisma, req.admin!.id, "REJECT_CATEGORY", "Category", c.id, { name: c.name, reason }),
    ]);
    return { ok: true, rejectedListings: moved.count };
  });

  // Move everything from this category into another one, then delete it. Works for suggested and normal categories.
  app.post("/categories/:id/merge", admins, async (req, reply) => {
    const p = idParams.safeParse(req.params);
    if (!p.success) return reply.code(404).send({ error: "Not found" });
    const body = mergeBody.safeParse(req.body);
    if (!body.success) return invalid(reply, body.error);
    if (body.data.targetId === p.data.id) return reply.code(400).send({ error: "Choose a different category to merge into." });
    const [source, target] = await Promise.all([
      app.prisma.category.findUnique({ where: { id: p.data.id }, include: { subcategories: true } }),
      app.prisma.category.findUnique({ where: { id: body.data.targetId }, include: { subcategories: true } }),
    ]);
    if (!source || !target) return reply.code(404).send({ error: "Not found" });
    if (target.status !== "APPROVED") return reply.code(409).send({ error: "Merge into an approved category." });
    if (body.data.subcategoryId && !target.subcategories.some((s) => s.id === body.data.subcategoryId)) {
      return reply.code(400).send({ error: "Please check the highlighted fields.", fieldErrors: { subcategoryId: "Choose a subcategory of the target category." } });
    }
    const result = await app.prisma.$transaction(async (tx) => {
      const lower = (n: string) => n.toLowerCase();
      let nextSort = Math.max(-1, ...target.subcategories.map((s) => s.sortOrder)) + 1;
      // Subcategories: same name in the target means the listings join that one, otherwise the subcategory moves across.
      for (const s of source.subcategories) {
        const twin = target.subcategories.find((t) => lower(t.name) === lower(s.name));
        if (twin) {
          await tx.business.updateMany({ where: { subcategoryId: s.id }, data: { subcategoryId: twin.id } });
          await tx.subcategory.delete({ where: { id: s.id } });
        } else {
          await tx.subcategory.update({ where: { id: s.id }, data: { categoryId: target.id, sortOrder: nextSort++ } });
        }
      }
      // Listings with no subcategory optionally land in a chosen or new subcategory of the target.
      let subId = body.data.subcategoryId;
      if (body.data.newSubcategoryName) {
        const subName = sanitizeText(body.data.newSubcategoryName);
        const existing = target.subcategories.find((t) => lower(t.name) === lower(subName));
        if (existing) subId = existing.id;
        else {
          let slugValue = slugify(`${target.name}-${subName}`);
          if (await tx.subcategory.findUnique({ where: { slug: slugValue } })) slugValue = `${slugValue}-${Date.now().toString(36)}`;
          subId = (await tx.subcategory.create({ data: { name: subName, slug: slugValue, categoryId: target.id, sortOrder: nextSort++ } })).id;
        }
      }
      if (subId) await tx.business.updateMany({ where: { categoryId: source.id, subcategoryId: null }, data: { subcategoryId: subId } });
      const moved = await tx.business.updateMany({ where: { categoryId: source.id }, data: { categoryId: target.id } });
      await tx.category.delete({ where: { id: source.id } });
      await audit(tx, req.admin!.id, "MERGE_CATEGORY", "Category", target.id, {
        from: source.name,
        into: target.name,
        listings: moved.count,
        ...(body.data.newSubcategoryName ? { newSubcategory: body.data.newSubcategoryName } : {}),
      });
      return moved.count;
    });
    return { ok: true, movedListings: result };
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
    const lastSub = await app.prisma.subcategory.aggregate({ where: { categoryId: c.id }, _max: { sortOrder: true } });
    const sub = await app.prisma.$transaction(async (tx) => {
      const created = await tx.subcategory.create({ data: { name: clean, slug: s, categoryId: c.id, sortOrder: (lastSub._max.sortOrder ?? -1) + 1 } });
      await audit(tx, req.admin!.id, "CREATE_SUBCATEGORY", "Category", c.id, { subcategory: clean });
      return created;
    });
    return reply.code(201).send({ subcategory: sub });
  });

  // The order of the subcategories within one category, as shown on the site and in the submission form.
  app.post("/categories/:id/subcategories/reorder", admins, async (req, reply) => {
    const p = idParams.safeParse(req.params);
    if (!p.success) return reply.code(404).send({ error: "Not found" });
    const body = reorder.safeParse(req.body);
    if (!body.success) return invalid(reply, body.error);
    const subs = await app.prisma.subcategory.findMany({ where: { categoryId: p.data.id }, select: { id: true } });
    if (!subs.length) return reply.code(404).send({ error: "Not found" });
    const ids = new Set(subs.map((s) => s.id));
    if (body.data.ids.length !== ids.size || new Set(body.data.ids).size !== ids.size || body.data.ids.some((id) => !ids.has(id))) {
      return reply.code(400).send({ error: "Send every subcategory of this category exactly once." });
    }
    await app.prisma.$transaction([
      ...body.data.ids.map((id, index) => app.prisma.subcategory.update({ where: { id }, data: { sortOrder: index } })),
      audit(app.prisma, req.admin!.id, "REORDER_SUBCATEGORIES", "Category", p.data.id, { order: body.data.ids }),
    ]);
    return { ok: true };
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
