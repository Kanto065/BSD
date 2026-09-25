import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// The seed runs inside the production container (docker exec bsd-api npx tsx prisma/seed.ts). Every local file it
// imports must be copied into the image's runtime stage, or seeding fails in production only. This happened once.

const root = path.resolve(__dirname, "..");

function localImports(file: string, seen = new Set<string>()): Set<string> {
  if (seen.has(file)) return seen;
  seen.add(file);
  const text = fs.readFileSync(file, "utf8");
  for (const m of text.matchAll(/from\s+["'](\.{1,2}\/[^"']+)["']/g)) {
    const target = path.resolve(path.dirname(file), m[1]).replace(/\.js$/, ".ts");
    if (fs.existsSync(target)) localImports(target, seen);
  }
  return seen;
}

describe("API Docker image", () => {
  it("contains every file the seed imports", () => {
    const runtime = fs.readFileSync(path.join(root, "Dockerfile"), "utf8").split(/^FROM .* AS runtime$/m)[1];
    expect(runtime, "runtime stage").toBeTruthy();
    const copied = [...runtime.matchAll(/COPY --from=build \/app\/(\S+)/g)].map((m) => m[1]);
    for (const file of localImports(path.join(root, "prisma", "seed.ts"))) {
      const top = path.relative(root, file).split(path.sep)[0];
      expect(copied, `${path.relative(root, file)} is imported by the seed but ${top}/ is not copied into the image`).toContain(top);
    }
  });
});
