import Link from "next/link";
import { CREATIVE_PARTNER, SUPPORT_EMAIL, creativePartnerHref } from "@/lib/content";
import { COPYRIGHT } from "@/lib/market-api";
import { PUBLIC_LABELS as T, SITE_NAV as N } from "@/lib/pass-site-labels";
import { SITES } from "@/lib/site";

// Header, banner and footer for the public Pass pages. Server rendered, every child here is plain markup. The pass
// itself (PassPage) keeps its own dark shell.

const link = "inline-flex min-h-11 items-center rounded-md px-1.5 text-sm font-medium text-slate-700 hover:text-teal-700 sm:px-2";
const footLink = "inline-flex min-h-11 items-center text-sm text-slate-300 hover:text-white focus-visible:outline-white";

export function CardFrame({ children, banner = true }: { children: React.ReactNode; banner?: boolean }) {
  const partner = creativePartnerHref();
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-bc-canvas">
      <div className="bg-bc-shell px-4 text-xs text-slate-200">
        <div className="mx-auto flex min-h-9 max-w-6xl flex-wrap items-center justify-between gap-x-6 py-1.5">
          <p>{T.utilityNote}</p>
          <p className="flex gap-4">
            <a href={SITES.bsd.origin} className="hover:text-white focus-visible:outline-white">bsd.wales</a>
            <a href={SITES.market.origin} className="hover:text-white focus-visible:outline-white">marketplace.bsd.wales</a>
          </p>
        </div>
      </div>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 px-4 py-2">
          <Link href="/" className="flex min-h-11 items-center gap-2 font-heading text-base font-bold text-bc-shell">
            <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700 text-sm text-white">P</span>
            {SITES.card.name}
          </Link>
          <nav aria-label="Privilege Pass" className="flex flex-wrap items-center">
            <Link href="/how-it-works" className={link}>{N.howItWorks}</Link>
            <Link href="/partners" className={link}>{N.partners}</Link>
            <Link href="/calculator" className={link}>{N.calculator}</Link>
            <Link href="/merchants" className={link}>{N.merchants}</Link>
            <Link href="/faq" className={link}>{N.faq}</Link>
          </nav>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      {banner && (
        <section aria-label={T.bannerTitle} className="bg-teal-700 px-4 py-10 text-center text-white">
          <h2 className="font-heading text-2xl font-bold">{T.bannerTitle}</h2>
          <p className="mx-auto mt-2 max-w-[50ch] text-teal-50">{T.bannerBody}</p>
          <Link href="/" className="mt-5 inline-flex min-h-11 items-center rounded-full bg-white px-6 text-sm font-semibold text-teal-800 hover:bg-teal-50">
            {T.bannerCta}
          </Link>
        </section>
      )}
      <footer className="bg-bc-shell px-4 py-10 text-slate-300">
        <div className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <nav aria-label={T.ecosystem}>
            <h2 className="font-heading text-sm font-bold text-white">{T.ecosystem}</h2>
            <ul className="mt-2">
              <li><a href={SITES.bsd.origin} className={footLink}>BSD Directory</a></li>
              <li><Link href="/" className={footLink}>Privilege Pass</Link></li>
              <li><a href={SITES.market.origin} className={footLink}>Marketplace</a></li>
            </ul>
          </nav>
          <nav aria-label={T.passColumn}>
            <h2 className="font-heading text-sm font-bold text-white">{T.passColumn}</h2>
            <ul className="mt-2">
              <li><Link href="/how-it-works" className={footLink}>{N.howItWorks}</Link></li>
              <li><Link href="/partners" className={footLink}>{N.partners}</Link></li>
              <li><Link href="/calculator" className={footLink}>{N.calculator}</Link></li>
              <li><Link href="/faq" className={footLink}>{N.faq}</Link></li>
            </ul>
          </nav>
          <nav aria-label={T.merchantColumn}>
            <h2 className="font-heading text-sm font-bold text-white">{T.merchantColumn}</h2>
            <ul className="mt-2">
              <li><Link href="/merchants" className={footLink}>{N.merchants}</Link></li>
              <li><Link href="/verify" className={footLink}>{T.merchantScanner}</Link></li>
              <li><a href={`${SITES.bsd.origin}/submit`} className={footLink}>{T.merchantRegister}</a></li>
            </ul>
          </nav>
          <nav aria-label={T.supportColumn}>
            <h2 className="font-heading text-sm font-bold text-white">{T.supportColumn}</h2>
            <ul className="mt-2">
              <li><Link href="/contact" className={footLink}>{N.contact}</Link></li>
              <li><a href={`mailto:${SUPPORT_EMAIL}`} className={footLink}>{SUPPORT_EMAIL}</a></li>
            </ul>
          </nav>
        </div>
        <p className="mx-auto mt-8 max-w-6xl border-t border-white/15 pt-4 text-xs text-slate-400">
          {COPYRIGHT} | Creative Partner:{" "}
          {partner ? <a href={partner} className="underline hover:text-white focus-visible:outline-white">{CREATIVE_PARTNER.name}</a> : CREATIVE_PARTNER.name}
        </p>
      </footer>
    </div>
  );
}

/** Page width and the h1 for the inner pages. */
export function CardMain({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-10">
      <div className="motion-safe:animate-rise">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-bc-shell">{title}</h1>
        {intro && <p className="mt-2 max-w-[60ch] text-slate-600">{intro}</p>}
      </div>
      <div className="mt-6">{children}</div>
    </main>
  );
}
