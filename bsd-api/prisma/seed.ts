import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcrypt";
import {
  CATEGORIES,
  CATEGORY_RENAMES,
  ZONES,
  categorySlug,
  localitySlug,
  subcategorySlug,
} from "./seed-data.js";

// Idempotent v2 seed: categories and subcategories, the 3 coverage zones with their postcode districts,
// all localities, and the initial super admin. It reconciles as well as upserting, so rows left over from
// the v1 taxonomy are removed. It refuses (and rolls everything back) if a retired row still has listings
// attached, because that needs a human decision, not a guess.

type Tx = Prisma.TransactionClient;

// Categories are managed in the admin panel once the site is set up. The approved list is written only into an empty
// database, or when SEED_TAXONOMY=reset is set on purpose. Otherwise the seed only fills in missing icons, so running it
// again can never undo an admin's changes.
async function seedCategories(tx: Tx) {
  const existing = await tx.category.count();
  if (existing > 0 && process.env.SEED_TAXONOMY !== "reset") {
    for (const cat of CATEGORIES) {
      if (cat.icon) await tx.category.updateMany({ where: { name: cat.name, icon: null }, data: { icon: cat.icon } });
    }
    console.log("categories already set up: kept as they are (missing icons filled in)");
    return;
  }
  await resetCategories(tx);
}

async function resetCategories(tx: Tx) {
  // 1. Straight renames keep the same row, so attached listings keep their link.
  for (const [from, to] of Object.entries(CATEGORY_RENAMES)) {
    const old = await tx.category.findUnique({ where: { name: from } });
    const target = await tx.category.findUnique({ where: { name: to } });
    if (old && !target) {
      await tx.category.update({ where: { id: old.id }, data: { name: to, slug: categorySlug(to) } });
      console.log(`renamed category "${from}" to "${to}"`);
    }
  }

  // 2. Upsert the approved categories and subcategories.
  for (const [index, cat] of CATEGORIES.entries()) {
    const category = await tx.category.upsert({
      where: { name: cat.name },
      update: { slug: categorySlug(cat.name), sortOrder: index, requiresOwnerName: cat.requiresOwnerName ?? false, icon: cat.icon ?? null },
      create: {
        icon: cat.icon ?? null,
        name: cat.name,
        slug: categorySlug(cat.name),
        sortOrder: index,
        requiresOwnerName: cat.requiresOwnerName ?? false,
      },
    });
    for (const sub of cat.subcategories) {
      await tx.subcategory.upsert({
        where: { categoryId_name: { categoryId: category.id, name: sub } },
        update: { slug: subcategorySlug(cat.name, sub) },
        create: { name: sub, slug: subcategorySlug(cat.name, sub), categoryId: category.id },
      });
    }
  }

  // 3. Remove anything that is no longer in the approved set, but only if nothing points at it.
  const approved = new Map(CATEGORIES.map((c) => [c.name, new Set(c.subcategories)]));
  const categories = await tx.category.findMany({
    include: { subcategories: { include: { _count: { select: { businesses: true } } } }, _count: { select: { businesses: true } } },
  });
  for (const category of categories) {
    const keep = approved.get(category.name);
    if (!keep) {
      if (category._count.businesses > 0) {
        throw new Error(
          `Retired category "${category.name}" still has ${category._count.businesses} listing(s). Move them to an approved category first.`
        );
      }
      for (const sub of category.subcategories) {
        if (sub._count.businesses > 0) {
          throw new Error(`Subcategory "${sub.name}" of retired category "${category.name}" still has listings.`);
        }
      }
      await tx.subcategory.deleteMany({ where: { categoryId: category.id } });
      await tx.category.delete({ where: { id: category.id } });
      console.log(`removed retired category "${category.name}"`);
      continue;
    }
    for (const sub of category.subcategories) {
      if (keep.has(sub.name)) continue;
      if (sub._count.businesses > 0) {
        throw new Error(
          `Retired subcategory "${sub.name}" of "${category.name}" still has ${sub._count.businesses} listing(s). Re-file them first.`
        );
      }
      await tx.subcategory.delete({ where: { id: sub.id } });
      console.log(`removed retired subcategory "${sub.name}" of "${category.name}"`);
    }
  }
}

async function seedZones(tx: Tx) {
  for (const [index, zone] of ZONES.entries()) {
    const row = await tx.coverageZone.upsert({
      where: { slug: zone.slug },
      update: { name: zone.name, postcodeDistricts: zone.postcodeDistricts, sortOrder: index },
      create: { slug: zone.slug, name: zone.name, postcodeDistricts: zone.postcodeDistricts, sortOrder: index },
    });
    for (const name of zone.localities) {
      await tx.locality.upsert({
        where: { zoneId_name: { zoneId: row.id, name } },
        update: { slug: localitySlug(name) },
        create: { name, slug: localitySlug(name), zoneId: row.id },
      });
    }
  }

  // Remove localities and zones that are no longer approved, only if nothing points at them.
  const approvedLocalities = new Map(ZONES.map((z) => [z.slug, new Set(z.localities)]));
  const zones = await tx.coverageZone.findMany({
    include: { localities: { include: { _count: { select: { businesses: true } } } }, _count: { select: { businesses: true, servedBy: true } } },
  });
  for (const zone of zones) {
    const keep = approvedLocalities.get(zone.slug);
    if (!keep) {
      if (zone._count.businesses > 0 || zone._count.servedBy > 0) {
        throw new Error(`Retired zone "${zone.name}" is still used by listings.`);
      }
      await tx.locality.deleteMany({ where: { zoneId: zone.id } });
      await tx.coverageZone.delete({ where: { id: zone.id } });
      continue;
    }
    for (const loc of zone.localities) {
      if (keep.has(loc.name)) continue;
      if (loc._count.businesses > 0) throw new Error(`Retired locality "${loc.name}" is still used by listings.`);
      await tx.locality.delete({ where: { id: loc.id } });
      console.log(`removed retired locality "${loc.name}"`);
    }
  }
}

async function seedAdmin(tx: Tx) {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    console.warn("SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set, skipping initial admin user creation.");
    return;
  }
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await tx.adminUser.upsert({
    where: { email: adminEmail },
    update: {},
    create: { name: "BSD Super Admin", email: adminEmail, passwordHash, role: "SUPER_ADMIN" },
  });
}

export async function runSeed(prisma: PrismaClient) {
  // One transaction, so a failed reconcile leaves the database exactly as it was.
  await prisma.$transaction(
    async (tx) => {
      await seedCategories(tx);
      await seedZones(tx);
      await seedAdmin(tx);
    },
    { timeout: 120_000, maxWait: 30_000 }
  );
  console.log("Seed complete.");
}

// Run directly (tsx prisma/seed.ts or `prisma db seed`), but stay importable for tests.
const invokedDirectly = process.argv[1] && /seed\.(ts|js)$/.test(process.argv[1]);
if (invokedDirectly) {
  const prisma = new PrismaClient();
  runSeed(prisma)
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
