// UK postcode helpers for the submission flow. Pure functions, no database.
//
// A submitted postcode is normalised ("sa1  4pe" becomes "SA1 4PE"), split into its outward code ("SA1")
// and inward code ("4PE"), and mapped to a coverage zone through each zone's postcodeDistricts. Anything
// that is not a full, well-formed UK postcode, or whose outward code is in no zone, is rejected.

export const INVALID_POSTCODE_MESSAGE = "Enter a full UK postcode, for example SA1 4PE.";
export const OUTSIDE_COVERAGE_MESSAGE =
  "That postcode is outside the BSD coverage area (SA1 to SA20 and SA31 to SA34).";

export type ParsedPostcode =
  | { ok: true; postcode: string; outward: string; inward: string }
  | { ok: false; reason: "invalid_format" };

const OUTWARD = /^[A-Z]{1,2}\d[A-Z\d]?$/;
const INWARD = /^\d[A-Z]{2}$/;

/**
 * Normalise a full UK postcode. The inward code is always the last three characters, so the split is
 * unambiguous even when the user typed no space or extra spaces. An outward code on its own (for
 * example "SA1") is not a full postcode and is rejected.
 */
export function parsePostcode(input: string): ParsedPostcode {
  const cleaned = input.replace(/\s+/g, "").toUpperCase();
  if (cleaned.length < 5 || cleaned.length > 7 || /[^A-Z0-9]/.test(cleaned)) {
    return { ok: false, reason: "invalid_format" };
  }
  const inward = cleaned.slice(-3);
  const outward = cleaned.slice(0, -3);
  if (!OUTWARD.test(outward) || !INWARD.test(inward)) return { ok: false, reason: "invalid_format" };
  return { ok: true, postcode: `${outward} ${inward}`, outward, inward };
}

export type ZoneLike = { postcodeDistricts: string[] };

/** The zone whose postcodeDistricts include this outward code, if any. */
export function resolveZone<T extends ZoneLike>(outward: string, zones: readonly T[]): T | undefined {
  return zones.find((z) => z.postcodeDistricts.includes(outward));
}

export type CoverageCheck<T extends ZoneLike> =
  | { ok: true; postcode: string; outward: string; zone: T }
  | { ok: false; reason: "invalid_format" | "outside_coverage"; message: string };

/** Parse a postcode and require it to fall inside one of the given zones. */
export function checkCoverage<T extends ZoneLike>(input: string, zones: readonly T[]): CoverageCheck<T> {
  const parsed = parsePostcode(input);
  if (!parsed.ok) return { ok: false, reason: "invalid_format", message: INVALID_POSTCODE_MESSAGE };
  const zone = resolveZone(parsed.outward, zones);
  if (!zone) return { ok: false, reason: "outside_coverage", message: OUTSIDE_COVERAGE_MESSAGE };
  return { ok: true, postcode: parsed.postcode, outward: parsed.outward, zone };
}

/** True when the outward code belongs to any zone. */
export function isWithinCoverage(outward: string, zones: readonly ZoneLike[]): boolean {
  return resolveZone(outward, zones) !== undefined;
}
