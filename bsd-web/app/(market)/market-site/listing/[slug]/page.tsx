import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheck, MapPin, ShieldAlert } from "lucide-react";
import { MarketFrame } from "@/components/market/MarketFrame";
import Gallery from "@/components/market/Gallery";
import ListingActions from "@/components/market/ListingActions";
import { publicApiBase } from "@/lib/api";
import { HIDDEN_ADDRESS_NOTICE, SAFETY_WARNING, listingView, marketListing, whatsappLink } from "@/lib/market-api";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

// The layout already sets noindex. Only the title changes here.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const res = await marketListing((await params).slug);
  return { title: res.ok ? `${res.data.title} | BSD Marketplace` : "BSD Marketplace" };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const res = await marketListing(slug);
  if (!res.ok) {
    if (res.reason === "not_found") notFound();
    return (
      <MarketFrame>
        <main className="mx-auto max-w-3xl px-4 py-10"><p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-slate-600">This listing could not be loaded. Please try again shortly.</p></main>
      </MarketFrame>
    );
  }
  const l = res.data;
  const v = listingView(l);

  return (
    <MarketFrame>
      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[3fr_2fr]">
        <Gallery images={l.images} title={l.title} />
        <div className="space-y-5">
          <div>
            <p className="text-sm font-medium text-slate-600">{l.category.name}</p>
            <h1 className="mt-1 font-heading text-2xl font-bold text-bc-shell sm:text-3xl">{l.title}</h1>
            <p className="mt-3 flex flex-wrap items-center gap-2">
              {v.free ? (
                <span className="rounded-md bg-amber-100 px-3 py-1 text-xl font-bold text-amber-900 ring-1 ring-amber-300">FREE</span>
              ) : (
                <span className="text-2xl font-bold text-bc-shell">{v.price}</span>
              )}
              {v.showNegotiable && <span className="text-sm text-slate-600">Or nearest offer</span>}
            </p>
            {v.statusNote && <p role="status" className="mt-2 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-800">{v.statusNote}</p>}
          </div>

          <p className="flex items-center gap-1.5 text-sm text-slate-700"><MapPin className="h-4 w-4" aria-hidden="true" />{v.place}</p>
          {v.hiddenNotice && <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200">{HIDDEN_ADDRESS_NOTICE}</p>}
          {l.spot && <p className="text-sm text-slate-700">Safe meeting spot: <strong>{l.spot.name}</strong>, {l.spot.address}</p>}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {v.condition && (<><dt className="text-slate-600">Condition</dt><dd className="font-medium">{v.condition}</dd></>)}
            {v.b2b && (<><dt className="text-slate-600">VAT invoice</dt><dd className="font-medium">{v.b2b.vatInvoice ? "Available" : "Not offered"}</dd></>)}
            {v.b2b?.bulkTerms && (<><dt className="text-slate-600">Bulk terms</dt><dd className="font-medium">{v.b2b.bulkTerms}</dd></>)}
          </dl>

          {l.offerPassDiscount && (
            <p className="rounded-lg bg-teal-50 px-3 py-2 text-sm font-medium text-teal-900 ring-1 ring-teal-200">
              Offers a discount to Privilege Pass holders{l.passDiscountNote ? `: ${l.passDiscountNote}` : ""}
            </p>
          )}

          <section aria-labelledby="desc">
            <h2 id="desc" className="font-heading text-lg font-bold text-bc-shell">Description</h2>
            <p className="mt-1 whitespace-pre-line text-slate-800">{l.description}</p>
          </section>

          <section aria-labelledby="seller" className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 id="seller" className="font-heading text-lg font-bold text-bc-shell">Seller</h2>
            {v.verifiedBusiness ? (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 text-sm font-medium text-sky-900 ring-1 ring-sky-200">
                <BadgeCheck className="h-4 w-4" aria-hidden="true" />BSD Verified Business: {v.verifiedBusiness.name}
              </p>
            ) : (
              <p className="mt-2 text-sm text-slate-700">Community member</p>
            )}
          </section>

          <ListingActions apiBase={publicApiBase()} slug={l.slug} title={l.title} whatsappHref={whatsappLink(l)} canContact={v.contactOpen} />

          <p className="flex gap-2 rounded-xl bg-amber-50 p-4 text-sm text-amber-950 ring-1 ring-amber-200">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            {SAFETY_WARNING}
          </p>
        </div>
      </main>
    </MarketFrame>
  );
}
