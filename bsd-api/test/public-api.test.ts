import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { startTestDb, type TestDb } from "./helpers/testdb.js";

// The invariant this file exists to protect: the public API never returns a listing that is not APPROVED, and
// never returns a private field. It runs the real seed, the real Prisma engine and the real migrations against an
// in-process PostgreSQL, so a regression in any public route fails here.

vi.setConfig({ testTimeout: 60_000, hookTimeout: 240_000 });

const STATUSES = ["PENDING", "APPROVED", "REJECTED", "REMOVED"] as const;
const VERIFICATIONS = ["NEWLY_LISTED", "PENDING_VERIFICATION", "COMMUNITY_VERIFIED"] as const;

const SECRETS = ["SECRET-REJECTION-REASON", "Private Owner Name"];
const FORBIDDEN_KEYS = [
  "id",
  "ownerName",
  "rejectionReason",
  "reviewedById",
  "reviewedAt",
  "verifiedById",
  "submittedAt",
  "status",
  "passwordHash",
  "consentAccurateInfo",
  "consentPublishPermission",
  "consentNoLiability",
  "consentDataStorage",
  "gdprConsentStorage",
  "gdprConsentRights",
];

const matrixName = (s: string, v: string) => `Matrix ${s} ${v}`;
const matrixSlug = (s: string, v: string) => `matrix-${s}-${v}`.toLowerCase().replace(/_/g, "-");
const APPROVED_MATRIX = VERIFICATIONS.map((v) => matrixName("APPROVED", v));

let t: TestDb;
let prisma: PrismaClient;
let app: FastifyInstance;

const get = async (url: string) => {
  const res = await app.inject({ method: "GET", url });
  return { status: res.statusCode, body: res.body, json: () => JSON.parse(res.body) };
};

/** Every key name that appears anywhere in a JSON value. */
function allKeys(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => allKeys(v, out));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      out.add(k);
      allKeys(v, out);
    }
  }
  return out;
}

beforeAll(async () => {
  t = await startTestDb();
  process.env.DATABASE_URL = t.url;
  const { PrismaClient: Client } = await import("@prisma/client");
  prisma = new Client({ datasources: { db: { url: t.url } } });

  // Real taxonomy, zones and localities from the real seed (no admin: the env vars are unset).
  delete process.env.SEED_ADMIN_EMAIL;
  delete process.env.SEED_ADMIN_PASSWORD;
  const { runSeed } = await import("../prisma/seed.js");
  await runSeed(prisma);

  const [category, otherCategory] = await Promise.all([
    prisma.category.findUniqueOrThrow({ where: { slug: "groceries-and-halal" } }),
    prisma.category.findUniqueOrThrow({ where: { slug: "restaurants-and-takeaways" } }),
  ]);
  const sub = await prisma.subcategory.findFirstOrThrow({ where: { categoryId: category.id, name: "Asian Grocery" } });
  const zone1 = await prisma.coverageZone.findUniqueOrThrow({ where: { slug: "zone-1" } });
  const zone2 = await prisma.coverageZone.findUniqueOrThrow({ where: { slug: "zone-2" } });
  const zone3 = await prisma.coverageZone.findUniqueOrThrow({ where: { slug: "zone-3" } });
  const mumbles = await prisma.locality.findFirstOrThrow({ where: { slug: "mumbles" } });
  const neath = await prisma.locality.findFirstOrThrow({ where: { slug: "neath-town-centre" } });

  const base = {
    description: "A friendly local shop with a wide range of products and helpful staff for the whole community.",
    servicesOffered: ["Groceries", "Halal meat"],
    ownerName: "Private Owner Name",
    email: "shop@example.com", // public by design: the submission form says the email will be publicly displayed
    consentAccurateInfo: true,
    consentPublishPermission: true,
    consentNoLiability: true,
    consentDataStorage: true,
    gdprConsentStorage: true,
    gdprConsentRights: true,
  };

  // The 12-way matrix: every ListingStatus x VerificationStatus.
  for (const s of STATUSES) {
    for (const v of VERIFICATIONS) {
      await prisma.business.create({
        data: {
          ...base,
          slug: matrixSlug(s, v),
          name: matrixName(s, v),
          phone: "01792 000000",
          address: "1 High Street, Swansea",
          postcode: "SA1 4PE",
          postcodeDistrict: "SA1",
          categoryId: category.id,
          subcategoryId: sub.id,
          zoneId: zone1.id,
          status: s,
          verificationStatus: v,
          verifiedAt: v === "COMMUNITY_VERIFIED" ? new Date("2026-09-01T10:00:00Z") : null,
          rejectionReason: s === "REJECTED" ? "SECRET-REJECTION-REASON" : null,
          localities: { create: [{ localityId: mumbles.id }] },
        },
      });
    }
  }

  // Extra approved listings for the home-based, served-zone and search cases.
  await prisma.business.create({
    data: {
      ...base,
      slug: "home-chef-kitchen",
      name: "Home Chef Kitchen",
      description: "Freshly cooked Bengali meals prepared at home for families, parties and events across the valley.",
      servicesOffered: ["Catering", "Tiffin"],
      phone: "01639 111111",
      address: "HomeBased",
      postcode: "SA10 9AA",
      postcodeDistrict: "SA10",
      categoryId: otherCategory.id,
      zoneId: zone2.id,
      status: "APPROVED",
      verificationStatus: "COMMUNITY_VERIFIED",
      verifiedAt: new Date("2026-09-10T10:00:00Z"),
      localities: { create: [{ localityId: neath.id }] },
    },
  });
  await prisma.business.create({
    data: {
      ...base,
      slug: "cross-zone-caterers",
      name: "Cross Zone Caterers",
      description: "Event catering based in Swansea and travelling across South West Wales for weddings and celebrations.",
      servicesOffered: ["Wedding catering"],
      phone: "01792 222222",
      address: "5 Mumbles Road, Swansea",
      postcode: "SA3 4AA",
      postcodeDistrict: "SA3",
      categoryId: otherCategory.id,
      zoneId: zone1.id,
      status: "APPROVED",
      verificationStatus: "NEWLY_LISTED",
      servedZones: { create: [{ zoneId: zone3.id }] },
    },
  });

  const { buildApp } = await import("../src/server.js");
  app = buildApp();
  await app.ready();
});

afterAll(async () => {
  await app?.close();
  await prisma?.$disconnect();
  await t?.stop();
});

describe("publicWhere", () => {
  it("cannot be widened by a caller that asks for another status", async () => {
    const { publicWhere } = await import("../src/common/public.js");
    const rows = await prisma.business.findMany({ where: publicWhere({ status: "REJECTED" }) });
    expect(rows).toEqual([]);
    const all = await prisma.business.findMany({ where: publicWhere() });
    expect(all.every((b) => b.status === "APPROVED")).toBe(true);
    expect(all.length).toBe(5); // 3 approved matrix rows + 2 extras
  });
});

describe("only APPROVED listings are public (12 status x verification combinations)", () => {
  it("search returns exactly the approved matrix rows", async () => {
    const r = await get("/businesses/search?q=matrix&pageSize=50");
    expect(r.status).toBe(200);
    const names = r.json().items.map((i: { name: string }) => i.name).sort();
    expect(names).toEqual([...APPROVED_MATRIX].sort());
    expect(r.json().total).toBe(3);
  });

  it("search with no filter returns only approved listings (5)", async () => {
    const r = await get("/businesses/search?pageSize=50");
    expect(r.json().total).toBe(5);
    expect(r.body).not.toMatch(/Matrix (PENDING|REJECTED|REMOVED)/);
  });

  it("the detail route returns the 3 approved listings and 404s the other 9", async () => {
    for (const s of STATUSES) {
      for (const v of VERIFICATIONS) {
        const r = await get(`/businesses/${matrixSlug(s, v)}`);
        expect(r.status, `${s} ${v}`).toBe(s === "APPROVED" ? 200 : 404);
        if (s === "APPROVED") expect(r.json().verificationStatus).toBe(v);
      }
    }
    // a listing that does not exist looks identical to one that is hidden
    const hidden = await get(`/businesses/${matrixSlug("REJECTED", "COMMUNITY_VERIFIED")}`);
    const missing = await get("/businesses/no-such-listing");
    expect(hidden.body).toBe(missing.body);
  });

  it("featured returns only APPROVED and COMMUNITY_VERIFIED", async () => {
    const r = await get("/businesses/featured?limit=24");
    expect(r.status).toBe(200);
    const items = r.json().items as { name: string; verificationStatus: string }[];
    expect(items.every((i) => i.verificationStatus === "COMMUNITY_VERIFIED")).toBe(true);
    const names = items.map((i) => i.name);
    expect(names).toContain(matrixName("APPROVED", "COMMUNITY_VERIFIED"));
    expect(names).toContain("Home Chef Kitchen");
    for (const s of STATUSES) {
      if (s !== "APPROVED") expect(names).not.toContain(matrixName(s, "COMMUNITY_VERIFIED"));
    }
    expect(names).not.toContain(matrixName("APPROVED", "NEWLY_LISTED"));
    expect(names).not.toContain(matrixName("APPROVED", "PENDING_VERIFICATION"));
    expect(names).toHaveLength(2);
    // most recently verified first
    expect(names[0]).toBe("Home Chef Kitchen");
  });

  it("category pages, zone pages and every count include approved listings only", async () => {
    const cat = (await get("/categories/groceries-and-halal?pageSize=50")).json();
    expect(cat.businesses.items.map((i: { name: string }) => i.name).sort()).toEqual([...APPROVED_MATRIX].sort());
    expect(cat.category.businessCount).toBe(3);
    const sub = cat.category.subcategories.find((s: { slug: string }) => s.slug.endsWith("asian-grocery"));
    expect(sub.businessCount).toBe(3);

    const zone = (await get("/zones/zone-1?pageSize=50")).json();
    const zoneNames = zone.businesses.items.map((i: { name: string }) => i.name);
    expect(zoneNames.filter((n: string) => n.startsWith("Matrix")).sort()).toEqual([...APPROVED_MATRIX].sort());
    expect(zoneNames).toContain("Cross Zone Caterers");
    expect(zone.zone.businessCount).toBe(4);
    const mumbles = zone.zone.localities.find((l: { slug: string }) => l.slug === "mumbles");
    expect(mumbles.businessCount).toBe(3);

    const zones = (await get("/zones")).json().zones as { slug: string; businessCount: number }[];
    expect(Object.fromEntries(zones.map((z) => [z.slug, z.businessCount]))).toEqual({ "zone-1": 4, "zone-2": 1, "zone-3": 1 });

    const cats = (await get("/categories")).json().categories as { slug: string; businessCount: number }[];
    expect(cats.find((c) => c.slug === "groceries-and-halal")?.businessCount).toBe(3);
    expect(cats.reduce((n, c) => n + c.businessCount, 0)).toBe(5);
  });

  it("filter parameters cannot be used to reach hidden listings", async () => {
    const names = (r: { json: () => { items: { name: string }[] } }) => r.json().items.map((i) => i.name);
    const plain = await get("/businesses/search?pageSize=50");
    expect(plain.json().total).toBe(5);
    // unknown parameters are ignored, so the result is exactly the same as a plain request
    for (const extra of ["status=REJECTED", "status=PENDING", "where[status]=REMOVED", "verificationStatus=NEWLY_LISTED&status=REMOVED"]) {
      const r = await get(`/businesses/search?pageSize=50&${extra}`);
      expect(r.status).toBe(200);
      expect(names(r)).toEqual(names(plain));
    }
  });
});

describe("private data never appears in a public response", () => {
  it("has no private key names and none of the private values, on any public route", async () => {
    const urls = [
      "/businesses/search?pageSize=50",
      "/businesses/search?q=matrix&pageSize=50",
      "/businesses/featured?limit=24",
      "/categories",
      "/categories/groceries-and-halal?pageSize=50",
      "/categories/restaurants-and-takeaways?pageSize=50",
      "/zones",
      "/zones/zone-1?pageSize=50",
      "/zones/zone-2?pageSize=50",
      ...APPROVED_MATRIX.map((n) => `/businesses/${n.toLowerCase().replace(/ /g, "-").replace(/_/g, "-")}`),
      "/businesses/home-chef-kitchen",
      "/businesses/cross-zone-caterers",
    ];
    for (const url of urls) {
      const r = await get(url);
      expect(r.status, url).toBe(200);
      const keys = allKeys(r.json());
      for (const k of FORBIDDEN_KEYS) {
        // "status" is a legitimate key only inside error bodies, and public bodies must not carry it at all
        expect(keys.has(k), `${url} exposes key "${k}"`).toBe(false);
      }
      for (const secret of SECRETS) expect(r.body, `${url} leaks "${secret}"`).not.toContain(secret);
      // not one hidden listing's name anywhere in the body
      for (const s of STATUSES) {
        if (s === "APPROVED") continue;
        for (const v of VERIFICATIONS) expect(r.body, `${url} leaks ${s} ${v}`).not.toContain(matrixName(s, v));
      }
    }
  });
});

describe("what a detail page does show", () => {
  it("includes the public contact details, and the list view stays lighter", async () => {
    const detail = (await get("/businesses/cross-zone-caterers")).json();
    expect(detail.email).toBe("shop@example.com");
    expect(detail.phone).toBe("01792 222222");
    expect(detail.servicesOffered).toEqual(["Wedding catering"]);
    expect(detail.servedZones).toEqual([{ name: "Carmarthenshire & West Wales", slug: "zone-3" }]);
    const listed = (await get("/businesses/search?q=caterers")).json().items[0];
    expect(listed).not.toHaveProperty("email");
    expect(listed).not.toHaveProperty("servicesOffered");
  });
});

describe("home-based listings", () => {
  it("hide the full postcode but keep the district and locality", async () => {
    const home = (await get("/businesses/home-chef-kitchen")).json();
    expect(home.postcode).toBeNull();
    expect(home.postcodeDistrict).toBe("SA10");
    expect(home.address).toBe("HomeBased");
    expect(home.localities).toEqual([{ name: "Neath Town Centre", slug: "neath-town-centre" }]);
    const shop = (await get("/businesses/cross-zone-caterers")).json();
    expect(shop.postcode).toBe("SA3 4AA");
    const listed = (await get("/businesses/search?q=chef")).json().items[0];
    expect(listed.postcode).toBeNull();
  });
});

describe("zones and served zones", () => {
  it("a listing shows in a zone it serves as well as the zone it is in", async () => {
    const z3 = (await get("/zones/zone-3")).json();
    expect(z3.businesses.items.map((i: { name: string }) => i.name)).toEqual(["Cross Zone Caterers"]);
    const search = (await get("/businesses/search?zone=zone-3")).json();
    expect(search.items.map((i: { name: string }) => i.name)).toEqual(["Cross Zone Caterers"]);
    const z2 = (await get("/businesses/search?zone=zone-2")).json();
    expect(z2.items.map((i: { name: string }) => i.name)).toEqual(["Home Chef Kitchen"]);
  });

  it("filters by locality", async () => {
    const r = (await get("/businesses/search?locality=neath-town-centre")).json();
    expect(r.items.map((i: { name: string }) => i.name)).toEqual(["Home Chef Kitchen"]);
  });

  it("lists the 3 zones with their postcode districts and localities", async () => {
    const zones = (await get("/zones")).json().zones as { slug: string; postcodeDistricts: string[]; localities: unknown[] }[];
    expect(zones.map((z) => z.slug)).toEqual(["zone-1", "zone-2", "zone-3"]);
    expect(zones.map((z) => z.localities.length)).toEqual([19, 14, 14]);
    expect(zones[2].postcodeDistricts).toHaveLength(11);
  });
});

describe("search", () => {
  it("matches name, category and services, ignoring case, with every word required", async () => {
    const names = async (q: string) => (await get(`/businesses/search?q=${encodeURIComponent(q)}&pageSize=50`)).json().items.map((i: { name: string }) => i.name);
    expect(await names("CHEF")).toEqual(["Home Chef Kitchen"]);
    expect(await names("home kitchen")).toEqual(["Home Chef Kitchen"]);
    expect(await names("home matrix")).toEqual([]); // both words must match
    expect(await names("tiffin")).toEqual(["Home Chef Kitchen"]); // a service
    expect(await names("groceries halal")).toHaveLength(3); // category name words
    expect(await names("zzz-no-such-thing")).toEqual([]);
  });

  it("treats wildcard characters literally, so they do not match everything", async () => {
    for (const q of ["%", "_", "%%", "\\"]) {
      const r = (await get(`/businesses/search?q=${encodeURIComponent(q)}`)).json();
      expect(r.total, `q=${q}`).toBe(0);
    }
  });

  it("is safe against SQL-looking input", async () => {
    const r = await get(`/businesses/search?q=${encodeURIComponent("'; DROP TABLE \"Business\";--")}`);
    expect(r.status).toBe(200);
    expect((await get("/businesses/search?pageSize=50")).json().total).toBe(5);
  });

  it("lists verified listings first, then alphabetically", async () => {
    const items = (await get("/businesses/search?pageSize=50")).json().items as { name: string; verificationStatus: string }[];
    const rank = { COMMUNITY_VERIFIED: 2, PENDING_VERIFICATION: 1, NEWLY_LISTED: 0 } as const;
    const ranks = items.map((i) => rank[i.verificationStatus as keyof typeof rank]);
    expect(ranks).toEqual([...ranks].sort((a, b) => b - a));
  });

  it("paginates", async () => {
    const p1 = (await get("/businesses/search?pageSize=2&page=1")).json();
    const p2 = (await get("/businesses/search?pageSize=2&page=2")).json();
    const p3 = (await get("/businesses/search?pageSize=2&page=3")).json();
    expect([p1.items.length, p2.items.length, p3.items.length]).toEqual([2, 2, 1]);
    expect(p1.total).toBe(5);
    expect(p1.totalPages).toBe(3);
    const all = [...p1.items, ...p2.items, ...p3.items].map((i: { slug: string }) => i.slug);
    expect(new Set(all).size).toBe(5); // no listing repeats or goes missing across pages
  });
});

describe("input handling", () => {
  it("rejects bad paging and filters with a 400", async () => {
    for (const q of ["page=0", "page=-1", "page=abc", "pageSize=0", "pageSize=1000", "category=BAD_SLUG", "zone=../etc"]) {
      const r = await get(`/businesses/search?${q}`);
      expect(r.status, q).toBe(400);
      expect(r.json().error).toBe("Invalid query");
    }
    expect((await get("/businesses/featured?limit=999")).status).toBe(400);
  });

  it("returns 404 for unknown categories, zones and listings", async () => {
    expect((await get("/categories/nope")).status).toBe(404);
    expect((await get("/zones/nope")).status).toBe(404);
    expect((await get("/businesses/nope")).status).toBe(404);
    expect((await get("/businesses/..%2F..%2Fetc")).status).toBe(404);
  });

  it("serves the fixed paths, not the slug route, for search and featured", async () => {
    expect((await get("/businesses/search")).json()).toHaveProperty("items");
    expect((await get("/businesses/featured")).json()).toHaveProperty("items");
  });
});
