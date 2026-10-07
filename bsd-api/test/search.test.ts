import { describe, it, expect } from "vitest";
import { normaliseTerm, cleanWord } from "../src/common/search.js";
import { STARTER_SYNONYMS } from "../prisma/seed-synonyms.js";

describe("normaliseTerm", () => {
  it("lowercases, collapses spaces and trims punctuation", () => {
    expect(normaliseTerm("  Hijama!!  ")).toBe("hijama");
    expect(normaliseTerm("Cupping   THERAPY")).toBe("cupping therapy");
    expect(normaliseTerm("(halal)")).toBe("halal");
  });
  it("removes zero width characters and converts Bangla digits", () => {
    expect(normaliseTerm("হি‌জামা")).toBe("হিজামা");
    expect(normaliseTerm("a‍b")).toBe("ab");
    expect(normaliseTerm("২৪ ঘণ্টা")).toBe("24 ঘণ্টা");
  });
  it("keeps a trailing Bangla vowel sign and composes to NFC", () => {
    expect(normaliseTerm("হিজামা")).toBe("হিজামা");
    expect(normaliseTerm("é")).toBe("é");
  });
  it("still neutralises LIKE wildcards in a search word", () => {
    expect(cleanWord("50%_off\\")).toBe("50off");
  });
});

describe("starter list", () => {
  it("is 80 or more valid rows with unique normalised terms and sensible expansions", () => {
    expect(STARTER_SYNONYMS.length).toBeGreaterThanOrEqual(80);
    const terms = STARTER_SYNONYMS.map(([t]) => normaliseTerm(t));
    expect(new Set(terms).size).toBe(terms.length);
    for (const [t, ex] of STARTER_SYNONYMS) {
      expect(t.length).toBeLessThanOrEqual(60);
      expect(/^[ঀ-৿a-z0-9 -]+$/.test(normaliseTerm(t)), t).toBe(true);
      expect(ex.length).toBeGreaterThanOrEqual(1);
      expect(ex.length).toBeLessThanOrEqual(8);
      for (const e of ex) {
        expect(e.length).toBeGreaterThanOrEqual(2);
        expect(e.length).toBeLessThanOrEqual(40);
        expect(normaliseTerm(e)).not.toBe(normaliseTerm(t));
      }
    }
  });
});
