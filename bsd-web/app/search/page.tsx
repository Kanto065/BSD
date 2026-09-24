import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, MapPin, Plus, Search } from "lucide-react";
import { ListingGrid } from "@/components/BusinessCard";
import { searchListings } from "@/lib/api";
import { ALL_ZONES_LABEL, CATEGORIES, ZONES, findCategory, findZone, zoneLabel } from "@/lib/content";

export const metadata: Metadata = {
  title: "Search the Directory",
  description: "Search Bangladeshi businesses, professionals and community services across SA1 to SA34 by keyword, zone and category.",
  alternates: { canonical: "/search" },
  // Search result pages are not useful in a search index.
  robots: { index: false, follow: true },
};

type Param = string | string[] | undefined;
type SearchParams = Promise<{ q?: Param; zone?: Param; category?: Param; page?: Param }>;

const one = (v: Param) => (Array.isArray(v) ? v[0] : v)?.trim().slice(0, 100) ?? "";

// Keyword, zone and category filter the real listings through the public API. The matching categories below are
// a quick way in and come from the static category list. Search text is never stored: the API call is not cached
// and the API strips query strings from its request logs.
export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const q = one(sp.q);
  const zone = findZone(one(sp.zone));
  const category = findCategory(one(sp.category));
  const pageNumber = Math.min(1000, Math.max(1, Number.parseInt(one(sp.page), 10) || 1));
  const needle = q.toLowerCase();

  const listings = await searchListings({ q, zone: zone?.slug, category: category?.slug, page: pageNumber });
  const pageData = listings.ok ? listings.data : null;
  const pageHref = (n: number) => {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (zone) qs.set("zone", zone.slug);
    if (category) qs.set("category", category.slug);
    if (n > 1) qs.set("page", String(n));
    const s = qs.toString();
    return s ? `/search?${s}` : "/search";
  };

  const pool = category ? [category] : CATEGORIES;
  const matches = needle
    ? pool
        .map((c) => {
          const nameHit = c.name.toLowerCase().includes(needle);
          const subs = c.subcategories.filter((s) => s.toLowerCase().includes(needle));
          return nameHit || subs.length > 0 ? { category: c, subs: nameHit ? [] : subs } : null;
        })
        .filter((m): m is { category: (typeof CATEGORIES)[number]; subs: string[] } => m !== null)
    : pool.map((c) => ({ category: c, subs: [] as string[] }));

  const hasFilter = Boolean(q || zone || category);

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold text-brand-navy">Search the Directory</h1>

      <form action="/search" method="GET" role="search" className="mt-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <div className="md:col-span-3">
          <label htmlFor="q" className="sr-only">
            What service are you looking for?
          </label>
          <input
            id="q"
            name="q"
            type="text"
            defaultValue={q}
            maxLength={100}
            placeholder="Search restaurants, solicitors, trades, accountants..."
            className="w-full rounded-md border border-slate-300 px-3 py-3 text-sm focus:border-brand-blue focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="zone" className="sr-only">
            Zone
          </label>
          <select
            id="zone"
            name="zone"
            defaultValue={zone?.slug ?? ""}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-3 text-sm focus:border-brand-blue focus:outline-none"
          >
            <option value="">{ALL_ZONES_LABEL}</option>
            {ZONES.map((z) => (
              <option key={z.slug} value={z.slug}>
                {zoneLabel(z)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="category" className="sr-only">
            Category
          </label>
          <select
            id="category"
            name="category"
            defaultValue={category?.slug ?? ""}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-3 text-sm focus:border-brand-blue focus:outline-none"
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-blue px-6 py-3 text-sm font-semibold text-white hover:bg-brand-navy"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          Search Directory
        </button>
      </form>

      {hasFilter && (
        <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
          {q && <span>Keyword: &quot;{q}&quot;</span>}
          {zone && (
            <Link href={`/${zone.slug}`} className="inline-flex items-center gap-1 font-medium text-brand-teal-dark hover:underline">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              {zoneLabel(zone)}
            </Link>
          )}
          {category && <span>Category: {category.name}</span>}
        </p>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-brand-navy">
          Businesses{pageData && pageData.total > 0 ? ` (${pageData.total})` : ""}
        </h2>
        {/* CLIENT-REVIEW: no copy was supplied for the search results page. */}
        <div className="mt-3">
          <ListingGrid
            result={listings}
            empty={
              <>
                {hasFilter
                  ? "No business listings match your search yet. Try a broader word or a different zone."
                  : "No business listings are available yet. Listings appear here once businesses have been submitted and approved."}
                <div className="mt-4">
                  <Link
                    href="/submit"
                    className="inline-flex items-center gap-2 rounded-md bg-green-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-800"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add Business Free
                  </Link>
                </div>
              </>
            }
          />
        </div>
        {pageData && pageData.totalPages > 1 && (
          <nav aria-label="Pagination" className="mt-6 flex items-center justify-between text-sm">
            {pageData.page > 1 ? (
              <Link href={pageHref(pageData.page - 1)} className="inline-flex items-center gap-1 font-semibold text-brand-teal-dark hover:underline">
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                Previous
              </Link>
            ) : (
              <span />
            )}
            <span className="text-slate-500">
              Page {pageData.page} of {pageData.totalPages}
            </span>
            {pageData.page < pageData.totalPages ? (
              <Link href={pageHref(pageData.page + 1)} className="inline-flex items-center gap-1 font-semibold text-brand-teal-dark hover:underline">
                Next
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-brand-navy">{needle ? "Matching categories" : "Browse by category"}</h2>
        {matches.length === 0 ? (
          <p className="mt-3 text-slate-600">No categories match &quot;{q}&quot;. Try a broader word, or browse all categories.</p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {matches.map(({ category: c, subs }) => (
              <Link
                key={c.slug}
                href={`/categories/${c.slug}`}
                className="rounded-lg border border-slate-200 p-4 transition hover:border-brand-teal hover:shadow-sm"
              >
                <c.icon className="h-6 w-6 text-brand-teal" aria-hidden="true" />
                <span className="mt-2 block font-semibold text-brand-navy">{c.name}</span>
                {subs.length > 0 && <span className="mt-1 block text-sm text-slate-500">{subs.join(", ")}</span>}
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
