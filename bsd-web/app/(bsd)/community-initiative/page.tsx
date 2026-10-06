import type { Metadata } from "next";
import Link from "next/link";
import { Globe, Mail } from "lucide-react";
import { EMAILS } from "@/lib/content";

export const metadata: Metadata = {
  title: { absolute: "Our Community Initiative | BSD Wales" },
  description:
    "BSD is a community-led, volunteer-driven initiative helping local Bangladeshi entrepreneurs, professionals and community organisations across the Swansea Bay Region and South West Wales.",
  alternates: { canonical: "/community-initiative" },
};

// Copy is verbatim from the client's "Community Initiative Page" doc.
export default function CommunityInitiativePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold text-brand-navy">Empowering Local Businesses, Connecting Communities</h1>
      <p className="mt-4 text-slate-600">
        The Bangladeshi Business & Service Directory (BSD) is a community-led, volunteer-driven initiative designed
        to bridge the digital gap for local Bangladeshi entrepreneurs, professionals, and community organizations
        across the Swansea Bay Region and South West Wales.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-brand-navy">Why We Started BSD</h2>
        <p className="mt-3 text-slate-600">
          The Bangladeshi community has long been a vital pillar of South West Wales&apos;s economy and social
          fabric—from renowned restaurants and takeaways to solicitors, accountants, healthcare professionals,
          skilled tradespeople, and cultural organizations.
        </p>
        <p className="mt-3 text-slate-600">
          However, many established and emerging businesses lacked a single, unified digital platform and printed
          directory that brought all these services together under one trusted umbrella. BSD was founded to solve
          this challenge.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-brand-navy">Core Objectives of the Initiative</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-600">
          <li>
            <strong>Visibility & Digital Empowerment:</strong> Providing every local business with a professional web
            presence on bsd.wales and inclusion in our annual print edition.
          </li>
          <li>
            <strong>Economic Growth:</strong> Encouraging local trade, cross-referrals, and community patronage across
            Swansea, Neath Port Talbot, and Carmarthenshire.
          </li>
          <li>
            <strong>Data Integrity & Trust:</strong> Implementing a robust 3-tier Community Verification System to
            protect consumers from fake listings, outdated contact details, and unverified services.
          </li>
          <li>
            <strong>Youth & Volunteer Engagement:</strong> Training local youth and volunteers in field operations,
            digital data management, community engagement, and project administration.
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-brand-navy">Our Regional Footprint</h2>
        <p className="mt-3 text-slate-600">
          BSD covers the complete SA Postcode Area (SA1 to SA34), organized into three strategic zones:
        </p>
        {/* CLIENT-REVIEW: reproduced verbatim. Zone 3 is given here as SA14 – SA34, while the Regional
            Coverage Factsheet gives SA14–SA20 and SA31–SA34. */}
        <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-600">
          <li>Zone 1: Greater Swansea & Gower (SA1 – SA7)</li>
          <li>Zone 2: Neath Port Talbot & Swansea Valley (SA8 – SA13)</li>
          <li>Zone 3: Carmarthenshire & West Wales (SA14 – SA34)</li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-brand-navy">Get Involved</h2>
        <p className="mt-3 text-slate-600">
          BSD is built by the community, for the community. Whether you want to volunteer as a field representative,
          assist with data verification, or support our outreach events, we welcome your involvement.
        </p>
        <ul className="mt-4 space-y-2 text-slate-700">
          <li className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-brand-teal-dark" aria-hidden="true" />
            <span>
              Email:{" "}
              <a href={`mailto:${EMAILS.community}`} className="font-semibold text-brand-teal-dark hover:underline">
                {EMAILS.community}
              </a>
            </span>
          </li>
          <li className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-brand-teal-dark" aria-hidden="true" />
            <span>
              Submit a Listing:{" "}
              <Link href="/submit" className="font-semibold text-brand-teal-dark hover:underline">
                bsd.wales/submit
              </Link>
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}
