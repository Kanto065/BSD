import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Legal Disclaimer",
  description: "BSD's full legal disclaimer covering information accuracy, liability, intellectual property and more.",
  alternates: { canonical: "/legal" },
};

const SECTIONS = [
  {
    title: "1. Information Accuracy",
    body: [
      "BSD – Bangladeshi Business & Service Directory (Swansea Bay Edition) compiles information provided directly by business owners, service providers, independent professionals, or publicly available sources. While every effort is made to maintain accuracy, BSD does not guarantee that any information listed is complete, correct, or up-to-date.",
      "Users are encouraged to verify details directly with the respective business or service provider before making decisions.",
    ],
  },
  {
    title: "2. No Endorsement or Recommendation",
    body: [
      "Inclusion of any business, service, or individual in BSD does not constitute endorsement, recommendation, approval, or partnership by BSD or BayConnect. Listings are independent and self-submitted.",
      "BSD does not rank, promote, or favour any business or service provider.",
    ],
  },
  {
    title: "3. No Liability",
    body: [
      "BSD and BayConnect shall not be held responsible or liable for: business transactions, service quality, miscommunication, disputes, delays, damages, financial loss, personal loss, or any issues arising between users and listed businesses or individuals.",
      "All interactions are strictly between the user and the business/service provider.",
    ],
  },
  {
    title: "4. Independent Professionals",
    body: [
      "BSD includes a category for Independent Professionals who may operate without a physical office. Their inclusion is solely for community visibility and does not imply verification, endorsement, or professional accreditation.",
      "Users must exercise personal judgment and due diligence when engaging any independent service provider.",
    ],
  },
  {
    title: "5. Intellectual Property",
    body: [
      "All content, branding, layout, design, and structure of BSD are the creative property of BayConnect. No part of the directory may be copied, reproduced, distributed, or used commercially without prior written permission.",
    ],
  },
  {
    title: "6. Data & Privacy",
    body: [
      "Information submitted to BSD is used exclusively for directory purposes. BSD does not sell, trade, or share user-submitted data with third parties.",
      "Business owners or service providers may request correction, update, temporary suspension, or permanent removal of their listing at any time.",
    ],
  },
  {
    title: "7. Free Community Initiative",
    body: [
      "BSD is currently operated as a free community initiative until 30 June 2027. During this period: no listing fees, no sponsorships, no advertisements, no paid promotions are accepted.",
      "Future premium services may be introduced only after necessary preparations and formalities.",
    ],
  },
  {
    title: "8. Right to Modify or Remove Listings",
    body: [
      "BSD reserves the right to edit formatting for consistency, remove duplicate or inappropriate listings, and decline submissions that do not meet community guidelines, all without prior notice.",
    ],
  },
  {
    title: "9. External Links",
    body: [
      "BSD may include links to external websites or social media pages. BSD and BayConnect are not responsible for the content, security, or policies of external sites.",
    ],
  },
  {
    title: "10. Acceptance of Terms",
    body: [
      "By using BSD or submitting a listing, users acknowledge and accept this Legal Disclaimer and agree to the terms stated herein.",
    ],
  },
];

export default function LegalPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold text-slate-900">Legal Disclaimer</h1>
      <div className="mt-8 space-y-8">
        {SECTIONS.map((s) => (
          <section key={s.title}>
            <h2 className="text-lg font-semibold text-slate-900">{s.title}</h2>
            {s.body.map((p, i) => (
              <p key={i} className="mt-2 text-slate-600">
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
