import { describe, it, expect } from "vitest";
import { buildManifest, resolveRoute, siteFromHost } from "./site";

describe("siteFromHost", () => {
  it.each([
    ["card.bsd.wales", "card"],
    ["CARD.BSD.WALES:443", "card"],
    ["card.localhost:3000", "card"],
    ["marketplace.bsd.wales", "market"],
    ["marketplace.localhost", "market"],
    ["bsd.wales", "bsd"],
    ["www.bsd.wales", "bsd"],
    ["localhost:3000", "bsd"],
    ["", "bsd"],
    [null, "bsd"],
    [undefined, "bsd"],
    ["card.bsd.wales.evil.com", "bsd"],
    ["notcard.bsd.wales", "bsd"],
    ["a.card.bsd.wales", "bsd"],
    ["card.bsd.wales, bsd.wales", "card"],
    ["bsd.wales, card.bsd.wales", "bsd"],
  ] as const)("%s -> %s", (host, site) => {
    expect(siteFromHost(host)).toBe(site);
  });
});

describe("resolveRoute", () => {
  it("passes bsd paths through and hides internal folders", () => {
    for (const p of ["/", "/categories", "/admin"]) expect(resolveRoute("bsd", p)).toEqual({ action: "next" });
    for (const p of ["/card-site", "/market-site/x"]) expect(resolveRoute("bsd", p)).toEqual({ action: "notFound" });
  });
  it.each([
    ["card", "/card-site"],
    ["market", "/market-site"],
  ] as const)("rewrites %s paths under %s", (site, prefix) => {
    expect(resolveRoute(site, "/")).toEqual({ action: "rewrite", to: prefix });
    expect(resolveRoute(site, "/foo/bar")).toEqual({ action: "rewrite", to: prefix + "/foo/bar" });
    expect(resolveRoute(site, "/admin")).toEqual({ action: "rewrite", to: prefix + "/admin" });
    expect(resolveRoute(site, "/market-site")).toEqual({ action: "notFound" });
    expect(resolveRoute(site, "/card-site/x")).toEqual({ action: "notFound" });
    for (const p of ["/manifest.webmanifest", "/robots.txt", "/pwa-icon/192", "/favicon.ico"])
      expect(resolveRoute(site, p)).toEqual({ action: "next" });
  });
});

describe("buildManifest", () => {
  it.each([
    ["bsd", "Bangladeshi Business & Service Directory", "BSD", "#0C2E42"],
    ["card", "BSD Privilege Pass", "Pass", "#0D9488"],
    ["market", "BSD Marketplace", "Market", "#005A8C"],
  ] as const)("%s", (site, name, short, theme) => {
    const m = buildManifest(site);
    expect(m).toMatchObject({ name, short_name: short, theme_color: theme, start_url: "/" });
    expect(m.icons.map((i) => i.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    expect(m.icons.every((i) => i.type === "image/png")).toBe(true);
  });
});
