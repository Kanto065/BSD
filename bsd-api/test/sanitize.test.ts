import { describe, it, expect } from "vitest";
import { sanitizeText, sanitizeTextArray } from "../src/common/sanitize.js";

describe("sanitizeText", () => {
  it("keeps ordinary punctuation as plain text", () => {
    expect(sanitizeText("Fish & Chips")).toBe("Fish & Chips");
    expect(sanitizeText("Café \"Deluxe\" and Tom's")).toBe("Café \"Deluxe\" and Tom's");
    expect(sanitizeText("Open 9-5, Mon & Tue")).toBe("Open 9-5, Mon & Tue");
  });

  it("removes every tag, and the content of script and style blocks", () => {
    expect(sanitizeText("Tom's <b>Bakery</b>")).toBe("Tom's Bakery");
    expect(sanitizeText("<script>alert(1)</script>Halal")).toBe("Halal");
    expect(sanitizeText("<style>body{display:none}</style>Shop")).toBe("Shop");
    expect(sanitizeText('<img src=x onerror="alert(1)">Menu')).toBe("Menu");
    expect(sanitizeText('<a href="javascript:alert(1)">click</a>')).toBe("click");
  });

  it("returns plain text, never markup, even from escaped input", () => {
    // Literal entity text becomes the character. It is still only text, and React escapes it on the page.
    expect(sanitizeText("5 > 3 and 2 < 4")).toBe("5 > 3 and 2 < 4");
    expect(sanitizeText("a &amp; b")).toBe("a & b");
    const out = sanitizeText("<p>Hello <i>world</i></p>");
    expect(out).toBe("Hello world");
    expect(out).not.toMatch(/<[a-z]/i);
  });

  it("keeps line breaks but tidies whitespace and control characters", () => {
    expect(sanitizeText("  Mon 9-5\r\nTue 9-5  \n\n\n\nSun closed ")).toBe("Mon 9-5\nTue 9-5\n\nSun closed");
    expect(sanitizeText("bad\u0000char\u0007s")).toBe("badchars");
  });

  it("drops entries that end up empty", () => {
    expect(sanitizeTextArray(["Halal meat", "<b></b>", "   ", "Spices & more"])).toEqual(["Halal meat", "Spices & more"]);
  });
});
