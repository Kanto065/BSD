import { describe, it, expect } from "vitest";
import { clockDrifted, clockOffset, copyText, deviceId, formatPence, mmss, passView, qrFresh, refreshDelayMs, slotCountdown, ukClock, type PassState, type Store } from "./pass-client";

const mem = (v: string | null = null): Store & { v: string | null } => ({
  v,
  get: async function () {
    return this.v;
  },
  set: async function (x: string) {
    this.v = x;
  },
});

describe("slotCountdown", () => {
  it("counts to the end of the slot like the API", () => {
    expect(slotCountdown(60_000, 30)).toBe(30);
    expect(slotCountdown(61_000, 30)).toBe(29);
    expect(slotCountdown(89_999, 30)).toBe(1);
    expect(slotCountdown(90_000, 30)).toBe(30);
  });
});

describe("refresh and freshness", () => {
  it("asks for a new token just after the slot ends", () => {
    expect(refreshDelayMs(30)).toBe(30_300);
    expect(refreshDelayMs(0)).toBe(1300);
  });
  it("never draws a QR from an expired or missing token", () => {
    expect(qrFresh(null, 0)).toBe(false);
    expect(qrFresh(1000, 999)).toBe(true);
    expect(qrFresh(1000, 1000)).toBe(false);
  });
});

describe("clock", () => {
  it("flags drift above 120 seconds only", () => {
    expect(clockDrifted(clockOffset(1_000_000 + 120_000, 1_000_000))).toBe(false);
    expect(clockDrifted(clockOffset(1_000_000 + 120_001, 1_000_000))).toBe(true);
    expect(clockDrifted(-130_000)).toBe(true);
  });
  it("shows UK time with BST in summer and GMT in winter", () => {
    expect(ukClock(Date.UTC(2026, 6, 1, 12, 0, 5))).toEqual({ time: "13:00:05", zone: "BST" });
    expect(ukClock(Date.UTC(2026, 0, 1, 12, 0, 5))).toEqual({ time: "12:00:05", zone: "GMT" });
  });
});

describe("deviceId", () => {
  it("makes one, stores it everywhere and keeps it", async () => {
    const a = mem();
    const b = mem();
    const id = await deviceId([a, b], () => "11111111-2222-3333-4444-555555555555");
    expect(id).toBe("11111111-2222-3333-4444-555555555555");
    expect(a.v).toBe(id);
    expect(b.v).toBe(id);
    expect(await deviceId([a, b], () => "never-used-because-stored-0000")).toBe(id);
  });
  it("restores from the second store when the first was cleared", async () => {
    const a = mem();
    const b = mem("abcdefabcdefabcdef");
    expect(await deviceId([a, b])).toBe("abcdefabcdefabcdef");
    expect(a.v).toBe("abcdefabcdefabcdef");
  });
  it("ignores an invalid stored value and survives a blocked store", async () => {
    const broken: Store = { get: async () => Promise.reject(new Error("blocked")), set: async () => Promise.reject(new Error("blocked")) };
    const ok = mem("short");
    const id = await deviceId([broken, ok], () => "99999999-8888-7777-6666-555555555555");
    expect(id).toBe("99999999-8888-7777-6666-555555555555");
    expect(ok.v).toBe(id);
  });
});

describe("passView", () => {
  const base: PassState = { member: "in", card: "active", device: "ok", online: true };
  it("maps every state", () => {
    expect(passView({ ...base, member: "loading" })).toBe("loading");
    expect(passView({ ...base, member: "out" })).toBe("signin");
    expect(passView({ ...base, member: "join" })).toBe("join");
    expect(passView({ ...base, card: "unknown" })).toBe("loading");
    expect(passView({ ...base, card: "none" })).toBe("claim");
    expect(passView({ ...base, card: "suspended" })).toBe("suspended");
    expect(passView({ ...base, online: false })).toBe("offline");
    expect(passView({ ...base, device: "conflict" })).toBe("conflict");
    expect(passView(base)).toBe("ready");
  });
  it("suspended wins over offline and conflict, offline wins over conflict", () => {
    expect(passView({ ...base, card: "suspended", online: false, device: "conflict" })).toBe("suspended");
    expect(passView({ ...base, online: false, device: "conflict" })).toBe("offline");
  });
});

describe("copyText", () => {
  it("copies and reports success", async () => {
    let got = "";
    expect(await copyText("BC-1234-SA1", { writeText: async (t) => void (got = t) })).toBe(true);
    expect(got).toBe("BC-1234-SA1");
  });
  it("reports failure when refused or missing", async () => {
    expect(await copyText("x", { writeText: () => Promise.reject(new Error("no")) })).toBe(false);
    expect(await copyText("x", undefined)).toBe(false);
  });
});

describe("formatting", () => {
  it("formats pence and countdowns", () => {
    expect(formatPence(1250)).toBe("£12.50");
    expect(formatPence(0)).toBe("£0.00");
    expect(mmss(600)).toBe("10:00");
    expect(mmss(65.4)).toBe("1:05");
    expect(mmss(-3)).toBe("0:00");
  });
});
