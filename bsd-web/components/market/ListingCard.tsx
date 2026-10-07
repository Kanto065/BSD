import Link from "next/link";
import { BadgeCheck, ImageOff, MapPin } from "lucide-react";
import { mediaUrl, placeLabel, priceLabel, type MarketListItem } from "@/lib/market-api";

// One product card: 4:3 image, title (2 lines), price or gold FREE badge, area tag, trust and discount badges.
// A hidden address listing shows only its area label. No counters or tracking.

export default function ListingCard({ item }: { item: MarketListItem }) {
  const price = priceLabel(item);
  return (
    <li className="motion-safe:animate-rise">
      <Link
        href={`/listing/${item.slug}`}
        className="card-lift group flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white"
      >
        <div className="relative aspect-[4/3] bg-slate-100">
          {item.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl(item.image.thumbUrl)} alt="" loading="lazy" width={item.image.width} height={item.image.height} className="h-full w-full object-cover" />
          ) : (
            <div aria-hidden="true" className="flex h-full items-center justify-center text-slate-400">
              <ImageOff className="h-8 w-8" />
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2 p-3">
          <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-slate-900 group-hover:text-bc-bar">{item.title}</h3>
          <p className="flex flex-wrap items-center gap-2">
            {item.free ? (
              <span className="rounded-md bg-amber-100 px-2 py-0.5 text-sm font-bold text-amber-900 ring-1 ring-amber-300">FREE</span>
            ) : (
              <span className="text-base font-bold text-bc-shell">{price}</span>
            )}
            {item.negotiable && !item.free && <span className="text-xs text-slate-600">ONO</span>}
          </p>
          <p className="flex items-center gap-1 text-xs text-slate-600">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {placeLabel(item)}
          </p>
          <p className="mt-auto flex flex-wrap gap-1.5 pt-1 text-xs font-medium">
            {item.verifiedBusiness && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-sky-900 ring-1 ring-sky-200">
                <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                BSD Verified Business
              </span>
            )}
          </p>
        </div>
      </Link>
    </li>
  );
}

export function ListingGrid({ items }: { items: MarketListItem[] }) {
  return (
    <ul role="list" className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
      {items.map((i) => (
        <ListingCard key={i.slug} item={i} />
      ))}
    </ul>
  );
}

