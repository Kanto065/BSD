// Compares two rendered-copy snapshots (see scripts/copy-snapshot.mjs). Used to prove that a visual change
// did not touch any client copy. Returns readable lines, empty when the snapshots are equal.

export type Link = { text: string; href: string };
export type RouteSnapshot = {
  status: number;
  title: string;
  headings: { level: number; text: string }[];
  blocks: string[];
  links: { header: Link[]; main: Link[]; footer: Link[]; other: Link[] };
  fields: string[];
};
export type Snapshot = { routes: Record<string, RouteSnapshot> };

const linkStr = (l: Link) => `${l.text} -> ${l.href}`;

function diffList(label: string, a: string[], b: string[], pairLinks = false): string[] {
  if (a.length === b.length && a.every((x, i) => x === b[i])) return [];
  const added = [...b];
  const removed: string[] = [];
  for (const x of a) {
    const i = added.indexOf(x);
    if (i >= 0) added.splice(i, 1);
    else removed.push(x);
  }
  if (!removed.length && !added.length) return [`${label}: reordered`];
  const out: string[] = [];
  if (pairLinks) {
    // A link with the same text but another target is reported as one change, not a removal plus an addition.
    for (const r of [...removed]) {
      const text = r.split(" -> ")[0];
      const j = added.findIndex((x) => x.split(" -> ")[0] === text);
      if (j < 0) continue;
      out.push(`${label}: changed target "${text}": ${r.slice(text.length + 4)} => ${added[j].slice(text.length + 4)}`);
      added.splice(j, 1);
      removed.splice(removed.indexOf(r), 1);
    }
  }
  for (const r of removed) out.push(`${label}: removed "${r}"`);
  for (const x of added) out.push(`${label}: added "${x}"`);
  return out;
}

export function diffSnapshots(a: Snapshot, b: Snapshot): string[] {
  const out: string[] = [];
  const paths = [...new Set([...Object.keys(a.routes), ...Object.keys(b.routes)])].sort();
  for (const p of paths) {
    const x = a.routes[p];
    const y = b.routes[p];
    if (!x || !y) {
      out.push(`${p}: route ${x ? "missing from the new snapshot" : "only in the new snapshot"}`);
      continue;
    }
    const d: string[] = [];
    if (x.status !== y.status) d.push(`status: ${x.status} => ${y.status}`);
    if (x.title !== y.title) d.push(`title: "${x.title}" => "${y.title}"`);
    d.push(...diffList("heading", x.headings.map((h) => `h${h.level} ${h.text}`), y.headings.map((h) => `h${h.level} ${h.text}`)));
    d.push(...diffList("text", x.blocks, y.blocks));
    d.push(...diffList("field", x.fields, y.fields));
    for (const k of ["header", "main", "footer", "other"] as const) {
      d.push(...diffList(`link (${k})`, x.links[k].map(linkStr), y.links[k].map(linkStr), true));
    }
    out.push(...d.map((l) => `${p}  ${l}`));
  }
  return out;
}
