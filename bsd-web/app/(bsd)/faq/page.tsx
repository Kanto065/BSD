import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLink } from "@/components/ArrowLink";
import { FAQ_ITEMS, faqAnswerText } from "@/lib/content";

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
      acceptedAnswer: { "@type": "Answer", text: faqAnswerText(item.answer) },
    })),
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <h1 className="text-3xl font-bold text-brand-navy">Frequently Asked Questions</h1>
      <div className="mt-8 divide-y divide-slate-200">
        {FAQ_ITEMS.map((item, n) => (
          <details key={item.question} className="group py-4">
            <summary className="cursor-pointer list-none font-semibold text-brand-navy marker:content-none">
              <span className="mr-2 text-brand-teal-dark">{n + 1}.</span>
              {item.question}
            </summary>
            <div className="mt-2 space-y-2 pl-5 text-slate-600">
              {item.answer.map((b, i) =>
                typeof b === "string" ? (
                  <p key={i}>{b}</p>
                ) : "list" in b ? (
                  <ul key={i} className="list-disc space-y-0.5 pl-5 marker:text-brand-teal">
                    {b.list.map((li) => (
                      <li key={li}>{li}</li>
                    ))}
                  </ul>
                ) : (
                  <ul key={i} className="space-y-1">
                    {b.links.map((l) => (
                      <li key={l.href}>
                        <Link href={l.href} className="font-semibold text-brand-teal-dark hover:underline">
                          {l.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ),
              )}
            </div>
          </details>
        ))}
      </div>
      <div className="mt-10 border-t border-slate-200 pt-6">
        <ArrowLink href="/verification-policy">How verification works</ArrowLink>
      </div>
    </div>
  );
}
