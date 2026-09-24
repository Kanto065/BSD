import type { Metadata } from "next";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { ArrowLink } from "@/components/ArrowLink";
import { ZONES } from "@/lib/content";

export const metadata: Metadata = {
  title: "Coverage Area",
  description:
    "BSD covers the complete SA postcode area, SA1 to SA34, organised into three zones: Greater Swansea & Gower, Neath Port Talbot & Swansea Valley, and Carmarthenshire & West Wales.",
  alternates: { canonical: "/coverage-area" },
};

export default function CoverageAreaPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold text-brand-navy">Coverage Area</h1>
      <p className="mt-4 text-slate-600">
        BSD covers the Swansea Bay region and South West Wales across postcodes SA1 to SA34, organised into three
        operational zones.
      </p>

      <div className="mt-10 space-y-8">
        {ZONES.map((z) => (
          <section key={z.slug} className="rounded-xl border border-slate-200 p-6">
            <h2 className="text-xl font-bold text-brand-navy">
              <Link href={`/${z.slug}`} className="hover:text-brand-blue hover:underline">
                Zone {z.number}: {z.name}
              </Link>
            </h2>
            <p className="mt-1 text-sm font-semibold text-brand-teal-dark">Postcodes {z.postcodeLabel}</p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {z.localities.map((l) => (
                <li
                  key={l}
                  className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1 text-sm text-slate-700"
                >
                  <MapPin className="h-3.5 w-3.5 text-brand-teal" aria-hidden="true" />
                  {l}
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <ArrowLink href={`/${z.slug}`} className="text-sm">
                Browse Zone {z.number}
              </ArrowLink>
            </div>
          </section>
        ))}
      </div>

      <p className="mt-8 text-slate-600">Additional nearby areas may be included as the directory expands.</p>

      {/* The homepage "View Verified Info" step sends visitors to this page, so it carries a short summary. */}
      <section className="mt-10 rounded-xl bg-slate-50 p-6">
        <h2 className="text-lg font-semibold text-brand-navy">Verified information</h2>
        <p className="mt-2 text-slate-600">
          Every entry goes through a 3-tier community verification check, and the badge on each listing shows how far
          along that check is.
        </p>
        <div className="mt-3">
          <ArrowLink href="/verification-policy">Read the Verification Policy</ArrowLink>
        </div>
      </section>
    </div>
  );
}
