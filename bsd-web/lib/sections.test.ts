import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DEFAULT_CONFIG, HOME_KEYS, PAGE_PATHS, SECTION_TEXT, bannerLines, hiddenPaths, normalizeConfig, sectionText } from "./sections";

describe("sections registry", () => {
  const api = readFileSync(path.resolve(__dirname, "../../bsd-api/src/modules/site/site.registry.ts"), "utf8");
  const apiKeys = [...api.matchAll(/key: "([a-z-]+)"/g)].map((m) => m[1]);

  it("uses keys the API knows, and the API's homepage order", () => {
    for (const k of [...HOME_KEYS, ...Object.keys(PAGE_PATHS), ...Object.keys(SECTION_TEXT)]) expect(apiKeys).toContain(k);
    const apiHome = apiKeys.filter((k) => k.startsWith("home-"));
    expect(apiHome).toEqual(HOME_KEYS);
  });

  it("never lets a protected page be hidden", () => {
    for (const k of ["privacy", "legal", "free-access", "verification-policy", "submit", "account"]) expect(PAGE_PATHS).not.toHaveProperty(k);
  });
});

describe("defaults keep today's copy", () => {
  it("shows the standard text when nothing is overridden", () => {
    expect(sectionText(DEFAULT_CONFIG, "home-how", "title")).toBe("How It Works");
    expect(sectionText(DEFAULT_CONFIG, "footer-cta", "body")).toBe("Get listed in our community-verified directory or download our regional coverage guide.");
    expect(hiddenPaths(DEFAULT_CONFIG)).toEqual([]);
    expect(bannerLines(DEFAULT_CONFIG.maintenance)).toEqual([]);
  });

  it("applies an override and falls back when it is empty", () => {
    const c = normalizeConfig({ ...DEFAULT_CONFIG, sections: { "home-how": { visible: true, title: "Easy as 1 2 3", body: null }, about: { visible: false, title: null, body: null } } });
    expect(sectionText(c, "home-how", "title")).toBe("Easy as 1 2 3");
    expect(sectionText(c, "home-how", "body")).toBe("3 simple steps");
    expect(hiddenPaths(c)).toEqual(["/about"]);
  });
});

describe("normalizeConfig", () => {
  it("survives garbage and keeps every homepage section exactly once", () => {
    expect(normalizeConfig(null)).toEqual(DEFAULT_CONFIG);
    expect(normalizeConfig({ maintenance: { enabled: "yes" }, homeOrder: ["nope"] }).maintenance.enabled).toBe(false);
    expect(normalizeConfig({ homeOrder: ["home-faq", "home-faq", "x"] }).homeOrder).toEqual(["home-faq", ...HOME_KEYS.filter((k) => k !== "home-faq")]);
  });
});

describe("bannerLines", () => {
  it("returns nothing when off or blank, English first when on", () => {
    expect(bannerLines({ enabled: false, textEn: "a", textBn: "b" })).toEqual([]);
    expect(bannerLines({ enabled: true, textEn: "  ", textBn: "" })).toEqual([]);
    expect(bannerLines({ enabled: true, textEn: " Back soon ", textBn: "বাংলা" })).toEqual(["Back soon", "বাংলা"]);
  });
});
