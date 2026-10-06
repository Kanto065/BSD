import { describe, it, expect } from "vitest";
import { CONTACT_CHANNELS, CREATIVE_PARTNER, FAQ_ITEMS, HOME_FAQ, creativePartnerHref } from "./content";

describe("creativePartnerHref", () => {
  it.each([
    ["", null],
    ["http://x", null],
    ["javascript:alert(1)", null],
    ["not a url", null],
    ["https://studio.example", "https://studio.example"],
  ])("%j gives %j", (input, expected) => {
    expect(creativePartnerHref(input)).toBe(expected);
  });

  it("is plain text until the studio URL is configured", () => {
    expect(CREATIVE_PARTNER.name).toBe("CREOVA Studio");
    expect(creativePartnerHref()).toBeNull();
  });
});

describe("no visible email in content", () => {
  it("keeps @bsd.wales out of the contact channels and FAQ", () => {
    for (const data of [CONTACT_CHANNELS, FAQ_ITEMS, HOME_FAQ]) {
      expect(JSON.stringify(data)).not.toContain("@bsd.wales");
    }
  });
});
