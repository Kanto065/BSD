import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { EMAILS } from "@/lib/content";

export const metadata: Metadata = {
  title: { absolute: "Free Access Policy | BSD Wales" },
  description:
    "Searching bsd.wales and viewing business profiles is free for everyone, and every eligible business in SA1 to SA34 is entitled to a free standard directory listing.",
  alternates: { canonical: "/free-access" },
};

// Copy is verbatim from the client's "Free Access Policy Page" doc.
export default function FreeAccessPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold text-brand-navy">Open, Barrier-Free Access for Everyone</h1>
      <p className="mt-4 text-slate-600">
        The Bangladeshi Business & Service Directory (BSD) was created with a clear mission: to ensure every
        resident, visitor, and business across South West Wales can easily find and connect with local
        Bangladeshi-owned businesses, professionals, and essential services without financial barriers.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-brand-navy">Our Promises to the Community</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-600">
          <li>
            <strong>100% Free for the Public:</strong> Searching bsd.wales, viewing business profiles, accessing
            contact information, and using our digital directory will always be completely free. No subscription,
            registration, or paywall is ever required.
          </li>
          <li>
            <strong>Free Basic Listings for Businesses:</strong> Every eligible business, sole trader, freelancer,
            and community service operating in our coverage area (Postcodes SA1 to SA34) is entitled to a free
            standard directory listing.
          </li>
          <li>
            <strong>No Hidden Fees:</strong> We do not charge hidden maintenance fees, renewal costs, or mandatory
            listing charges.
          </li>
          <li>
            <strong>Data Privacy Protection:</strong> We do not track, collect, or sell personal search data to
            third-party advertising networks. Your search activity on bsd.wales remains private.
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-brand-navy">What is Included in a Free Listing?</h2>
        <p className="mt-3 text-slate-600">
          All verified businesses receive a comprehensive standard profile that includes:
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-600">
          <li>Business Name & Official Category</li>
          <li>Full Operating Address & Postcode</li>
          <li>Direct Telephone & WhatsApp Contact Numbers</li>
          <li>Operating Hours & Map Location Pin</li>
          <li>Community Verification Eligibility</li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-brand-navy">How We Sustain This Platform</h2>
        <p className="mt-3 text-slate-600">
          BSD is an open-access community resource. Operational costs—such as web hosting, server security, domain
          maintenance, and print production—are covered through voluntary micro-contributions, regional business
          sponsorships, and community fundraising initiatives managed under the BayConnect umbrella.
        </p>
      </section>

      <section className="mt-10 rounded-xl bg-slate-50 p-6">
        <p className="text-slate-700">
          Have a question about our free access model or need help submitting a listing?
        </p>
        <p className="mt-3 flex items-center gap-2 text-slate-700">
          <Mail className="h-4 w-4 text-brand-teal-dark" aria-hidden="true" />
          <span>
            Contact Us:{" "}
            <a href={`mailto:${EMAILS.support}`} className="font-semibold text-brand-teal-dark hover:underline">
              {EMAILS.support}
            </a>
          </span>
        </p>
      </section>
    </div>
  );
}
