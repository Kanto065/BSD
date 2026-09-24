import { describe, it, expect } from "vitest";
import {
  INVALID_POSTCODE_MESSAGE,
  OUTSIDE_COVERAGE_MESSAGE,
  checkCoverage,
  isWithinCoverage,
  parsePostcode,
  resolveZone,
} from "../src/common/postcode.js";
import { ZONES } from "../prisma/seed-data.js";

describe("parsePostcode", () => {
  it("normalises case and spacing", () => {
    expect(parsePostcode("sa1 4pe")).toEqual({ ok: true, postcode: "SA1 4PE", outward: "SA1", inward: "4PE" });
    expect(parsePostcode("  SA14   8AB ")).toMatchObject({ ok: true, postcode: "SA14 8AB", outward: "SA14" });
    expect(parsePostcode("sa14 8ab")).toMatchObject({ ok: true, postcode: "SA14 8AB" });
  });

  it("accepts a postcode typed without a space", () => {
    expect(parsePostcode("SA14PE")).toMatchObject({ ok: true, postcode: "SA1 4PE", outward: "SA1" });
    expect(parsePostcode("SA109AA")).toMatchObject({ ok: true, postcode: "SA10 9AA", outward: "SA10" });
  });

  it("splits SA10 from SA1 correctly", () => {
    const a = parsePostcode("SA10 9AA");
    const b = parsePostcode("SA1 9AA");
    expect(a.ok && a.outward).toBe("SA10");
    expect(b.ok && b.outward).toBe("SA1");
  });

  it("handles other valid UK shapes", () => {
    expect(parsePostcode("W1A 1AA")).toMatchObject({ ok: true, outward: "W1A" });
    expect(parsePostcode("EC1A 1BB")).toMatchObject({ ok: true, outward: "EC1A" });
    expect(parsePostcode("M1 1AE")).toMatchObject({ ok: true, outward: "M1" });
  });

  it("rejects an outward code on its own", () => {
    expect(parsePostcode("SA1")).toEqual({ ok: false, reason: "invalid_format" });
    expect(parsePostcode("SA14")).toEqual({ ok: false, reason: "invalid_format" });
  });

  it("rejects malformed input", () => {
    for (const bad of ["", "   ", "hello", "SA1 4P", "SA1 PPE", "SA1-4PE", "SA1 4PE!", "1SA 4PE", "SA1 4PEE", "SASA1 4PE", "SA1 4P3"]) {
      expect(parsePostcode(bad)).toEqual({ ok: false, reason: "invalid_format" });
    }
  });
});

describe("coverage", () => {
  it("maps every district to exactly one zone", () => {
    const seen = new Map<string, string>();
    for (const z of ZONES) {
      for (const d of z.postcodeDistricts) {
        expect(seen.has(d), `${d} is in two zones`).toBe(false);
        seen.set(d, z.slug);
      }
    }
    expect(resolveZone("SA1", ZONES)?.slug).toBe("zone-1");
    expect(resolveZone("SA7", ZONES)?.slug).toBe("zone-1");
    expect(resolveZone("SA8", ZONES)?.slug).toBe("zone-2");
    expect(resolveZone("SA13", ZONES)?.slug).toBe("zone-2");
    expect(resolveZone("SA14", ZONES)?.slug).toBe("zone-3");
    expect(resolveZone("SA20", ZONES)?.slug).toBe("zone-3");
    expect(resolveZone("SA31", ZONES)?.slug).toBe("zone-3");
    expect(resolveZone("SA34", ZONES)?.slug).toBe("zone-3");
  });

  it("derives the zone from a full postcode", () => {
    const r = checkCoverage("sa9 1aa", ZONES);
    expect(r.ok && r.zone.slug).toBe("zone-2");
    const r2 = checkCoverage("SA34 0AA", ZONES);
    expect(r2.ok && r2.zone.slug).toBe("zone-3");
  });

  it("rejects SA21 to SA30, which belong to no zone", () => {
    for (let n = 21; n <= 30; n++) {
      expect(checkCoverage(`SA${n} 1AA`, ZONES)).toEqual({ ok: false, reason: "outside_coverage", message: OUTSIDE_COVERAGE_MESSAGE });
    }
  });

  it("rejects postcodes outside the SA area", () => {
    expect(checkCoverage("CF10 1AA", ZONES)).toMatchObject({ ok: false, reason: "outside_coverage" });
    expect(checkCoverage("SA35 1AA", ZONES)).toMatchObject({ ok: false, reason: "outside_coverage" });
    expect(checkCoverage("SA0 1AA", ZONES)).toMatchObject({ ok: false, reason: "outside_coverage" });
  });

  it("reports a malformed postcode as invalid, not as outside coverage", () => {
    expect(checkCoverage("SA1", ZONES)).toEqual({ ok: false, reason: "invalid_format", message: INVALID_POSTCODE_MESSAGE });
  });

  it("isWithinCoverage matches the districts", () => {
    expect(isWithinCoverage("SA5", ZONES)).toBe(true);
    expect(isWithinCoverage("SA25", ZONES)).toBe(false);
  });
});
