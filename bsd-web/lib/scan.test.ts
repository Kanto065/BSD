import { describe, expect, it } from "vitest";
import { billToPence, formatCode, overlayFor, parseScanned, savingFor, withDistrict } from "./scan";

describe("parseScanned", () => {
  it("reads a pass token", () => {
    const t = "Y2FyZDEyMw.5123456.abcDEF-_123";
    expect(parseScanned(` ${t}\n`)).toEqual({ type: "qr", token: t });
  });
  it("reads a one time code in any case or spacing", () => {
    expect(parseScanned("bc 9821 sa11")).toEqual({ type: "code", code: "BC-9821-SA11" });
    expect(parseScanned("BC-9821-SA11")).toEqual({ type: "code", code: "BC-9821-SA11" });
  });
  it("rejects anything else", () => {
    for (const s of ["", "hello", "https://example.com", "BC-12-SA1", "a.b.c", "x".repeat(300)]) expect(parseScanned(s)).toBeNull();
  });
});

describe("savingFor", () => {
  it("matches the API rounding", () => {
    expect(savingFor(2000, 10)).toBe(200);
    expect(savingFor(1000, 12.5)).toBe(125);
    expect(savingFor(999, 10)).toBe(100);
    expect(savingFor(0, 50)).toBe(0);
  });
});

describe("overlayFor", () => {
  it("maps each reply to an overlay", () => {
    expect(overlayFor({ valid: false, reason: "expired" })).toBe("expired");
    expect(overlayFor({ valid: false, reason: "invalid" })).toBe("invalid");
    expect(overlayFor({ valid: false, reason: "used" })).toBe("invalid");
    expect(overlayFor({ valid: true, duplicate: true, secondsAgo: 3 })).toBe("duplicate");
    expect(overlayFor({ valid: true, member: { memberId: "BC-1", name: "A", postcodeDistrict: "SA1" }, offer: { title: "t", percent: 10, terms: "x" }, redemptionId: "r" })).toBe("valid");
  });
});

describe("keypad formatter", () => {
  it("builds BC-9821-SA11 as it is typed", () => {
    expect(formatCode("9")).toBe("BC-9");
    expect(formatCode("9821")).toBe("BC-9821");
    expect(formatCode("BC-9821-S")).toBe("BC-9821-S");
    expect(formatCode("bc9821sa11")).toBe("BC-9821-SA11");
    expect(formatCode("")).toBe("");
  });
});

describe("billToPence", () => {
  it("parses pounds", () => {
    expect(billToPence("12")).toBe(1200);
    expect(billToPence("12.5")).toBe(1250);
    expect(billToPence("0.05")).toBe(5);
    expect(billToPence("1000")).toBe(100000);
  });
  it("rejects bad amounts", () => {
    for (const s of ["", "abc", "1001", "-1", "1.234", "12,50"]) expect(billToPence(s)).toBeNull();
  });
});

describe("district taps", () => {
  it("appends the district after the four digits and replaces an earlier tap", () => {
    expect(withDistrict("BC-9821", "SA1")).toBe("BC-9821-SA1");
    expect(withDistrict("BC-9821-SA1", "SA11")).toBe("BC-9821-SA11");
    expect(withDistrict("BC-98", "SA1")).toBe("BC-98");
    expect(parseScanned(withDistrict("9821", "SA34"))).toEqual({ type: "code", code: "BC-9821-SA34" });
  });
  it("backspace on the stripped code walks back through the district", () => {
    const back = (c: string) => formatCode(c.replace(/[^A-Za-z0-9]/g, "").slice(0, -1));
    expect(back("BC-9821-SA11")).toBe("BC-9821-SA1");
    expect(back(back("BC-9821-SA1"))).toBe("BC-9821-S");
  });
});
