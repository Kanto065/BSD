import { describe, it, expect } from "vitest";
import { annualSaving, PERCENT, SPEND } from "./calculator";

describe("annualSaving", () => {
  it("is spend times 12 times percent", () => {
    expect(annualSaving(100, 10)).toBe(120);
    expect(annualSaving(SPEND.start, PERCENT.start)).toBe(120);
    expect(annualSaving(250, 15)).toBe(450);
  });
  it("rounds to whole pounds", () => {
    expect(annualSaving(15, 7)).toBe(13); // 12.6
  });
  it("is zero at zero and clamps bad input", () => {
    expect(annualSaving(0, 10)).toBe(0);
    expect(annualSaving(100, 0)).toBe(0);
    expect(annualSaving(-5, 10)).toBe(0);
    expect(annualSaving(10_000, 10)).toBe(annualSaving(SPEND.max, 10));
    expect(annualSaving(100, 500)).toBe(1200);
  });
});
