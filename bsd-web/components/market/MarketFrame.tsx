import Link from "next/link";
import { CREATIVE_PARTNER, ZONES, creativePartnerHref, zoneLabel } from "@/lib/content";
import { COPYRIGHT, searchHref } from "@/lib/market-api";
import { SITES } from "@/lib/site";

// Header, footer and page width for every Marketplace page. Server rendered. The light canvas sits inside the dark
// body so the 404 page keeps its own look.

const link = "inline-flex min-h-11 items-center rounded-md px-1.5 text-sm sm:px-2 font-medium text-slate-700 hover:text-bc-bar";
const footLink = "inline-flex min-h-11 items-center text-sm text-slate-300 hover:text-white focus-visible:outline-white";

export function MarketFrame({ children }: { children: React.ReactNode }) {
  const partner = creativePartnerHref();
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-bc-canvas">
      <div className="bg-bc-shell px-4 text-xs text-slate-200">
        <div className="mx-auto flex min-h-9 max-w-6xl flex-wrap items-center justify-between gap-x-6 py-1.5">
          <p>Part of BayConnect CIC | 0% Commission | Safe Public Exchange</p>
          <p className="hidden gap-4 sm:flex">
            <a href={SITES.bsd.origin} className="hover:text-white focus-visible:outline-white">BSD Directory</a>
            <a href={SITES.card.origin} className="hover:text-white focus-visible:outline-white">Privilege Pass</a>
          </p>
        </div>
      </div>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 px-4 py-2">
          <Link href="/" className="flex min-h-11 items-center gap-2 font-heading text-base font-bold text-bc-shell">
            <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-lg bg-bc-bar text-sm text-white">M</span>
            {SITES.market.name}
          </Link>
          <nav aria-label="Marketplace" className="flex flex-wrap items-center">
            <Link href="/search" className={link}>Browse</Link>
            <Link href="/buyer-requests" className={link}>Wanted</Link>
            <Link href="/my-account" className={`${link} hidden sm:inline-flex`}>My Account</Link>
            <Link
              href="/post-listing"
              className="press ml-1 inline-flex min-h-11 items-center rounded-full bg-bc-bar px-3 text-sm sm:px-4 font-semibold text-white hover:bg-bc-shell"
            >
              Post a Listing
            </Link>
          </nav>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <footer className="bg-bc-shell px-4 py-10 text-slate-300">
        <div className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <nav aria-label="Ecosystem Links">
            <h2 className="font-heading text-sm font-bold text-white">Ecosystem Links</h2>
            <ul className="mt-2">
              <li><a href={SITES.bsd.origin} className={footLink}>BSD Directory</a></li>
              <li><a href={SITES.card.origin} className={footLink}>Privilege Pass</a></li>
              <li><Link href="/" className={footLink}>Marketplace</Link></li>
            </ul>
          </nav>
          <nav aria-label="Marketplace Modules">
            <h2 className="font-heading text-sm font-bold text-white">Marketplace Modules</h2>
            <ul className="mt-2">
              <li><Link href={searchHref({ kind: "SELL" })} className={footLink}>Buy & Sell</Link></li>
              <li><Link href={searchHref({ b2b: true })} className={footLink}>B2B Equipment</Link></li>
              <li><Link href={searchHref({ free: true })} className={footLink}>Give Away</Link></li>
              <li><Link href="/buyer-requests" className={footLink}>Wanted Items / Gigs</Link></li>
              <li><Link href="/post-listing" className={footLink}>Post a Listing</Link></li>
            </ul>
          </nav>
          <nav aria-label="Governance, Trust & Support">
            <h2 className="font-heading text-sm font-bold text-white">Governance, Trust & Support</h2>
            <ul className="mt-2">
              <li><Link href="/terms" className={footLink}>Terms & Disclaimer</Link></li>
              <li><Link href="/safe-trading" className={footLink}>Safe Trading Rules</Link></li>
              <li><Link href="/help" className={footLink}>Help Center</Link></li>
              <li><Link href="/contact" className={footLink}>Contact Support</Link></li>
            </ul>
          </nav>
          <nav aria-label="Regional Zones">
            <h2 className="font-heading text-sm font-bold text-white">Regional Zones</h2>
            <ul className="mt-2">
              {ZONES.map((z) => (
                <li key={z.slug}>
                  <Link href={searchHref({ zone: z.slug })} className={footLink}>{zoneLabel(z)}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <p className="mx-auto mt-8 max-w-6xl border-t border-white/15 pt-4 text-xs text-slate-400">
          {COPYRIGHT} | Creative Partner:{" "}
          {partner ? (
            <a href={partner} className="underline hover:text-white focus-visible:outline-white">{CREATIVE_PARTNER.name}</a>
          ) : (
            CREATIVE_PARTNER.name
          )}
        </p>
      </footer>
    </div>
  );
}

/** Page width and the h1 for the inner pages. */
export function MarketMain({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-10">
      <div className="motion-safe:animate-rise">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-bc-shell">{title}</h1>
        {intro && <p className="mt-2 max-w-[60ch] text-slate-600">{intro}</p>}
      </div>
      <div className="mt-6">{children}</div>
    </main>
  );
}
