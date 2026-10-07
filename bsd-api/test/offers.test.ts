import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { boot, type Ctx } from "./helpers/pass.js";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 240_000 });

let c: Ctx;
beforeAll(async () => {
  c = await boot();
});
afterAll(async () => {
  await c?.close();
});

const put = (cookie: string, id: string, body: object) => c.call("PUT", `/auth/listings/${id}/offer`, { cookie, body });

describe("merchant offer", () => {
  it("owner of an approved listing creates an offer that starts PENDING, others get 404", async () => {
    const s = await c.shop(null);
    const res = await put(s.owner.cookie, s.biz.id, { title: "10% off all coffee", percent: 10, terms: "Show your pass at the till." });
    expect(res.status).toBe(200);
    expect(res.body.offer).toMatchObject({ status: "PENDING", percent: 10, title: "10% off all coffee" });
    expect((await c.call("GET", `/auth/listings/${s.biz.id}/offer`, { cookie: s.owner.cookie })).body.offer.title).toBe("10% off all coffee");
    const other = await c.user();
    expect((await put(other.cookie, s.biz.id, { title: "Mine now", terms: "Whatever terms" })).status).toBe(404);
    expect((await c.call("GET", `/auth/listings/${s.biz.id}/offer`, { cookie: other.cookie })).status).toBe(404);
    expect((await c.call("POST", `/auth/listings/${s.biz.id}/offer/pause`, { cookie: other.cookie })).status).toBe(404);
    expect((await c.call("GET", `/auth/listings/${s.biz.id}/offer`)).status).toBe(401);
  });

  it("a pending or removed listing cannot have an offer (404)", async () => {
    const pending = await c.shop(null, { status: "PENDING" });
    expect((await put(pending.owner.cookie, pending.biz.id, { title: "Early", terms: "Not yet allowed" })).status).toBe(404);
  });

  it("validates title, terms, percent and unknown fields", async () => {
    const s = await c.shop(null);
    for (const bad of [{ title: "x", terms: "Valid terms" }, { title: "Fine title", terms: "abc" }, { title: "Fine title", terms: "Valid terms", percent: 0 }, { title: "Fine title", terms: "Valid terms", percent: 101 }, { title: "Fine title", terms: "Valid terms", status: "ACTIVE" }]) {
      expect((await put(s.owner.cookie, s.biz.id, bad)).status).toBe(400);
    }
    const ok = await put(s.owner.cookie, s.biz.id, { title: "Free <b>cake</b>", terms: "One per customer.", percent: null });
    expect(ok.status).toBe(200);
    expect(ok.body.offer.title).toBe("Free cake");
    expect(ok.body.offer.percent).toBeNull();
  });

  it("editing a live offer sends it back to PENDING and off the public list", async () => {
    const s = await c.shop("ACTIVE");
    expect((await c.call("GET", "/pass/partners")).raw).toContain(s.biz.slug);
    const res = await put(s.owner.cookie, s.biz.id, { title: "Better deal", percent: 15, terms: "Show your pass." });
    expect(res.body.offer.status).toBe("PENDING");
    expect((await c.call("GET", "/pass/partners")).raw).not.toContain(s.biz.slug);
  });

  it("pause and resume only move between ACTIVE and PAUSED", async () => {
    const s = await c.shop("ACTIVE");
    expect((await c.call("POST", `/auth/listings/${s.biz.id}/offer/resume`, { cookie: s.owner.cookie })).body.offer.status).toBe("ACTIVE"); // nothing to resume, no change
    expect((await c.call("POST", `/auth/listings/${s.biz.id}/offer/pause`, { cookie: s.owner.cookie })).body.offer.status).toBe("PAUSED");
    expect((await c.call("POST", `/auth/listings/${s.biz.id}/offer/pause`, { cookie: s.owner.cookie })).body.offer.status).toBe("PAUSED"); // double tap
    expect((await c.call("POST", `/auth/listings/${s.biz.id}/offer/resume`, { cookie: s.owner.cookie })).body.offer.status).toBe("ACTIVE");
    const pending = await c.shop("PENDING");
    expect((await c.call("POST", `/auth/listings/${pending.biz.id}/offer/resume`, { cookie: pending.owner.cookie })).status).toBe(409); // an owner cannot approve by resuming
  });
});

describe("admin approval", () => {
  it("moderator approves, rejects with a reason, and both are audited; volunteer is refused", async () => {
    const a = await c.shop("PENDING");
    const b = await c.shop("PENDING");
    expect((await c.call("POST", `/admin/offers/${a.offer!.id}/approve`, { admin: "VOLUNTEER" })).status).toBe(403);
    expect((await c.call("POST", `/admin/offers/${a.offer!.id}/approve`)).status).toBe(401);
    expect((await c.call("POST", `/admin/offers/${a.offer!.id}/approve`, { admin: "MODERATOR" })).status).toBe(200);
    expect((await c.call("POST", `/admin/offers/${a.offer!.id}/approve`, { admin: "MODERATOR" })).status).toBe(409);
    expect((await c.call("POST", `/admin/offers/${b.offer!.id}/reject`, { admin: "MODERATOR", body: { reason: "no" } })).status).toBe(400);
    expect((await c.call("POST", `/admin/offers/${b.offer!.id}/reject`, { admin: "MODERATOR", body: { reason: "Terms are unclear." } })).status).toBe(200);
    expect((await c.call("POST", `/admin/offers/${b.offer!.id}/approve`, { admin: "MODERATOR" })).status).toBe(409);
    expect((await c.call("POST", "/admin/offers/nope/approve", { admin: "MODERATOR" })).status).toBe(404);
    const logs = await c.prisma.auditLog.findMany({ where: { entityType: "PrivilegeOffer", entityId: { in: [a.offer!.id, b.offer!.id] } } });
    expect(logs.map((l) => l.action).sort()).toEqual(["OFFER_APPROVE", "OFFER_REJECT"]);
    expect((await c.call("GET", `/auth/listings/${b.biz.id}/offer`, { cookie: b.owner.cookie })).body.offer).toMatchObject({ status: "REJECTED", rejectionReason: "Terms are unclear." });
  });

  it("two moderators racing to approve: one wins, the other gets 409", async () => {
    const a = await c.shop("PENDING");
    const res = await Promise.all([c.call("POST", `/admin/offers/${a.offer!.id}/approve`, { admin: "MODERATOR" }), c.call("POST", `/admin/offers/${a.offer!.id}/reject`, { admin: "ADMIN", body: { reason: "Changed my mind." } })]);
    expect(res.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await c.prisma.auditLog.count({ where: { entityId: a.offer!.id } })).toBe(1);
  });

  it("lists by status", async () => {
    await c.shop("PENDING");
    const res = await c.call("GET", "/admin/offers?status=PENDING", { admin: "MODERATOR" });
    expect(res.status).toBe(200);
    expect(res.body.items.every((o: { status: string }) => o.status === "PENDING")).toBe(true);
    expect((await c.call("GET", "/admin/offers?status=BOGUS", { admin: "MODERATOR" })).status).toBe(400);
    expect((await c.call("GET", "/admin/offers", { admin: "VOLUNTEER" })).status).toBe(403);
  });
});

describe("public badge and partners", () => {
  it("only an ACTIVE offer shows, on the detail, the list and the partners grid", async () => {
    const live = await c.shop("ACTIVE");
    const paused = await c.shop("PAUSED");
    const pending = await c.shop("PENDING");
    const detail = await c.call("GET", `/businesses/${live.biz.slug}`);
    expect(detail.body.offer).toEqual({ id: expect.any(String), title: "10% off", percent: 10, terms: "Show your pass." });
    for (const s of [paused, pending]) expect((await c.call("GET", `/businesses/${s.biz.slug}`)).body.offer).toBeNull();
    const partners = await c.call("GET", "/pass/partners?pageSize=50");
    expect(partners.raw).toContain(live.biz.slug);
    expect(partners.raw).not.toContain(paused.biz.slug);
    expect(partners.raw).not.toContain(pending.biz.slug);
    expect(partners.body.items.every((i: { offer: object | null }) => i.offer)).toBe(true);
    // The member app needs the offer id to ask for a code.
    const mine = partners.body.items.find((i: { slug: string }) => i.slug === live.biz.slug);
    expect(mine.offer.id).toBe(detail.body.offer.id);
    const list = await c.call("GET", `/businesses/search?q=${encodeURIComponent(live.biz.name)}&pageSize=50`);
    expect(list.body.items.find((i: { slug: string }) => i.slug === live.biz.slug)?.offer.id).toBe(detail.body.offer.id);
  });

  it("partners hides the street of a hidden address listing and needs no sign in", async () => {
    const s = await c.shop("ACTIVE", { hideFullAddress: true, address: "7 Secret Lane" });
    const res = await c.call("GET", "/pass/partners?pageSize=50");
    expect(res.status).toBe(200);
    expect(res.raw).toContain(s.biz.slug);
    expect(res.raw).not.toContain("Secret Lane");
  });

  it("an unapproved listing with an ACTIVE offer is not a partner", async () => {
    const s = await c.shop("ACTIVE", { status: "REMOVED" });
    expect((await c.call("GET", "/pass/partners?pageSize=50")).raw).not.toContain(s.biz.slug);
  });

  it("no email is sent anywhere in this package", async () => {
    const src = (await import("node:fs")).readdirSync(new URL("../src/modules/members/", import.meta.url)).filter((f) => f.startsWith("pass."));
    for (const f of src) expect((await import("node:fs")).readFileSync(new URL(`../src/modules/members/${f}`, import.meta.url), "utf8")).not.toMatch(/sendMail|nodemailer|smtp/i);
  });
});
