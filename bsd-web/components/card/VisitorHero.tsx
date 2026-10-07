import Link from "next/link";
import SiteSession from "@/components/SiteSession";
import { SiteLinks } from "@/components/SitePlaceholder";
import { PUBLIC_LABELS as T, SITE_NAV as N } from "@/lib/pass-site-labels";

const chip = "inline-flex min-h-11 items-center rounded-full border border-white/30 px-4 text-sm font-semibold text-white hover:bg-white/10 focus-visible:outline-white";

// What a visitor who is not signed in sees on the Pass home: the marketing hero with links to the public pages.
export default function VisitorHero({ apiBase }: { apiBase: string }) {
  return (
    <div className="motion-safe:animate-rise">
      <p className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-teal-300 ring-1 ring-white/15">{T.pill}</p>
      <h1 className="mt-5 text-4xl font-bold tracking-tight text-white">{T.heroTitle}</h1>
      <p className="mt-4 max-w-[46ch] text-base leading-relaxed text-slate-300">{T.heroBody}</p>
      <div className="mt-6 rounded-2xl bg-white/[0.06] px-5 py-4 ring-1 ring-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
        <SiteSession site="card" apiBase={apiBase} />
      </div>
      <nav aria-label="Privilege Pass pages" className="mt-6 flex flex-wrap gap-2">
        <Link href="/partners" className="inline-flex min-h-11 items-center rounded-full bg-teal-600 px-5 text-sm font-semibold text-white hover:bg-teal-500 focus-visible:outline-white">{T.heroCta}</Link>
        <Link href="/how-it-works" className={chip}>{N.howItWorks}</Link>
        <Link href="/calculator" className={chip}>{N.calculator}</Link>
        <Link href="/merchants" className={chip}>{N.merchants}</Link>
        <Link href="/faq" className={chip}>{N.faq}</Link>
        <Link href="/contact" className={chip}>{N.contact}</Link>
      </nav>
      <div className="mt-6">
        <SiteLinks />
      </div>
    </div>
  );
}
