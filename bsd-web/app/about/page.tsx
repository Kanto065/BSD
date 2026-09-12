import type { Metadata } from "next";
import { ArrowLink } from "@/components/ArrowLink";
import { COVERAGE_AREAS } from "@/lib/content";

export const metadata: Metadata = {
  title: "About BSD",
  description:
    "BSD is a free, community-driven directory connecting Bangladeshi businesses, service providers and independent professionals across Swansea Bay, operated under BayConnect.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold text-slate-900">About the Directory</h1>

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-slate-900">Full Introduction</h2>
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
        <h2 className="text-xl font-semibold text-slate-900">Purpose</h2>
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
        <h2 className="text-xl font-semibold text-slate-900">Vision</h2>
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
        <h2 className="text-xl font-semibold text-slate-900">Community Initiative</h2>
        <p className="mt-3 text-slate-600">
          BSD is currently operated as a free community initiative, created and maintained voluntarily for the
          benefit of the Bangladeshi community. <strong>Free Access Period:</strong> Until 30 June 2027 — all
          listings are completely free. During this period: no listing fees, no sponsorships, no advertisements, no
          paid promotions, no premium charges. Everything is provided free of cost to support community growth and
          accessibility.
        </p>
        <h3 className="mt-4 font-semibold text-slate-800">Independent Professionals Inclusion</h3>
        <p className="mt-2 text-slate-600">
          BSD proudly includes a dedicated category for individuals who provide essential services without a
          physical office: Independent Professionals. This includes electricians, plumbers, tutors, beauticians,
          barbers, photographers, decorators, translators, driving instructors, home-based caterers, mechanics,
          tailors, IT helpers, and other skilled individuals. This ensures that every valuable service provider in
          the community receives equal recognition.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-slate-900">Coverage Area</h2>
        <p className="mt-3 text-slate-600">BSD covers the wider Swansea Bay region, including:</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {COVERAGE_AREAS.map((a) => (
            <span key={a} className="rounded-full bg-teal/10 px-4 py-1 text-sm font-medium text-teal">
              {a}
            </span>
          ))}
        </div>
        <p className="mt-3 text-sm text-slate-500">Additional nearby areas may be included as the directory expands.</p>
      </section>

      <section id="powered-by-bayconnect" className="mt-10 scroll-mt-24">
        <h2 className="text-xl font-semibold text-slate-900">Powered By BayConnect</h2>
        <p className="mt-3 text-slate-600">
          BSD is operated under BayConnect, a community ecosystem dedicated to connecting, celebrating, and
          empowering the Bangladeshi community in Swansea Bay.
        </p>
        <p className="mt-2 font-medium text-slate-800">BayConnect — Connect. Celebrate. Empower.</p>
      </section>

      <div className="mt-12 text-center">
        <ArrowLink href="/transparency" className="justify-center">
          Read the Transparency Statement
        </ArrowLink>
      </div>
    </div>
  );
}
