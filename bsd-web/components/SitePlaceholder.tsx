import SiteSession from "@/components/SiteSession";
import { SITES, type SiteInfo } from "@/lib/site";

// Shared look for the Pass and Marketplace placeholders: navy shell, one accent per site
// (Pass teal, Marketplace ocean blue), decorative shapes that stand in for the future product.
// Everything here is server rendered. The only motion is a 300ms rise on load, under motion-safe.

const THEME = {
  card: {
    glow: "bg-[radial-gradient(60%_50%_at_85%_0%,rgba(13,148,136,0.45),transparent_70%),radial-gradient(50%_40%_at_0%_100%,rgba(13,148,136,0.18),transparent_70%)]",
    tint: "text-teal-300",
    solid: "#0F766E",
  },
  market: {
    glow: "bg-[radial-gradient(60%_50%_at_85%_0%,rgba(0,90,140,0.7),transparent_70%),radial-gradient(50%_40%_at_0%_100%,rgba(0,90,140,0.3),transparent_70%)]",
    tint: "text-sky-300",
    solid: "#005A8C",
  },
} as const;

const keyOf = (site: SiteInfo) => (site === SITES.card ? "card" : "market");

const onDark = "focus-visible:outline-white";
const press = "touch-manipulation select-none motion-safe:transition-transform motion-safe:duration-150 active:scale-[0.98]";

export function SiteBar({ site }: { site: SiteInfo }) {
  const t = THEME[keyOf(site)];
  return (
    <header className="relative flex items-center gap-3 px-4 py-4 sm:px-6">
      <span
        aria-hidden="true"
        className="flex h-8 w-8 items-center justify-center rounded-lg font-heading text-sm font-bold text-white ring-1 ring-white/20"
        style={{ background: t.solid }}
      >
        {site.letter}
      </span>
      <span className="font-heading text-sm font-semibold text-white">{site.name}</span>
    </header>
  );
}

/** Page shell for both sites and their 404s. */
export function SiteShell({ site, children }: { site: SiteInfo; children: React.ReactNode }) {
  const t = THEME[keyOf(site)];
  return (
    <div className="relative isolate flex flex-1 flex-col overflow-hidden bg-bc-shell">
      <div aria-hidden="true" className={`absolute inset-0 -z-10 ${t.glow}`} />
      <SiteBar site={site} />
      {children}
    </div>
  );
}

export function SiteLinks({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-3 text-sm font-semibold">
      {children}
      <a
        href="https://bsd.wales"
        className={`inline-flex min-h-[44px] items-center rounded-full border border-white/30 px-5 text-white hover:bg-white/10 ${press} ${onDark}`}
      >
        Back to BSD Directory
      </a>
    </div>
  );
}

const bar = "h-2 rounded-full bg-white/25";

function PassArt() {
  return (
    <div aria-hidden="true" className="relative mx-auto h-48 w-full max-w-sm sm:h-56 md:max-w-md">
      <div className="absolute inset-x-6 top-0 h-full rounded-3xl bg-white/5 ring-1 ring-white/10 md:rotate-3" />
      <div className="absolute inset-0 top-4 rounded-3xl bg-white/5 p-1.5 ring-1 ring-white/10 md:-rotate-2">
        <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-[1.25rem] bg-gradient-to-br from-teal-600 to-teal-900 p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)]">
          <div className="flex items-center justify-between">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 font-heading text-sm font-bold text-white">P</span>
            <span className="h-2 w-12 rounded-full bg-white/30" />
          </div>
          <div className="space-y-2">
            <div className={`${bar} w-2/3`} />
            <div className={`${bar} w-2/5`} />
          </div>
          <span className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-bc-shell" />
          <span className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-bc-shell" />
        </div>
      </div>
    </div>
  );
}

function MarketArt() {
  const tile = "rounded-2xl bg-white/5 p-1 ring-1 ring-white/10";
  const core = "h-full rounded-[0.8rem] p-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)]";
  return (
    <div aria-hidden="true" className="mx-auto grid h-48 w-full max-w-sm grid-cols-3 grid-rows-2 gap-3 sm:h-56 md:max-w-md">
      <div className={`${tile} col-span-2`}>
        <div className={`${core} bg-gradient-to-br from-sky-600 to-bc-bar`}>
          <div className={`${bar} w-1/2`} />
          <div className={`${bar} mt-2 w-1/3`} />
        </div>
      </div>
      <div className={tile}>
        <div className={`${core} bg-white/10`}>
          <div className="h-7 w-7 rounded-lg bg-white/25" />
        </div>
      </div>
      <div className={tile}>
        <div className={`${core} bg-white/10`}>
          <div className="h-7 w-7 rounded-lg bg-white/25" />
        </div>
      </div>
      <div className={`${tile} col-span-2`}>
        <div className={`${core} bg-bc-bar/70`}>
          <div className={`${bar} w-2/5`} />
          <div className={`${bar} mt-2 w-1/4`} />
        </div>
      </div>
    </div>
  );
}

export default function SitePlaceholder({ site, apiBase }: { site: SiteInfo; apiBase: string }) {
  const key = keyOf(site);
  const t = THEME[key];
  return (
    <SiteShell site={site}>
      <main className="mx-auto grid w-full max-w-5xl flex-1 content-center items-center gap-10 px-4 py-10 sm:px-6 md:grid-cols-2 md:gap-14 md:py-16">
        <div className="motion-safe:animate-rise">
          <p className={`inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold ring-1 ring-white/15 ${t.tint}`}>Coming soon.</p>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-white md:text-5xl">{site.name}</h1>
          <p className="mt-4 max-w-[46ch] text-base leading-relaxed text-slate-300">{site.description}</p>
          <div className="mt-8">
            <SiteLinks />
          </div>
          <div className="mt-6 rounded-3xl bg-white/5 p-1.5 ring-1 ring-white/10">
            <div className="rounded-[1.25rem] bg-white p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)]">
              <SiteSession site={key} apiBase={apiBase} />
            </div>
          </div>
        </div>
        <div className="motion-safe:animate-rise">{key === "card" ? <PassArt /> : <MarketArt />}</div>
      </main>
    </SiteShell>
  );
}
