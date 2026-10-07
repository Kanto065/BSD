import { describe, it, expect } from "vitest";
import { descriptionStatus } from "./description";

const chars = (n: number) => "a".repeat(n);

describe("descriptionStatus", () => {
  it("handles empty text", () => {
    const s = descriptionStatus("");
    expect(s).toMatchObject({ chars: 0, ok: false, counter: "0 of 150 characters minimum" });
    expect(s.message).toBe("The short description must be at least 150 characters.");
  });
  it("1 character", () => {
    expect(descriptionStatus("a").counter).toBe("1 of 150 characters minimum, 149 more needed");
  });
  it("149 fails, 150 passes, 151 passes", () => {
    expect(descriptionStatus(chars(149)).ok).toBe(false);
    expect(descriptionStatus(chars(149)).counter).toBe("149 of 150 characters minimum, 1 more needed");
    expect(descriptionStatus(chars(150))).toMatchObject({ ok: true, message: "", counter: "150 characters" });
    expect(descriptionStatus(chars(151)).ok).toBe(true);
  });
  it("151 words fails with the word message and counter suffix", () => {
    const s = descriptionStatus(Array(151).fill("ab").join(" "));
    expect(s.ok).toBe(false);
    expect(s.message).toBe("The short description must be 150 words or fewer.");
    expect(s.counter).toBe("452 characters, 1 words over the limit");
  });
  it("150 short words is fine", () => {
    expect(descriptionStatus(Array(150).fill("ab").join(" ")).ok).toBe(true);
  });
  it("padding does not count", () => {
    expect(descriptionStatus(`   ${chars(149)}   \n`).ok).toBe(false);
    expect(descriptionStatus(`   ${chars(150)}   `).chars).toBe(150);
  });
});
