import type { Metadata } from "next";
import Link from "next/link";
import { MarketFrame, MarketMain } from "@/components/market/MarketFrame";
import { ListingGrid } from "@/components/market/ListingCard";
import Pager from "@/components/market/Pager";
import { WANTED_BOARD, marketListings } from "@/lib/market-api";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Wanted Board | BSD Marketplace" };

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Math.min(1000, parseInt(sp.page ?? "1", 10) || 1));
  const res = await marketListings({ kind: "BUY", page: String(page) });
  return (
    <MarketFrame>
      <MarketMain title={WANTED_BOARD.title} intro={WANTED_BOARD.text}>
        <Link href="/post-listing" className="press inline-flex min-h-11 items-center rounded-full bg-bc-bar px-6 text-base font-semibold text-white hover:bg-bc-shell">Post a Buy Request</Link>
        <div className="mt-6" aria-live="polite">
          {!res.ok ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-slate-600">Requests could not be loaded. Please try again shortly.</p>
          ) : res.data.items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-slate-600">No requests yet.</p>
          ) : (
            <>
              <ListingGrid items={res.data.items} />
              <Pager page={res.data.page} pageSize={res.data.pageSize} total={res.data.total} href={(p) => (p > 1 ? `/buyer-requests?page=${p}` : "/buyer-requests")} />
            </>
          )}
        </div>
      </MarketMain>
    </MarketFrame>
  );
}
