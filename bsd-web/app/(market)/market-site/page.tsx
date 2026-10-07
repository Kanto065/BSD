import Link from "next/link";
import { ArrowRight, Gift, Search, Store, Tag, Wrench } from "lucide-react";
import { MarketFrame } from "@/components/market/MarketFrame";
import { ListingGrid } from "@/components/market/ListingCard";
import ZoneSelect from "@/components/ZoneSelect";
import { ZONES, zoneShortLabel } from "@/lib/content";
import { B2B_BANNER, BUYER_DEMAND, FALLBACK_CATEGORIES, HERO_SUBTITLE, marketCategories, marketListings, searchHref } from "@/lib/market-api";

// Rendered per request: listings change all the time and the API is never called while building.
export const dynamic = "force-dynamic";

const QUICK = [
  { href: "/post-listing", label: "Sell Item", Icon: Tag },
  { href: searchHref({ free: true }), label: "Give Away", Icon: Gift },
  { href: searchHref({ kind: "SERVICE" }), label: "Services", Icon: Wrench },
  { href: searchHref({ b2b: true }), label: "B2B Equipment", Icon: Store },
];

export default async function Page() {
  const [cats, latest] = await Promise.all([marketCategories(), marketListings({})]);
  // The grid hides staged categories (the API only returns the live ones). Fall back to the fixed list if the API is down.
  const categories = cats.ok && cats.data.categories.length ? cats.data.categories : FALLBACK_CATEGORIES;
  const items = latest.ok ? latest.data.items.slice(0, 8) : [];

  return (
    <MarketFrame>
      <main>
        <section className="bg-bc-shell px-4 py-12 text-white sm:py-16">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-5xl">BSD Marketplace</h1>
            <p className="mx-auto mt-3 max-w-[50ch] text-slate-200">{HERO_SUBTITLE}</p>
            <form action="/search" method="get" role="search" className="mt-6 flex flex-col gap-2 sm:flex-row">
              <label htmlFor="mq" className="sr-only">Search the Marketplace</label>
              <input id="mq" name="q" type="search" maxLength={100} placeholder="What are you looking for?" className="min-h-12 flex-1 rounded-full px-5 text-base text-slate-900" />
              <label htmlFor="mz" className="sr-only">Zone</label>
              <ZoneSelect id="mz" name="zone" className="min-h-12 rounded-full px-4 text-base text-slate-900" />
              <button type="submit" className="press inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-bc-bar px-6 text-base font-semibold text-white hover:bg-sky-700">
                <Search className="h-5 w-5" aria-hidden="true" />
                Search
              </button>
            </form>
          </div>
        </section>

        <div className="mx-auto max-w-6xl space-y-10 px-4 py-8">
          <ul role="list" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {QUICK.map(({ href, label, Icon }) => (
              <li key={label}>
                <Link href={href} className="card-lift flex min-h-14 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-bc-shell">
                  <Icon className="h-5 w-5 text-bc-bar" aria-hidden="true" />
                  {label}
                </Link>
              </li>
            ))}
          </ul>

          <nav aria-label="Zones" className="flex flex-wrap gap-2">
            {ZONES.map((z) => (
              <Link key={z.slug} href={searchHref({ zone: z.slug })} className="inline-flex min-h-11 items-center rounded-full border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 hover:border-bc-bar">
                {zoneShortLabel(z)}
              </Link>
            ))}
          </nav>

          <Link href={searchHref({ b2b: true })} className="flex min-h-14 items-center justify-between gap-3 rounded-xl bg-sky-50 px-5 py-3 text-sm font-medium text-sky-950 ring-1 ring-sky-200 hover:bg-sky-100">
            <span>{B2B_BANNER}</span>
            <ArrowRight className="h-5 w-5 shrink-0" aria-hidden="true" />
          </Link>

          <section aria-labelledby="cats">
            <h2 id="cats" className="font-heading text-xl font-bold text-bc-shell">Browse by Category</h2>
            <ul role="list" className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link href={searchHref({ category: c.slug })} className="card-lift flex min-h-16 items-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900">
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="latest">
            <div className="flex items-end justify-between gap-3">
              <h2 id="latest" className="font-heading text-xl font-bold text-bc-shell">Featured Items</h2>
              <Link href="/search" className="inline-flex min-h-11 items-center text-sm font-semibold text-bc-bar hover:underline">View all</Link>
            </div>
            {items.length ? (
              <div className="mt-3"><ListingGrid items={items} /></div>
            ) : (
              <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-slate-600">
                {latest.ok ? "No listings yet. Be the first to post one." : "Listings could not be loaded. Please try again shortly."}
              </p>
            )}
          </section>

          <section className="rounded-2xl bg-bc-shell p-6 text-white sm:p-8">
            <h2 className="font-heading text-2xl font-bold">{BUYER_DEMAND.title}</h2>
            <p className="mt-2 max-w-[55ch] text-slate-200">{BUYER_DEMAND.text}</p>
            <Link href="/buyer-requests" className="press mt-4 inline-flex min-h-11 items-center rounded-full bg-white px-6 text-base font-semibold text-bc-shell hover:bg-slate-100">
              View Wanted Board
            </Link>
          </section>
        </div>
      </main>
    </MarketFrame>
  );
}
