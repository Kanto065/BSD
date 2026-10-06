// Usage: npm run copy:diff -- <old.json> <new.json>. Exits 1 and prints a readable diff when the copy differs.
import { readFileSync } from "node:fs";
import { diffSnapshots } from "../lib/copy-diff.ts";

const [a, b] = process.argv.slice(2);
if (!a || !b) {
  console.error("Usage: npm run copy:diff -- <old.json> <new.json>");
  process.exit(2);
}
const lines = diffSnapshots(JSON.parse(readFileSync(a, "utf8")), JSON.parse(readFileSync(b, "utf8")));
if (lines.length) {
  console.error(`${lines.length} copy difference(s)\n${lines.join("\n")}`);
  process.exit(1);
}
console.log("No copy differences.");
