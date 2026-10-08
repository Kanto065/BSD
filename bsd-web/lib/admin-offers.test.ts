import { describe, it, expect } from "vitest";
import { fmtOfferPercent, rejectReasonError } from "./admin-offers";

describe("admin offers helpers", () => {
  it("requires 5 to 300 characters after trimming", () => {
    expect(rejectReasonError("   no ")).not.toBeNull();
    expect(rejectReasonError("Too vague")).toBeNull();
    expect(rejectReasonError("x".repeat(301))).not.toBeNull();
  });
  it("formats the percent", () => {
    expect(fmtOfferPercent(10)).toBe("10% off");
    expect(fmtOfferPercent(12.5)).toBe("12.5% off");
    expect(fmtOfferPercent(null)).toBe("No percentage");
  });
});
