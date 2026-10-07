import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { boot, DEV, type Ctx } from "./helpers/pass.js";
import { makePassToken, qrSeconds } from "../src/common/pass-token.js";
import { savingFor } from "../src/modules/members/pass.verify.js";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 240_000 });

let c: Ctx;
beforeAll(async () => {
  c = await boot();
});
afterAll(async () => {
  await c?.close();
});

type Shop = Awaited<ReturnType<Ctx["shop"]>>;
type Holder = Awaited<ReturnType<Ctx["holder"]>>;
const scanQr = (s: Shop, token: string, businessId = s.biz.id, xff?: string) => c.call("POST", "/pass/verify", { cookie: s.owner.cookie, xff, body: { businessId, type: "qr", token } });
const scanCode = (s: Shop, code: string) => c.call("POST", "/pass/verify", { cookie: s.owner.cookie, body: { businessId: s.biz.id, type: "code", code } });
const getCode = (h: Holder, s: Shop, xff?: string) => c.call("POST", "/pass/code", { cookie: h.cookie, device: DEV, xff, body: { offerId: s.offer!.id } });
const confirm = (cookie: string, id: string, body: object = {}) => c.call("POST", `/pass/redemptions/${id}/confirm`, { cookie, body });

describe("QR verify", () => {
  it("valid scan returns exactly name, member id and district, and creates an unconfirmed redemption", async () => {
    const s = await c.shop();
    const h = await c.holder();
    const r = await scanQr(s, h.token);
    expect(r.status).toBe(200);
    expect(r.body.valid).toBe(true);
    expect(Object.keys(r.body.member).sort()).toEqual(["memberId", "name", "postcodeDistrict"]);
    expect(r.body.member).toMatchObject({ name: h.name, postcodeDistrict: "SA1" });
    expect(r.body.member.memberId).toMatch(/^BC-\d{4}-\d{4,6}$/);
    expect(r.body.offer).toEqual({ title: "10% off", percent: 10, terms: "Show your pass." });
    expect(r.body.redemptionId).toBeTruthy();
    // No email, user id, card id or secret anywhere in the answer.
    expect(r.raw).not.toMatch(/@test\.example|secret|deviceHash/i);
    expect(r.raw).not.toContain(h.id);
    const row = await c.prisma.privilegeRedemption.findUniqueOrThrow({ where: { id: r.body.redemptionId } });
    expect(row).toMatchObject({ method: "QR", confirmedAt: null, scannedByUserId: s.owner.id, businessId: s.biz.id });
  });

  it("tampered, garbage, other card and suspended card are valid:false", async () => {
    const s = await c.shop();
    const h = await c.holder();
    const parts = h.token.split(".");
    expect((await scanQr(s, `${parts[0]}.${parts[1]}.AAAAAAAAAAAAAAAAAAAAAA`)).body).toMatchObject({ valid: false, reason: "invalid" });
    expect((await scanQr(s, "garbage")).body.valid).toBe(false);
    const other = await c.holder();
    const swapped = `${parts[0]}.${other.token.split(".").slice(1).join(".")}`;
    expect((await scanQr(s, swapped)).body.valid).toBe(false);
    await c.prisma.privilegeCard.updateMany({ where: { userId: h.id }, data: { status: "SUSPENDED" } });
    expect((await scanQr(s, h.token)).body.valid).toBe(false);
  });

  it("a token from an old slot is expired, a token for a moved device is invalid", async () => {
    const s = await c.shop();
    const h = await c.holder();
    const card = await c.prisma.privilegeCard.findUniqueOrThrow({ where: { userId: h.id } });
    const old = makePassToken(card, Date.now() - 3 * qrSeconds() * 1000)!;
    expect((await scanQr(s, old)).body).toMatchObject({ valid: false, reason: "expired" });
    await c.call("POST", "/pass/move", { cookie: h.cookie, device: "device-bbbbbbbbbbbbbbbb" });
    expect((await scanQr(s, h.token)).body.valid).toBe(false); // the old phone's token stops working
  });

  it("double scan within 10 seconds is the yellow state with no member details, and makes no second row", async () => {
    const s = await c.shop();
    const h = await c.holder();
    expect((await scanQr(s, h.token)).body.valid).toBe(true);
    const again = await scanQr(s, h.token);
    expect(again.body).toMatchObject({ valid: true, duplicate: true });
    expect(again.body.secondsAgo).toBeLessThan(10);
    expect(again.body.member).toBeUndefined();
    expect(again.raw).not.toContain(h.name);
    expect(await c.prisma.privilegeRedemption.count({ where: { businessId: s.biz.id } })).toBe(1);
  });

  it("simultaneous scans of one pass create exactly one redemption", async () => {
    const s = await c.shop();
    const h = await c.holder();
    const res = await Promise.all([scanQr(s, h.token), scanQr(s, h.token), scanQr(s, h.token)]);
    expect(res.filter((r) => r.body.valid && !r.body.duplicate)).toHaveLength(1);
    expect(res.filter((r) => r.body.duplicate)).toHaveLength(2);
    expect(await c.prisma.privilegeRedemption.count({ where: { businessId: s.biz.id } })).toBe(1);
  });

  it("after the 10 second cooldown the same pass can be scanned again", async () => {
    const s = await c.shop();
    const h = await c.holder();
    await scanQr(s, h.token);
    await c.prisma.privilegeRedemption.updateMany({ where: { businessId: s.biz.id }, data: { scannedAt: new Date(Date.now() - 20_000) } });
    const r = await scanQr(s, h.token);
    expect(r.body.duplicate).toBeUndefined();
    expect(r.body.valid).toBe(true);
  });
});

describe("who may scan (404 for everyone else)", () => {
  it("not the owner, not a paused or pending offer, not a removed listing, not signed in or without the module", async () => {
    const s = await c.shop();
    const h = await c.holder();
    const stranger = await c.user("Other Owner");
    const body = { businessId: s.biz.id, type: "qr", token: h.token };
    expect((await c.call("POST", "/pass/verify", { cookie: stranger.cookie, body })).status).toBe(404);
    expect((await c.call("POST", "/pass/verify", { body })).status).toBe(401);
    expect((await c.call("POST", "/pass/verify", { cookie: h.cookie, body })).status).toBe(404); // a member scanning their own pass at someone's shop
    for (const status of ["PAUSED", "PENDING", "REJECTED"] as const) {
      const other = await c.shop(status);
      expect((await scanQr(other, h.token)).status).toBe(404);
    }
    const none = await c.shop(null);
    expect((await scanQr(none, h.token)).status).toBe(404);
    const gone = await c.shop("ACTIVE", { status: "REMOVED" });
    expect((await scanQr(gone, h.token)).status).toBe(404);
    // Wrong business id cannot be used to probe, same 404.
    expect((await scanQr(s, h.token, "nope")).status).toBe(404);
    const nomod = await c.user();
    await c.prisma.userModule.deleteMany({ where: { userId: nomod.id } });
    expect((await c.call("POST", "/pass/verify", { cookie: nomod.cookie, body })).status).toBe(403);
    expect((await c.call("POST", "/pass/verify", { cookie: s.owner.cookie, body: { businessId: s.biz.id, type: "nope" } })).status).toBe(400);
  });
});

describe("one time codes", () => {
  it("member reveals a BC-NNNN-SA1 code, asking again returns the same live code", async () => {
    const s = await c.shop();
    const h = await c.holder();
    const a = await getCode(h, s);
    expect(a.status).toBe(200);
    expect(a.body.code).toMatch(/^BC-\d{4}-SA1$/);
    expect(a.body.expiresInSeconds).toBeGreaterThan(590);
    expect((await getCode(h, s)).body.code).toBe(a.body.code);
    expect(await c.prisma.privilegeCode.count({ where: { cardId: (await c.prisma.privilegeCard.findUniqueOrThrow({ where: { userId: h.id } })).id } })).toBe(1);
  });

  it("guards: device header, other device 409, no card 404, suspended 403, unknown or inactive offer 404, no module 403", async () => {
    const s = await c.shop();
    const h = await c.holder();
    expect((await c.call("POST", "/pass/code", { cookie: h.cookie, body: { offerId: s.offer!.id } })).status).toBe(400);
    expect((await c.call("POST", "/pass/code", { cookie: h.cookie, device: "device-bbbbbbbbbbbbbbbb", body: { offerId: s.offer!.id } })).status).toBe(409);
    expect((await c.call("POST", "/pass/code", { cookie: h.cookie, device: DEV, body: { offerId: "nope" } })).status).toBe(404);
    const paused = await c.shop("PAUSED");
    expect((await getCode(h, paused)).status).toBe(404);
    const fresh = await c.user();
    expect((await getCode(fresh as never, s)).status).toBe(404);
    await c.prisma.userModule.deleteMany({ where: { userId: fresh.id } });
    expect((await getCode(fresh as never, s)).status).toBe(403);
    await c.prisma.privilegeCard.updateMany({ where: { userId: h.id }, data: { status: "SUSPENDED" } });
    expect((await getCode(h, s)).status).toBe(403);
  });

  it("is rate limited to 5 per hour per member", async () => {
    const s = await c.shop();
    const h = await c.holder();
    const codes = [];
    for (let i = 0; i < 6; i++) codes.push((await getCode(h, s, "203.0.113.5")).status);
    expect(codes).toEqual([200, 200, 200, 200, 200, 429]);
  });

  it("a code works once: valid, then replay is the yellow state, then used after the cooldown", async () => {
    const s = await c.shop();
    const h = await c.holder();
    const { code } = (await getCode(h, s)).body;
    const first = await scanCode(s, code.toLowerCase()); // typed in lower case is fine
    expect(first.body.valid).toBe(true);
    expect(first.body.member.name).toBe(h.name);
    expect(await c.prisma.privilegeRedemption.findUniqueOrThrow({ where: { id: first.body.redemptionId } })).toMatchObject({ method: "CODE" });
    expect((await scanCode(s, code)).body).toMatchObject({ valid: true, duplicate: true });
    await c.prisma.privilegeRedemption.updateMany({ where: { businessId: s.biz.id }, data: { scannedAt: new Date(Date.now() - 60_000) } });
    expect((await scanCode(s, code)).body).toMatchObject({ valid: false, reason: "used" });
    expect(await c.prisma.privilegeRedemption.count({ where: { businessId: s.biz.id } })).toBe(1);
    // After use the member can reveal a fresh one.
    expect((await getCode(h, s)).body.code).not.toBe(undefined);
  });

  it("two shops racing on one code: exactly one redemption", async () => {
    const s = await c.shop();
    const h = await c.holder();
    const { code } = (await getCode(h, s)).body;
    const res = await Promise.all([scanCode(s, code), scanCode(s, code)]);
    expect(await c.prisma.privilegeRedemption.count({ where: { businessId: s.biz.id } })).toBe(1);
    expect(res.filter((r) => r.body.valid && !r.body.duplicate)).toHaveLength(1);
  });

  it("an expired code is expired and cannot be used; a code for another shop is invalid", async () => {
    const s = await c.shop();
    const other = await c.shop();
    const h = await c.holder();
    const { code } = (await getCode(h, s)).body;
    expect((await scanCode(other, code)).body).toMatchObject({ valid: false, reason: "invalid" });
    await c.prisma.privilegeCode.updateMany({ where: { offerId: s.offer!.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await scanCode(s, code)).body).toMatchObject({ valid: false, reason: "expired" });
    expect(await c.prisma.privilegeRedemption.count({ where: { businessId: s.biz.id } })).toBe(0);
    // An expired code does not block a new one.
    expect((await getCode(h, s)).status).toBe(200);
  });

  it("5 wrong codes lock the merchant out for the window, even for a right code", async () => {
    const s = await c.shop();
    const h = await c.holder();
    const { code } = (await getCode(h, s)).body;
    for (let i = 0; i < 5; i++) expect((await scanCode(s, `BC-000${i}-SA9`)).body).toMatchObject({ valid: false, reason: "invalid" });
    expect((await scanCode(s, code)).status).toBe(429);
    // QR scanning is not blocked by the wrong code lockout.
    expect((await scanQr(s, h.token)).body.valid).toBe(true);
  });

  it("verify is limited to 10 calls a minute per merchant", async () => {
    const s = await c.shop();
    const out = [];
    for (let i = 0; i < 11; i++) out.push((await scanQr(s, "garbage", s.biz.id, "203.0.113.6")).status);
    expect(out.slice(0, 10).every((x) => x === 200)).toBe(true);
    expect(out[10]).toBe(429);
  });
});

describe("confirm", () => {
  it("computes the saving, rounds, counts in /pass/savings, and a second confirm is 409", async () => {
    const s = await c.shop();
    const h = await c.holder();
    const v = await scanQr(s, h.token);
    const ok = await confirm(s.owner.cookie, v.body.redemptionId, { billPence: 2505 });
    expect(ok.body).toMatchObject({ ok: true, billPence: 2505, savingPence: 251 });
    expect((await confirm(s.owner.cookie, v.body.redemptionId, { billPence: 100 })).status).toBe(409);
    const row = await c.prisma.privilegeRedemption.findUniqueOrThrow({ where: { id: v.body.redemptionId } });
    expect(row).toMatchObject({ billPence: 2505, savingPence: 251 });
    expect((await c.call("GET", "/pass/savings", { cookie: h.cookie })).body).toMatchObject({ totalPence: 251, count: 1, shops: 1 });
  });

  it("double confirm racing: one wins", async () => {
    const s = await c.shop();
    const h = await c.holder();
    const v = await scanQr(s, h.token);
    const res = await Promise.all([confirm(s.owner.cookie, v.body.redemptionId, { billPence: 1000 }), confirm(s.owner.cookie, v.body.redemptionId, { billPence: 9000 })]);
    expect(res.map((r) => r.status).sort()).toEqual([200, 409]);
  });

  it("another merchant gets 404, a stale scan is 409, a bad bill is 400, no bill gives no saving", async () => {
    const s = await c.shop();
    const o = await c.shop();
    const h = await c.holder();
    const v = await scanQr(s, h.token);
    expect((await confirm(o.owner.cookie, v.body.redemptionId, { billPence: 100 })).status).toBe(404);
    expect((await confirm(h.cookie, v.body.redemptionId, { billPence: 100 })).status).toBe(404);
    expect((await confirm(s.owner.cookie, "nope")).status).toBe(404);
    expect((await confirm(s.owner.cookie, v.body.redemptionId, { billPence: -1 })).status).toBe(400);
    expect((await confirm(s.owner.cookie, v.body.redemptionId, { billPence: 100_001 })).status).toBe(400);
    expect((await confirm(s.owner.cookie, v.body.redemptionId, { billPence: 12.5 })).status).toBe(400);
    expect((await confirm(s.owner.cookie, v.body.redemptionId, { billPence: 1, extra: 1 })).status).toBe(400);
    const nobill = await confirm(s.owner.cookie, v.body.redemptionId);
    expect(nobill.body).toMatchObject({ ok: true, billPence: null, savingPence: null });
    const v2 = await scanQr(s, (await c.holder()).token);
    await c.prisma.privilegeRedemption.update({ where: { id: v2.body.redemptionId }, data: { scannedAt: new Date(Date.now() - 16 * 60_000) } });
    expect((await confirm(s.owner.cookie, v2.body.redemptionId, { billPence: 100 })).status).toBe(409);
  });

  it("a non percentage offer confirms with no saving", async () => {
    const s = await c.shop();
    await c.prisma.privilegeOffer.update({ where: { id: s.offer!.id }, data: { percent: null } });
    const v = await scanQr(s, (await c.holder()).token);
    expect(v.body.offer.percent).toBeNull();
    expect((await confirm(s.owner.cookie, v.body.redemptionId, { billPence: 1000 })).body.savingPence).toBeNull();
  });

  it("savingFor is exact for fractional percents", () => {
    expect(savingFor(1000, 12.5)).toBe(125);
    expect(savingFor(999, 10)).toBe(100);
    expect(savingFor(0, 50)).toBe(0);
  });
});

describe("terminal summary", () => {
  it("counts today's scans and confirmed savings for the owner only", async () => {
    const s = await c.shop();
    const h = await c.holder();
    const h2 = await c.holder();
    const v = await scanQr(s, h.token);
    await scanQr(s, h2.token);
    await confirm(s.owner.cookie, v.body.redemptionId, { billPence: 2000 });
    const t = await c.call("GET", `/pass/terminal/today?businessId=${s.biz.id}`, { cookie: s.owner.cookie });
    expect(t.body).toMatchObject({ scans: 2, confirmed: 1, savingsPence: 200 });
    expect(t.body.lastScanAt).toBeTruthy();
    expect((await c.call("GET", `/pass/terminal/today?businessId=${s.biz.id}`, { cookie: h.cookie })).status).toBe(404);
    expect((await c.call("GET", "/pass/terminal/today", { cookie: s.owner.cookie })).status).toBe(404);
  });
});
