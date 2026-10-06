import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import VerificationBadge, { type VerificationStatus } from "@/components/VerificationBadge";
import { ArrowLink } from "@/components/ArrowLink";
import { VERIFICATION_INTRO, VERIFICATION_TIERS } from "@/lib/content";

export const metadata: Metadata = {
  title: "Verification Policy",
  description:
    "How BSD's 3-tier community verification works, and what the Community Verified, Verification Pending and Newly Listed badges mean.",
  alternates: { canonical: "/verification-policy" },
};

// CLIENT-REVIEW: the three badge meanings are our own English wording. The client's badge table is a
// Bengali developer note that describes "Community Verified" as 100% accurate, which conflicts with the
// decision that Community Verified confirms contact and operating details only.
const BADGE_ROWS: { status: VerificationStatus; meaning: string }[] = [
  {
    status: "COMMUNITY_VERIFIED",
    meaning:
      "A field volunteer has cross-checked the business's operating details, address and phone number.",
  },
  {
    status: "PENDING_VERIFICATION",
    meaning: "A field volunteer is currently cross-checking this listing.",
  },
  {
    status: "NEWLY_LISTED",
    meaning: "The business was added recently and has not been audited yet.",
  },
];

export default function VerificationPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold text-brand-navy">Verification Policy</h1>

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-brand-navy">The 3-Tier Community Verification System</h2>
        {/* Factsheet section 3, verbatim */}
        <p className="mt-3 text-slate-600">{VERIFICATION_INTRO}</p>
        <ol className="mt-6 grid gap-4 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
          {VERIFICATION_TIERS.map((t, i) => (
            <li key={t.tier} className="contents">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="text-xs font-bold uppercase tracking-wide text-brand-teal-dark">{t.tier}</p>
                <h3 className="mt-1 font-bold text-brand-navy">{t.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{t.description}</p>
              </div>
              {i < VERIFICATION_TIERS.length - 1 && (
                <ArrowRight className="mx-auto hidden h-5 w-5 self-center text-slate-400 md:block" aria-hidden="true" />
              )}
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-brand-navy">What the Badges Mean</h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Badge
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Meaning
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {BADGE_ROWS.map((r) => (
                <tr key={r.status}>
                  <td className="whitespace-nowrap px-4 py-4 align-top">
                    <VerificationBadge status={r.status} />
                  </td>
                  <td className="px-4 py-4 text-slate-600">{r.meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-slate-600">The homepage &quot;Featured & Verified&quot; section shows only Community Verified listings.</p>
      </section>

      <section className="mt-12 rounded-xl bg-slate-50 p-6">
        <h2 className="text-lg font-semibold text-brand-navy">What verification does not mean</h2>
        {/* CLIENT-REVIEW (L1, L2): same wording as the smallest-change edits to the FAQ and Legal Disclaimer. */}
        <p className="mt-2 text-slate-600">
          Community Verified confirms contact and operating details only; it is not an endorsement or guarantee of
          service quality.
        </p>
        <div className="mt-4">
          <ArrowLink href="/legal">Read the Legal Disclaimer</ArrowLink>
        </div>
      </section>
    </div>
  );
}
