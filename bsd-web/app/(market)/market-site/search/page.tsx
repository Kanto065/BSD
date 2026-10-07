import type { Metadata } from "next";
import { MarketFrame, MarketMain } from "@/components/market/MarketFrame";
import { ListingGrid } from "@/components/market/ListingCard";
import Pager from "@/components/market/Pager";
import ZoneSelect from "@/components/ZoneSelect";
import { KIND_OPTIONS, marketCategories, marketListings, searchHref } from "@/lib/market-api";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Browse | BSD Marketplace" };

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
const field = "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base";

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const f = { q: one(sp.q), kind: one(sp.kind), category: one(sp.category), zone: one(sp.zone), free: one(sp.free) === "true", b2b: one(sp.b2b) === "true" };
  const page = Math.max(1, Math.min(1000, parseInt(one(sp.page) ?? "1", 10) || 1));
  const [cats, res] = await Promise.all([
    marketCategories(),
    marketListings({ q: f.q, kind: f.kind, category: f.category, zone: f.zone, free: f.free ? "true" : undefined, b2b: f.b2b ? "true" : undefined, page: String(page) }),
  ]);
  const categories = cats.ok ? cats.data.categories : [];

  return (
    <MarketFrame>
      <MarketMain title="Browse the Marketplace">
        <form action="/search" method="get" role="search" className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-4">
            <label htmlFor="q" className="text-sm font-medium text-slate-800">Search</label>
            <input id="q" name="q" type="search" maxLength={100} defaultValue={f.q ?? ""} className={field} />
          </div>
          <div>
            <label htmlFor="kind" className="text-sm font-medium text-slate-800">Type</label>
            <select id="kind" name="kind" defaultValue={f.kind ?? ""} className={field}>
              <option value="">All types</option>
              {KIND_OPTIONS.map((k) => <option key={k.kind} value={k.kind}>{k.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="category" className="text-sm font-medium text-slate-800">Category</label>
            <select id="category" name="category" defaultValue={f.category ?? ""} className={field}>
              <option value="">All categories</option>
              {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="zone" className="text-sm font-medium text-slate-800">Zone</label>
            <ZoneSelect id="zone" name="zone" defaultValue={f.zone ?? ""} className={field} />
          </div>
          <fieldset className="flex flex-wrap items-end gap-x-5">
            <legend className="sr-only">Filters</legend>
            <label className="inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-2 text-sm"><input type="checkbox" name="free" value="true" defaultChecked={f.free} className="h-5 w-5" />Free only</label>
            <label className="inline-flex min-h-11 min-w-11 cursor-pointer items-center gap-2 text-sm"><input type="checkbox" name="b2b" value="true" defaultChecked={f.b2b} className="h-5 w-5" />B2B only</label>
          </fieldset>
          <button type="submit" className="press min-h-11 rounded-full bg-bc-bar px-6 text-base font-semibold text-white hover:bg-bc-shell sm:col-span-2 lg:col-span-4 lg:w-fit">Search</button>
        </form>

        <div className="mt-6" aria-live="polite">
          {!res.ok ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-slate-600">Listings could not be loaded. Please try again shortly.</p>
          ) : res.data.items.length === 0 ? (
            <>
              <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-slate-600">No listings match your search.</p>
              {page > 1 && <Pager page={page} pageSize={res.data.pageSize} total={Math.max(res.data.total, page * res.data.pageSize)} href={(p) => searchHref({ ...f, page: p })} />}
            </>
          ) : (
            <>
              <p className="mb-3 text-sm text-slate-600">{res.data.total} {res.data.total === 1 ? "listing" : "listings"}</p>
              <ListingGrid items={res.data.items} />
              <Pager page={res.data.page} pageSize={res.data.pageSize} total={res.data.total} href={(p) => searchHref({ ...f, page: p })} />
            </>
          )}
        </div>
      </MarketMain>
    </MarketFrame>
  );
}
