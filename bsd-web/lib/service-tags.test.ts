import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { hasTag, showTag, toggleTag } from "./service-tags";

describe("service tag chips", () => {
  it("shows a tag with a leading #", () => {
    expect(showTag("HomeDelivery")).toBe("#HomeDelivery");
  });

  it("adds a tag as a new line and keeps what was typed", () => {
    expect(toggleTag("", "BulkBuy")).toBe("BulkBuy");
    expect(toggleTag("Party catering", "BulkBuy")).toBe("Party catering\nBulkBuy");
    expect(toggleTag("Party catering\n\n", "BulkBuy")).toBe("Party catering\nBulkBuy");
  });

  it("removes a tag that is already there, in any case and with or without #", () => {
    expect(toggleTag("Party catering\nBulkBuy", "BulkBuy")).toBe("Party catering");
    expect(toggleTag("#bulkbuy\nParty catering", "BulkBuy")).toBe("Party catering");
    expect(hasTag("Home delivery", "HomeDelivery")).toBe(false);
  });

  it("toggling twice gives the text back", () => {
    const start = "My own service";
    expect(toggleTag(toggleTag(start, "SEO"), "SEO")).toBe(start);
  });

  it("chips are 44px tall and 16px on phones", () => {
    const src = readFileSync(path.resolve(__dirname, "../components/ServiceTagPicker.tsx"), "utf8");
    expect(src).toContain("min-h-11");
    expect(src).toMatch(/text-base[^"`]*sm:text-sm/);
    expect(src).toContain("aria-pressed");
  });
});
