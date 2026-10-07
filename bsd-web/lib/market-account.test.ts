import { describe, it, expect } from "vitest";
import { HELP_CATEGORIES, TABS, TAB_LABEL, TICKET_CATEGORIES, canRelist, helpSearch, statusNote, tabFor } from "./market-account";

const NOW = Date.parse("2026-10-08T12:00:00Z");
const hours = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const future = new Date(NOW + 86_400_000).toISOString();
const past = new Date(NOW - 86_400_000).toISOString();

describe("tab mapping", () => {
  it("live and held listings are active, closed ones are archived", () => {
    expect(tabFor({ status: "ACTIVE", expiresAt: future }, NOW)).toBe("active");
    expect(tabFor({ status: "RESERVED", expiresAt: future }, NOW)).toBe("active");
    expect(tabFor({ status: "PENDING", expiresAt: future }, NOW)).toBe("active");
    for (const status of ["SOLD", "ARCHIVED", "REMOVED"] as const) expect(tabFor({ status, expiresAt: future }, NOW)).toBe("archived");
  });
  it("an active listing past its expiry shows as archived", () => {
    expect(tabFor({ status: "ACTIVE", expiresAt: past }, NOW)).toBe("archived");
    expect(statusNote({ status: "ACTIVE", reportCount: 0, expiresAt: past }, NOW)).toBe("Expired");
  });
  it("a listing held after reports reads Under review", () => {
    expect(statusNote({ status: "PENDING", reportCount: 3, expiresAt: future }, NOW)).toBe("Under review");
    expect(statusNote({ status: "PENDING", reportCount: 0, expiresAt: future }, NOW)).toBe("Waiting for review");
    expect(statusNote({ status: "ACTIVE", reportCount: 0, expiresAt: future }, NOW)).toBeNull();
  });
});

describe("relist eligibility", () => {
  it("needs 24 hours since the last bump", () => {
    expect(canRelist({ status: "ACTIVE", bumpedAt: hours(23) }, NOW)).toBe(false);
    expect(canRelist({ status: "ACTIVE", bumpedAt: hours(24) }, NOW)).toBe(true);
    expect(canRelist({ status: "ARCHIVED", bumpedAt: hours(48) }, NOW)).toBe(true);
  });
  it("never for held, sold or removed listings", () => {
    for (const status of ["PENDING", "SOLD", "REMOVED"] as const) expect(canRelist({ status, bumpedAt: hours(100) }, NOW)).toBe(false);
  });
});

describe("account and help wording", () => {
  it("keeps the client's tab names", () => {
    expect(TABS.map((t) => TAB_LABEL[t])).toEqual(["My Active Listings", "Saved", "Expired / Archived", "My Support Tickets", "Privilege Pass"]);
  });
  it("ticket categories match the API list", () => {
    expect([...TICKET_CATEGORIES]).toEqual(["Listing problem", "My account", "Safety concern", "Privilege Pass", "Other"]);
  });
  it("help has four categories and searches title and body", () => {
    expect(HELP_CATEGORIES).toHaveLength(4);
    const a = [{ category: "Buying" as const, title: "Meeting a seller", body: "Choose a public place." }];
    expect(helpSearch(a, "PUBLIC")).toHaveLength(1);
    expect(helpSearch(a, "zebra")).toHaveLength(0);
    expect(helpSearch(a, "  ")).toHaveLength(1);
  });
  it("no em dashes in the copy", () => {
    expect(JSON.stringify([TAB_LABEL, HELP_CATEGORIES, TICKET_CATEGORIES])).not.toContain("—");
  });
});
