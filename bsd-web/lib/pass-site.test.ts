import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { FAQ_PASS, PUBLIC_LABELS, SITE_NAV } from "./pass-site-labels";
import { CardFrame } from "@/components/card/CardFrame";

// The page names are the client's. Do not edit them to make the test pass, ask the PM first.
describe("Pass public site wording", () => {
  it("keeps the client page names", () => {
    expect(SITE_NAV).toEqual({
      howItWorks: "How It Works",
      partners: "Partner Shops",
      calculator: "Savings Calculator",
      merchants: "Merchant Hub",
      faq: "FAQ",
      contact: "Contact",
    });
  });

  it("has five FAQ questions", () => {
    expect(FAQ_PASS).toHaveLength(5);
  });

  it("has no dash, connector colon or unsourced savings claim", () => {
    const all = [...Object.values(SITE_NAV), ...Object.values(PUBLIC_LABELS).flat(), ...FAQ_PASS.flatMap((f) => [f.question, f.answer])];
    for (const s of all) {
      expect(s).not.toMatch(/[–—]/);
      expect(s).not.toContain(":");
      expect(s).not.toMatch(/520/);
    }
  });

  it("frames every page with the ecosystem footer and credit line", () => {
    const html = renderToStaticMarkup(createElement(CardFrame, null, "x"));
    expect(html).toContain("https://bsd.wales");
    expect(html).toContain("https://marketplace.bsd.wales");
    expect(html).toContain("Creative Partner:");
    expect(html).toContain("CREOVA Studio");
    for (const href of ["/how-it-works", "/partners", "/calculator", "/merchants", "/faq", "/contact", "/verify"]) expect(html).toContain(`href="${href}"`);
  });
});
