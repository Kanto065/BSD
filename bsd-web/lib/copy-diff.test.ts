import { describe, expect, it } from "vitest";
import { diffSnapshots, type RouteSnapshot, type Snapshot } from "@/lib/copy-diff";

const route = (): RouteSnapshot => ({
  status: 200,
  title: "About",
  headings: [{ level: 1, text: "About BSD" }, { level: 2, text: "Our aim" }],
  blocks: ["About BSD", "We list local businesses."],
  links: { header: [{ text: "Home", href: "/" }], main: [{ text: "FAQ", href: "/faq" }], footer: [], other: [] },
  fields: [],
});
const snap = (r = route()): Snapshot => ({ routes: { "/about": r } });

describe("diffSnapshots", () => {
  it("is empty for equal snapshots", () => {
    expect(diffSnapshots(snap(), snap())).toEqual([]);
  });
  it("reports an added block", () => {
    const r = route();
    r.blocks.push("New line");
    expect(diffSnapshots(snap(), snap(r))).toEqual(['/about  text: added "New line"']);
  });
  it("reports a removed link", () => {
    const r = route();
    r.links.main = [];
    expect(diffSnapshots(snap(), snap(r))).toEqual(['/about  link (main): removed "FAQ -> /faq"']);
  });
  it("reports reordered headings", () => {
    const r = route();
    r.headings.reverse();
    expect(diffSnapshots(snap(), snap(r))).toEqual(["/about  heading: reordered"]);
  });
  it("reports a changed word as removed plus added", () => {
    const r = route();
    r.blocks[1] = "We list nearby businesses.";
    expect(diffSnapshots(snap(), snap(r))).toHaveLength(2);
  });
  it("reports a changed link target once", () => {
    const r = route();
    r.links.main = [{ text: "FAQ", href: "/help" }];
    expect(diffSnapshots(snap(), snap(r))).toEqual(['/about  link (main): changed target "FAQ": /faq => /help']);
  });
  it("reports a missing route", () => {
    expect(diffSnapshots(snap(), { routes: {} })).toEqual(["/about: route missing from the new snapshot"]);
  });
});
