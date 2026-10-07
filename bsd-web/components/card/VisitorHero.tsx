import SiteSession from "@/components/SiteSession";
import { SiteLinks } from "@/components/SitePlaceholder";
import { SITES } from "@/lib/site";

// What a visitor who is not signed in sees on the Pass home. Same words as the placeholder it replaces. M11-E
// swaps this for the client's marketing hero.
export default function VisitorHero({ apiBase }: { apiBase: string }) {
  const site = SITES.card;
  return (
    <div className="motion-safe:animate-rise">
      <p className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-teal-300 ring-1 ring-white/15">Coming soon.</p>
      <h1 className="mt-5 text-4xl font-bold tracking-tight text-white">{site.name}</h1>
      <p className="mt-4 max-w-[46ch] text-base leading-relaxed text-slate-300">{site.description}</p>
      <div className="mt-8">
        <SiteLinks />
      </div>
      <div className="mt-6 rounded-2xl bg-white/[0.06] px-5 py-4 ring-1 ring-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
        <SiteSession site="card" apiBase={apiBase} />
      </div>
    </div>
  );
}
