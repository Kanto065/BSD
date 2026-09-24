import type { Metadata } from "next";
import { ArrowLink } from "@/components/ArrowLink";
import { FAQ_ITEMS } from "@/lib/content";

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description: "Answers to common questions about whether BSD is free, how to submit a listing, coverage area, and data privacy.",
  alternates: { canonical: "/faq" },
};

export default function FaqPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <h1 className="text-3xl font-bold text-brand-navy">Frequently Asked Questions</h1>
      <div className="mt-8 divide-y divide-slate-200">
        {FAQ_ITEMS.map((item) => (
          <details key={item.question} className="group py-4">
            <summary className="cursor-pointer list-none font-semibold text-brand-navy marker:content-none">
              <span className="mr-2 text-brand-teal-dark">Q.</span>
              {item.question}
            </summary>
            <p className="mt-2 pl-5 text-slate-600">{item.answer}</p>
          </details>
        ))}
      </div>
      <div className="mt-10 flex flex-wrap gap-x-8 gap-y-2 border-t border-slate-200 pt-6">
        <ArrowLink href="/legal">Read the Legal Disclaimer</ArrowLink>
        <ArrowLink href="/privacy">Read the Privacy Policy</ArrowLink>
        <ArrowLink href="/verification-policy">How verification works</ArrowLink>
      </div>
    </div>
  );
}
