// Usage: npm run copy:snapshot -- [baseUrl] <out.json>   (baseUrl defaults to https://bsd.wales)
// Records the server-rendered client copy of the static routes: title, headings, text blocks in DOM order,
// links grouped by header/main/footer, and form fields. Plain GET requests only, no dependencies.
import { writeFileSync } from "node:fs";

const ROUTES = ["/", "/about", "/faq", "/contact", "/coverage-area", "/free-access", "/community-initiative", "/bayconnect", "/privacy", "/legal", "/community-guidelines", "/complaints", "/financial-transparency", "/verification-policy", "/branding", "/zone-1", "/zone-2", "/zone-3", "/categories", "/search", "/submit", "/account"];
// Listings and categories come from the API. For these only headings, header, footer links and fields are recorded.
const DATA_ROUTES = new Set(["/categories", "/search"]);

const args = process.argv.slice(2);
const out = args.pop();
const base = (args[0] ?? "https://bsd.wales").replace(/\/$/, "");
if (!out || out.startsWith("http")) {
  console.error("Usage: npm run copy:snapshot -- [baseUrl] <out.json>");
  process.exit(2);
}

const VOID = new Set(["br", "img", "input", "hr", "meta", "link", "source", "wbr", "area", "col", "base", "path", "circle", "rect", "line"]);
// Not visible copy. Listing cards (article) are live data and left out too.
const SKIP = new Set(["script", "style", "svg", "template", "noscript", "head", "article"]);
const INLINE = new Set(["a", "span", "strong", "em", "b", "i", "small", "code", "u", "abbr", "sup", "sub", "mark", "time"]);
const REGIONS = new Set(["header", "main", "footer"]);
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…", copy: "©" };
const decode = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) =>
    e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENT[e] ?? m),
  );
const clean = (s) => decode(s).replace(/\s+/g, " ").trim();

// Next streams Suspense content (loading.tsx) as hidden divs that inline scripts move into place. Apply the
// same moves, so the snapshot sees the page a browser ends up with, not the loading skeleton.
function resolveStreaming(html) {
  const pieces = {};
  const hiddenRe = /<div hidden id="(S:\d+)">/g;
  let m;
  while ((m = hiddenRe.exec(html))) {
    let depth = 1;
    const tagRe = /<div\b|<\/div>/g;
    tagRe.lastIndex = hiddenRe.lastIndex;
    let t;
    while (depth && (t = tagRe.exec(html))) depth += t[0] === "</div>" ? -1 : 1;
    pieces[m[1]] = html.slice(hiddenRe.lastIndex, t.index);
    html = html.slice(0, m.index) + html.slice(tagRe.lastIndex);
    hiddenRe.lastIndex = m.index;
  }
  const boundary = Object.fromEntries([...html.matchAll(/\$RC\("(B:\d+)","(S:\d+)"\)/g)].map((x) => [x[1], x[2]]));
  const placeholder = Object.fromEntries([...html.matchAll(/\$RS\("(S:\d+)","(P:\d+)"\)/g)].map((x) => [x[2], x[1]]));
  const resolve = (h, guard = 0) => {
    if (guard > 50) return h;
    h = h.replace(/<template id="(P:\d+)"><\/template>/g, (all, id) => (placeholder[id] in pieces ? resolve(pieces[placeholder[id]], guard + 1) : all));
    for (let i = h.indexOf('<template id="B:'); i >= 0; i = h.indexOf('<template id="B:', i + 1)) {
      const open = /^<template id="(B:\d+)"><\/template>/.exec(h.slice(i, i + 60));
      if (!open || !(boundary[open[1]] in pieces)) continue;
      let depth = 1;
      const re = /<!--(\/?)\$[?!~]?-->/g;
      re.lastIndex = i + open[0].length;
      let c;
      while (depth && (c = re.exec(h))) depth += c[1] ? -1 : 1;
      if (depth) continue;
      h = h.slice(0, i) + resolve(pieces[boundary[open[1]]], guard + 1) + h.slice(re.lastIndex);
    }
    return h;
  };
  return resolve(html);
}

function parse(html) {
  const r = { title: "", headings: [], blocks: [], links: { header: [], main: [], footer: [], other: [] }, fields: [] };
  const stack = []; // { tag, skip, region, link, heading }
  let buf = "";
  let inTitle = false;
  const skipping = () => stack.some((e) => e.skip);
  const flush = () => {
    const t = clean(buf);
    buf = "";
    if (t && !skipping()) r.blocks.push(t);
  };
  const re = /<!--[\s\S]*?-->|<![^>]*>|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>|([^<]+|<)/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[4] !== undefined) {
      if (inTitle) r.title += m[4];
      else if (!skipping()) {
        buf += m[4];
        for (const e of stack) {
          if (e.link) e.link.text += m[4];
          if (e.heading) e.heading.text += m[4];
        }
      }
      continue;
    }
    if (!m[2]) continue; // comment
    const tag = m[2].toLowerCase();
    if (m[1]) {
      if (tag === "title") inTitle = false;
      const i = stack.findLastIndex((e) => e.tag === tag);
      if (i < 0) continue;
      if (!INLINE.has(tag)) flush();
      const [e] = stack.splice(i);
      if (e.link && !e.skip && !skipping()) r.links[e.region].push({ text: clean(e.link.text), href: e.link.href });
      if (e.heading && !e.skip && !skipping()) r.headings.push({ level: e.heading.level, text: clean(e.heading.text) });
      continue;
    }
    if (tag === "title") inTitle = true;
    const attrs = {};
    for (const a of m[3].matchAll(/([a-zA-Z_:][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) attrs[a[1].toLowerCase()] = decode(a[2] ?? a[3] ?? a[4] ?? "");
    if ((tag === "input" || tag === "select" || tag === "textarea") && attrs.type !== "hidden" && !skipping()) {
      r.fields.push(`${tag}${attrs.type ? `[${attrs.type}]` : ""} ${attrs.name ?? attrs.id ?? ""} ${(attrs.placeholder ?? "").replace(/\s+/g, " ")}`.trim());
    }
    if (tag === "script" || tag === "style") {
      // Raw text. It may contain "<" and is never copy.
      const end = html.indexOf(`</${tag}`, re.lastIndex);
      re.lastIndex = end < 0 ? html.length : html.indexOf(">", end) + 1;
      continue;
    }
    if (VOID.has(tag) || m[0].endsWith("/>")) continue;
    if (!INLINE.has(tag)) flush();
    const e = {
      tag,
      skip: SKIP.has(tag) || attrs["aria-hidden"] === "true",
      region: REGIONS.has(tag) ? tag : (stack.at(-1)?.region ?? "other"),
    };
    if (tag === "a" && attrs.href !== undefined) e.link = { text: "", href: attrs.href };
    if (/^h[1-6]$/.test(tag)) e.heading = { level: +tag[1], text: "" };
    stack.push(e);
  }
  flush();
  r.title = clean(r.title);
  return r;
}

const routes = {};
for (const p of [...ROUTES].sort()) {
  const res = await fetch(base + p, { redirect: "follow", headers: { "user-agent": "bsd-copy-snapshot" } });
  const s = parse(resolveStreaming(await res.text()));
  if (DATA_ROUTES.has(p)) {
    s.blocks = [];
    s.links.main = [];
    s.headings = s.headings.filter((h) => h.level <= 2); // h3 and below are category names from the API
  }
  routes[p] = { status: res.status, title: s.title, headings: s.headings, blocks: s.blocks, links: s.links, fields: s.fields };
}
writeFileSync(out, JSON.stringify({ routes }, null, 2) + "\n");
const n = Object.values(routes);
const sum = (f) => n.reduce((a, r) => a + f(r), 0);
console.log(`${n.length} routes, ${sum((r) => r.headings.length)} headings, ${sum((r) => r.blocks.length)} text blocks, ${sum((r) => Object.values(r.links).flat().length)} links, ${sum((r) => r.fields.length)} fields`);
