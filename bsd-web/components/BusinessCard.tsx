import Link from "next/link";
import { MapPin, Phone } from "lucide-react";
import VerificationBadge from "@/components/VerificationBadge";
import { ArrowLink } from "@/components/ArrowLink";
import type { ApiResult, Page, PublicListItem } from "@/lib/api";

export function locationLine(b: Pick<PublicListItem, "postcode" | "postcodeDistrict" | "localities">): string {
  const where = b.localities.map((l) => l.name).join(", ");
  const code = b.postcode ?? b.postcodeDistrict;
  return where ? `${code} (${where})` : code;
}

export default function BusinessCard({ business: b }: { business: PublicListItem }) {
  return (
    <article className="flex flex-col rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        {b.logoUrl ? (
          // Owner supplied logo. Plain img on purpose: the host is our own uploads, and it is small.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={b.logoUrl} alt="" loading="lazy" className="h-12 w-12 rounded-md border border-slate-200 object-contain" />
        ) : null}
        <VerificationBadge status={b.verificationStatus} size="sm" className={b.logoUrl ? "ml-auto" : ""} />
      </div>
      <h3 className="mt-3 text-lg font-bold text-brand-navy">
        <Link href={`/businesses/${b.slug}`} className="hover:text-brand-blue hover:underline">
          {b.name}
        </Link>
      </h3>
      <p className="mt-1 text-sm font-medium text-brand-teal-dark">
        {b.category.name}
        {b.subcategory ? ` · ${b.subcategory.name}` : ""}
      </p>
      <p className="mt-2 flex items-start gap-1.5 text-sm text-slate-600">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        {locationLine(b)}
      </p>
      <p className="mt-2 flex-1 text-sm text-slate-600">{b.summary}</p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <a href={`tel:${b.phone.replace(/\s+/g, "")}`} className="-my-2 inline-flex items-center gap-1.5 py-2 text-sm font-semibold text-brand-navy hover:text-brand-blue">
          <Phone className="h-4 w-4" aria-hidden="true" />
          {b.phone}
        </a>
        <ArrowLink href={`/businesses/${b.slug}`} className="text-sm">
          View Full Profile
        </ArrowLink>
      </div>
    </article>
  );
}

/**
 * A grid of listings with the three honest states: results, nothing yet, and the API being unavailable.
 * "build" (the API was skipped while the site was building) reads as "nothing yet".
 */
export function ListingGrid({
  result,
  empty,
  columns = "sm:grid-cols-2 lg:grid-cols-3",
}: {
  result: ApiResult<Page<PublicListItem>>;
  empty: React.ReactNode;
  columns?: string;
}) {
  if (!result.ok && result.reason === "unavailable") {
    return (
      <div role="status" className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
        Listings are temporarily unavailable. Please try again in a few minutes.
      </div>
    );
  }
  if (!result.ok || result.data.items.length === 0) {
    return <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">{empty}</div>;
  }
  return (
    <div className={`grid gap-4 ${columns}`}>
      {result.data.items.map((b) => (
        <BusinessCard key={b.slug} business={b} />
      ))}
    </div>
  );
}
