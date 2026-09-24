import { describe, it, expect } from "vitest";
import { safeExternalUrl, whatsappLink } from "./api";

// Business owners type these values, so they are treated as untrusted. Only a real http(s) URL may become a link.
describe("safeExternalUrl", () => {
  it("accepts real web addresses", () => {
    expect(safeExternalUrl("https://www.example.com")).toBe("https://www.example.com/");
    expect(safeExternalUrl("http://example.com/menu")).toBe("http://example.com/menu");
    expect(safeExternalUrl("  https://example.com/a?b=c  ")).toBe("https://example.com/a?b=c");
  });

  it("adds https to a bare domain", () => {
    expect(safeExternalUrl("example.com")).toBe("https://example.com/");
    expect(safeExternalUrl("www.example.co.uk/shop")).toBe("https://www.example.co.uk/shop");
  });

  it("never returns a javascript:, data: or other non-web scheme", () => {
    for (const bad of [
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      " javascript:alert(1)",
      "java\nscript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
      "ftp://example.com",
      "//evil.example.com",
      "mailto:someone@example.com",
    ]) {
      expect(safeExternalUrl(bad), bad).toBeNull();
    }
  });

  it("returns null for text that is not an address", () => {
    for (const notUrl of ["", "   ", "@myshop on Facebook", "call me", "not a url", "http://exa mple.com", null]) {
      expect(safeExternalUrl(notUrl as string | null), String(notUrl)).toBeNull();
    }
  });

  it("only ever returns an http or https URL", () => {
    for (const input of ["example.com", "https://a.b", "http://a.b/x", "a.b/c?d=e#f"]) {
      const out = safeExternalUrl(input);
      expect(out === null || /^https?:\/\//.test(out)).toBe(true);
    }
  });
});

describe("whatsappLink", () => {
  it("builds an international wa.me link", () => {
    expect(whatsappLink("07700 900123")).toBe("https://wa.me/447700900123");
    expect(whatsappLink("+44 7700 900123")).toBe("https://wa.me/447700900123");
    expect(whatsappLink("0044 7700 900123")).toBe("https://wa.me/447700900123");
    expect(whatsappLink("(07700) 900-123")).toBe("https://wa.me/447700900123");
  });

  it("reduces the value to digits, so nothing else can reach the URL", () => {
    const link = whatsappLink("07700 900123<script>alert(1)</script>");
    expect(link === null || /^https:\/\/wa\.me\/\d+$/.test(link)).toBe(true);
  });

  it("returns null when it is not a plausible phone number", () => {
    for (const bad of ["", "abc", "123", "0", "1".repeat(20)]) expect(whatsappLink(bad), bad).toBeNull();
  });
});
