import type { Metadata } from "next";
import { CREOVA_URL, EMAILS } from "@/lib/content";

export const metadata: Metadata = {
  title: { absolute: "Powered by BayConnect | BSD Wales" },
  description:
    "BayConnect is a regional community development, technology and networking platform. BSD operates under its administrative framework and governance.",
  alternates: { canonical: "/bayconnect" },
};

// Copy is verbatim from the client's "Powered by BayConnect Page" doc, including its own typos
// ("Oversite", "adhering"). CLIENT-REVIEW: list of typos left as written is in the architecture doc.
export default function BayConnectPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold text-brand-navy">About BayConnect</h1>
      <p className="mt-4 text-slate-600">
        BayConnect is a regional community development, technology, and networking platform operating across the
        Swansea Bay City Region. Serving as an umbrella platform, BayConnect empowers local social projects, cultural
        initiatives, and digital resources with the structural, legal, and operational foundation needed to thrive.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-brand-navy">Governance, Compliance & Standards</h2>
        <p className="mt-3 text-slate-600">
          The Bangladeshi Business & Service Directory (BSD) operates under the administrative framework and
          governance of BayConnect. This parent partnership ensures that BSD operates with complete transparency and
          adhering to UK institutional standards:
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-600">
          <li>
            <strong>UK GDPR & Data Protection:</strong> Full compliance with UK Data Protection regulations,
            guaranteeing that all directory information is gathered, stored, and managed legally and ethically.
          </li>
          <li>
            <strong>Financial Transparency:</strong> Oversite of all project sponsorships, grants, print production
            budgets, and micro-donations through audited, transparent accounting procedures.
          </li>
          <li>
            <strong>Brand & Production Quality:</strong> Technical supervision over digital infrastructure (bsd.wales),
            database architecture, security protocols, and professional press-ready print publication guidelines.
          </li>
          <li>
            <strong>Complaints & Escalation Procedures:</strong> Overseeing clear resolution mechanisms for information
            corrections, ownership verifications, and public feedback.
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-brand-navy">The BayConnect Ecosystem</h2>
        <p className="mt-3 text-slate-600">
          Beyond the BSD directory project, BayConnect supports wider regional initiatives focused on:
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-600">
          <li>Digital inclusion and technology workshops for local business owners.</li>
          <li>Community storytelling, media, and creative studio production (BayCreative Studio).</li>
          <li>
            Youth leadership development and civic engagement across Swansea Bay, Neath Port Talbot, and
            Carmarthenshire.
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-brand-navy">Contact BayConnect Operations</h2>
        <p className="mt-3 text-slate-600">
          For corporate partnerships, institutional inquiries, or governance questions regarding BSD or other
          BayConnect initiatives:
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-600">
          <li>Platform Portal: bsd.wales</li>
          <li>Parent Organization: BayConnect</li>
          <li>
            Creative Partner:{" "}
            <a
              href={CREOVA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-brand-teal-dark hover:underline"
            >
              CREOVA Studio
            </a>
          </li>
          <li>Coverage Region: Swansea Bay Area & South West Wales, UK</li>
          <li>
            Administrative Email:{" "}
            <a href={`mailto:${EMAILS.admin}`} className="font-semibold text-brand-teal-dark hover:underline">
              {EMAILS.admin}
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}
