import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// Source level guards for the phone sized controls (44px targets, 16px inputs). They fail if someone removes the classes.
const read = (p: string) => readFileSync(path.resolve(__dirname, "..", p), "utf8");

describe("tap targets and input size", () => {
  it("header controls are at least 44px tall", () => {
    const src = read("components/Header.tsx");
    expect(src).toMatch(/aria-label="BSD home" className="inline-flex min-h-11/);
    expect(src).toMatch(/href="\/submit"\s+className="press inline-flex min-h-11/);
  });

  it("admin links and sign out are at least 44px", () => {
    const src = read("components/admin/AdminShell.tsx");
    expect(src.match(/min-h-11/g)!.length).toBeGreaterThanOrEqual(4);
    expect(src.match(/h-11 w-11/g)!.length).toBe(2);
    expect(src).not.toMatch(/rounded-lg p-2 text-slate-(200|300)/);
  });

  it("bottom nav items fill the bar height", () => {
    expect(read("components/BottomNav.tsx")).toMatch(/h-full min-h-11 w-full/);
  });

  it("admin site inputs are 16px on phones", () => {
    expect(read("app/(bsd)/admin/site/page.tsx")).toContain('inputClass.replace("text-sm", "text-base sm:text-sm")');
  });
});
