import Link from "next/link";
import type { Metadata } from "next";
import { MapPin, Plus } from "lucide-react";
import { ArrowLink } from "@/components/ArrowLink";
import { ZONES, type Zone } from "@/lib/content";

export function zoneMetadata(zone: Zone): Metadata {
  const title = `Zone ${zone.number}: ${zone.name}`;
  return {
    title,
    description: `Bangladeshi businesses and services in ${zone.name} (postcodes ${zone.postcodeLabel}), listed on the BSD community directory.`,
    alternates: { canonical: `/${zone.slug}` },
  };
}

// CLIENT-REVIEW: the client supplied only the postcode districts and locality names for each zone. The
// short introduction and the empty listing state are our own neutral wording.
export default function ZonePage({ zone }: { zone: Zone }) {
  const others = ZONES.filter((z) => z.slug !== zone.slug);

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <p className="text-sm font-semibold uppercase tracking-wide text-brand-teal-dark">Zone {zone.number}</p>
      <h1 className="mt-1 text-3xl font-bold text-brand-navy">{zone.name}</h1>
      <p className="mt-4 text-slate-600">
        Bangladeshi businesses, professionals and community services across {zone.name}, covering postcode districts{" "}
        {zone.postcodeLabel}.
      </p>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-brand-navy">Postcodes</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {zone.districts.map((d) => (
            <li key={d} className="rounded-md bg-brand-navy px-3 py-1 text-sm font-semibold text-white">
              {d}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-brand-navy">Key Coverage Areas</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {zone.localities.map((l) => (
            <li
              key={l}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-700"
            >
              <MapPin className="h-3.5 w-3.5 text-brand-teal" aria-hidden="true" />
              {l}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold text-brand-navy">Businesses in this zone</h2>
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
          Listings in {zone.name} will appear here once businesses are submitted and approved.
        </div>
        <div className="mt-6 text-center">
          <Link
            href="/submit"
            className="inline-flex items-center gap-2 rounded-md bg-green-700 px-6 py-3 font-semibold text-white hover:bg-green-800"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Business Free
          </Link>
        </div>
      </section>

      <nav aria-label="Other zones" className="mt-12 flex flex-wrap gap-x-6 gap-y-2 border-t border-slate-200 pt-6 text-sm">
        {others.map((z) => (
          <ArrowLink key={z.slug} href={`/${z.slug}`}>
            Zone {z.number}: {z.name}
          </ArrowLink>
        ))}
        <ArrowLink href="/categories">Browse by category</ArrowLink>
      </nav>
    </div>
  );
}
