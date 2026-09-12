import type { Metadata } from "next";
import { CONTACT_CHANNELS, OPERATING_HOURS } from "@/lib/content";

export const metadata: Metadata = {
  title: "Contact BSD",
  description: "Contact BSD for general enquiries, listing updates, community feedback, partnerships, or emergency corrections.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold text-slate-900">Contact BSD</h1>
      <p className="mt-4 text-slate-600">
        If you have questions, need support, want to update your listing, or wish to submit a new business/service,
        you can reach the BSD team through the following channels.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {CONTACT_CHANNELS.map((c) => (
          <div key={c.email} className="rounded-lg border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-900">{c.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{c.description}</p>
            <a href={`mailto:${c.email}`} className="mt-3 inline-block font-medium text-teal hover:underline">
              {c.email}
            </a>
            {c.response && <p className="mt-1 text-xs text-slate-500">Response time: {c.response}</p>}
          </div>
        ))}
      </div>

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-slate-900">Operating Hours</h2>
        <ul className="mt-3 space-y-1 text-slate-600">
          {OPERATING_HOURS.map((o) => (
            <li key={o.day} className="flex justify-between border-b border-slate-100 py-1 sm:w-80">
              <span>{o.day}</span>
              <span className="font-medium">{o.hours}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 text-sm text-slate-500">
        <p>BSD is a free community initiative until 30 June 2027. No sponsorships, advertisements, or paid listings are accepted.</p>
        <p className="mt-1">All information is provided voluntarily by business/service owners. BSD is not responsible for business transactions or disputes.</p>
        <p className="mt-1">Listings can be corrected or removed upon request.</p>
      </section>

      <p className="mt-8 font-medium text-slate-700">Powered by BayConnect — Connect. Celebrate. Empower.</p>
    </div>
  );
}
