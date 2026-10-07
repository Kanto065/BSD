import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// A loading.tsx makes Next send the response status before the page runs, so a page under one that calls
// notFound() answers 200 instead of 404. Keep loading.tsx away from every page that can 404.
const APP = path.resolve(__dirname, "../app");

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/^(page|layout)\.tsx$/.test(e.name)) out.push(p);
  }
  return out;
}

describe("loading.tsx scope", () => {
  it("never sits above a page or layout that calls notFound()", () => {
    const offenders: string[] = [];
    for (const file of walk(APP)) {
      if (!/\bnotFound\(\)/.test(fs.readFileSync(file, "utf8"))) continue;
      for (let dir = path.dirname(file); dir.startsWith(APP); dir = path.dirname(dir)) {
        if (fs.existsSync(path.join(dir, "loading.tsx"))) offenders.push(`${path.relative(APP, file)} is under ${path.relative(APP, dir) || "app"}/loading.tsx`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
