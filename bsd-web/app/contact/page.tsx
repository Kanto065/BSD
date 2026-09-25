import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_CHANNELS, EMAILS, OPERATING_HOURS } from "@/lib/content";

export const metadata: Metadata = {
  title: "Contact BSD",
  description:
    "Contact BSD for support and general enquiries, privacy and GDPR requests, community outreach and volunteering, or partnerships and governance.",
  alternates: { canonical: "/contact" },
};

const link = "font-semibold text-brand-teal-dark hover:underline";
const h2 = "text-xl font-semibold text-brand-navy";

// Follows the client's "BSD – Contact Page" document section by section. The v1 mailboxes (info@, partnership@,
// urgent@) are replaced by the v2 set (decision 3), so the mailbox sections are the four v2 channels. The document's
// "Social Media (Optional)" section is left out until the client supplies the links, as the document itself says.
export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold text-brand-navy">Contact BSD – Bangladeshi Business & Service Directory</h1>
      <p className="mt-4 text-slate-600">
        If you have questions, need support, want to update your listing, or wish to submit a new business/service,
        you can reach the BSD team through the following channels.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {CONTACT_CHANNELS.map((c) => (
          <div key={c.email} className="rounded-lg border border-slate-200 p-5">
            <h2 className="font-semibold text-brand-navy">{c.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{c.description}</p>
            {c.points && (
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-slate-600">
                {c.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
            <a href={`mailto:${c.email}`} className="mt-3 inline-block font-medium text-brand-teal-dark hover:underline">
              {c.email}
            </a>
          </div>
        ))}
      </div>

      <section id="submit-or-update" className="mt-12 scroll-mt-24">
        <h2 className={h2}>Submit or Update a Listing</h2>
        <p className="mt-3 text-slate-600">If you want to add your business/service or update an existing listing:</p>
        <ul className="mt-3 space-y-2 text-slate-600">
          <li>
            <span className="font-semibold text-slate-800">Submission Form:</span>{" "}
            <Link href="/submit" className={link}>
              Submit Your Listing
            </Link>
          </li>
          <li>
            <span className="font-semibold text-slate-800">Update Request:</span>{" "}
            <a href={`mailto:${EMAILS.support}?subject=Listing%20update%20request`} className={link}>
              Request Listing Update
            </a>
            <span className="mt-1 block text-sm text-slate-500">
              You can also open your listing&apos;s page and use the &ldquo;Request an update&rdquo; form there.
            </span>
          </li>
        </ul>
      </section>

      <section className="mt-12">
        <h2 className={h2}>Postal / Physical Correspondence</h2>
        <p className="mt-3 text-slate-600">Now unavailable. We will add address later.</p>
      </section>

      <section className="mt-12">
        <h2 className={h2}>Operating Hours</h2>
        <ul className="mt-3 space-y-1 text-slate-600">
          {OPERATING_HOURS.map((o) => (
            <li key={o.day} className="flex justify-between border-b border-slate-100 py-1 sm:w-80">
              <span>{o.day}</span>
              <span className="font-medium">{o.hours}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className={h2}>Important Notes</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-600">
          <li>BSD is a free community initiative until 30 June 2027</li>
          {/* CLIENT-REVIEW (L3): "No sponsorships" became "No website sponsorships" so this stays consistent with
              print edition sponsorship being allowed. */}
          <li>No website sponsorships, advertisements, or paid listings are accepted</li>
          <li>All information is provided voluntarily by business/service owners</li>
          <li>BSD is not responsible for business transactions or disputes</li>
          <li>Listings can be corrected or removed upon request</li>
        </ul>
      </section>

      <section className="mt-12">
        <h2 className={h2}>Powered By BayConnect</h2>
        <p className="mt-3 text-slate-600">BSD is operated under the BayConnect community ecosystem.</p>
        <p className="mt-2 font-medium text-slate-800">BayConnect — Connect. Celebrate. Empower.</p>
      </section>
    </div>
  );
}
