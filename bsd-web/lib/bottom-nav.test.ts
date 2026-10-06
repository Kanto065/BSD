import { describe, it, expect } from "vitest";
import { NAV_KEYS, activeKey, navHref, showBottomNav } from "./bottom-nav";

describe("NAV_KEYS", () => {
  it("is in the client order", () => {
    expect(NAV_KEYS).toEqual(["home", "search", "pass", "market", "profile"]);
  });
});

describe("navHref", () => {
  it.each([
    ["bsd", "home", "/"],
    ["bsd", "search", "/search"],
    ["bsd", "pass", "https://card.bsd.wales"],
    ["bsd", "market", "https://marketplace.bsd.wales"],
    ["bsd", "profile", "/account"],
    ["card", "home", "https://bsd.wales/"],
    ["card", "search", "https://bsd.wales/search"],
    ["card", "pass", "https://card.bsd.wales"],
    ["card", "market", "https://marketplace.bsd.wales"],
    ["card", "profile", "https://bsd.wales/account"],
    ["market", "home", "https://bsd.wales/"],
    ["market", "search", "https://bsd.wales/search"],
    ["market", "pass", "https://card.bsd.wales"],
    ["market", "market", "https://marketplace.bsd.wales"],
    ["market", "profile", "https://bsd.wales/account"],
  ] as const)("%s %s", (site, key, href) => {
    expect(navHref(site, key)).toBe(href);
  });
});

describe("activeKey", () => {
  it.each([
    ["/", "home"],
    ["/search", "search"],
    ["/search/x", "search"],
    ["/account", "profile"],
    ["/categories", null],
    ["/faq", null],
    ["/submit", null],
    ["/searchable", null],
    ["/accounts", null],
    ["/admin", null],
  ] as const)("bsd %s", (path, key) => {
    expect(activeKey("bsd", path)).toBe(key);
  });

  it("card is always pass and market is always market", () => {
    expect(activeKey("card", "/")).toBe("pass");
    expect(activeKey("card", "/anything")).toBe("pass");
    expect(activeKey("market", "/")).toBe("market");
    expect(activeKey("market", "/x/y")).toBe("market");
  });
});

describe("showBottomNav", () => {
  it.each([
    ["/admin", false],
    ["/admin/queue", false],
    ["/administrator", true],
    ["/", true],
    ["/search", true],
  ] as const)("%s", (path, shown) => {
    expect(showBottomNav(path)).toBe(shown);
  });
});
