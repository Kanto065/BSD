import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLink } from "@/components/ArrowLink";
import { ZONES } from "@/lib/content";

export const metadata: Metadata = {
  title: "About BSD",
  description:
    "BSD is a free, community-driven directory connecting Bangladeshi businesses, service providers and independent professionals across Swansea Bay, operated under BayConnect.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold text-brand-navy">About the Directory</h1>

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-brand-navy">1. Full Introduction</h2>
        <p className="mt-3 text-slate-600">
          BSD – Bangladeshi Business & Service Directory (Swansea Bay Edition) is a unified information platform
          designed to highlight and connect Bangladeshi businesses, service providers, professionals, and
          independent skilled individuals across the Swansea Bay region. Its purpose is to make essential community
          services easy to find, easy to access, and easy to trust — both in print and digital formats.
        </p>
        <p className="mt-3 text-slate-600">
          BSD operates as a community-driven initiative under the BayConnect ecosystem, ensuring that every listing
          is accessible to all members of the community without any cost.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-brand-navy">2. Purpose</h2>
        <p className="mt-3 text-slate-600">The core purpose of BSD is to:</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-600">
          <li>Provide visibility to local Bangladeshi businesses</li>
          <li>Support new and emerging entrepreneurs</li>
          <li>Connect community members with trusted service providers</li>
          <li>Offer a reliable, centralised directory for essential services</li>
          <li>Assist students, families, newcomers, and visitors</li>
          <li>Include Independent Professionals who offer valuable services without a physical office</li>
          <li>Build a sustainable, modern, digital-friendly directory for long-term community benefit</li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-brand-navy">3. Vision</h2>
        <p className="mt-3 text-slate-600">BSD’s long-term vision is to:</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-600">
          <li>Become the central business and service hub for the Bangladeshi community in Swansea Bay</li>
          <li>Strengthen community economic growth</li>
          <li>Provide equal visibility to both businesses and independent service providers</li>
          <li>Expand into a fully digital platform and mobile app</li>
          <li>Introduce premium listings and sponsored categories in future phases</li>
          <li>Publish an annual printed directory</li>
          <li>Extend coverage beyond Swansea Bay as the community grows</li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-brand-navy">4. Community Initiative</h2>
        {/* CLIENT-REVIEW (L3): "no sponsorships" became "no website sponsorships" so this stays consistent with
            print edition sponsorship being allowed. */}
        <p className="mt-3 text-slate-600">
          BSD is currently operated as a free community initiative, created and maintained voluntarily for the
          benefit of the Bangladeshi community.
        </p>
        <p className="mt-3 font-semibold text-slate-800">Free Access Period:</p>
        <p className="mt-1 text-slate-600">Until 30 June 2027 — all listings are completely free.</p>
        <p className="mt-3 text-slate-600">During this period:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-600">
          <li>No listing fees</li>
          <li>No website sponsorships</li>
          <li>No advertisements</li>
          <li>No paid promotions</li>
          <li>No premium charges</li>
        </ul>
        <p className="mt-3 text-slate-600">
          Everything is provided free of cost to support community growth and accessibility.
        </p>
        <h3 className="mt-6 font-semibold text-slate-800">Independent Professionals Inclusion</h3>
        <p className="mt-2 text-slate-600">
          BSD proudly includes a dedicated category for individuals who provide essential services without a
          physical office:
        </p>
        <p className="mt-2 font-semibold text-slate-800">Independent Professionals</p>
        <p className="mt-1 text-slate-600">
          This includes: Electricians, plumbers, tutors, beauticians, barbers, photographers, decorators, translators,
          driving instructors, home-based caterers, mechanics, tailors, IT helpers, and other skilled individuals.
        </p>
        <p className="mt-2 text-slate-600">
          This ensures that every valuable service provider in the community receives equal recognition.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-brand-navy">5. Coverage Area</h2>
        <p className="mt-3 text-slate-600">
          BSD covers the Swansea Bay region and South West Wales across postcodes SA1 to SA34, organised into three
          zones:
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {ZONES.map((z) => (
            <Link
              key={z.slug}
              href={`/${z.slug}`}
              className="rounded-full bg-brand-teal/10 px-4 py-1 text-sm font-medium text-brand-teal-dark hover:bg-brand-teal/20"
            >
              Zone {z.number}: {z.name} ({z.postcodeLabel})
            </Link>
          ))}
        </div>
        <p className="mt-3 text-sm text-slate-500">Additional nearby areas may be included as the directory expands.</p>
      </section>

      <section id="powered-by-bayconnect" className="mt-10 scroll-mt-24">
        <h2 className="text-xl font-semibold text-brand-navy">6. Powered By BayConnect</h2>
        <p className="mt-3 text-slate-600">
          BSD is operated under BayConnect, a community ecosystem dedicated to connecting, celebrating, and
          empowering the Bangladeshi community in Swansea Bay.
        </p>
        <p className="mt-2 font-medium text-slate-800">BayConnect — Connect. Celebrate. Empower.</p>
      </section>

      <section className="mt-10 rounded-lg bg-slate-50 p-6">
        <h2 className="text-xl font-semibold text-brand-navy">One-Paragraph Summary</h2>
        <p className="mt-3 text-slate-600">
          BSD – Bangladeshi Business & Service Directory (Swansea Bay Edition) is a trusted community initiative
          designed to connect local Bangladeshi businesses, service providers, and independent professionals under one
          unified platform. Free until 30 June 2027, BSD aims to make essential services easy to find and accessible for
          everyone. Operated under the BayConnect ecosystem, BSD supports economic growth, community visibility, and
          long-term digital development, with plans for premium services, annual printed editions, and future
          expansion.
        </p>
      </section>

      <div className="mt-12 text-center">
        {/* CLIENT-REVIEW: the v1 CTA pointed at the Transparency Statement page, which is retired in favour of
            /financial-transparency (no copy yet). It now points at the Free Access Policy, which covers the same
            ground. */}
        <ArrowLink href="/free-access" className="justify-center">
          Read the Free Access Policy
        </ArrowLink>
      </div>
    </div>
  );
}
