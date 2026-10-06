import type { Metadata } from "next";
import { ArrowLink } from "@/components/ArrowLink";
import { DocSections, type DocSection } from "@/components/DocSections";

export const metadata: Metadata = {
  title: "Legal Disclaimer",
  description: "BSD's full legal disclaimer covering information accuracy, liability, intellectual property and more.",
  alternates: { canonical: "/legal" },
};

// Verbatim from the client's "BSD – Legal Disclaimer" document, including its lists. The only wording changes are the
// CLIENT-REVIEW items marked below.
const SECTIONS: DocSection[] = [
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
      "BSD and BayConnect shall not be held responsible or liable for:",
      {
        list: [
          "Business transactions",
          "Service quality",
          "Miscommunication",
          "Disputes",
          "Delays",
          "Damages",
          "Financial loss",
          "Personal loss",
          "Any issues arising between users and listed businesses or individuals",
        ],
      },
      "All interactions are strictly between the user and the business/service provider.",
    ],
  },
  {
    title: "4. Independent Professionals",
    body: [
      // CLIENT-REVIEW (L2): v1 read "...does not imply verification, endorsement, or professional accreditation." The word "verification" is
      // removed and a Community Verified sentence added, to fit the v2 badge.
      "BSD includes a category for Independent Professionals who may operate without a physical office. Their inclusion is solely for community visibility and does not imply endorsement or professional accreditation. Any Community Verified badge confirms contact and operating details only.",
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
      "Business owners or service providers may request:",
      { list: ["Correction", "Update", "Temporary suspension", "Permanent removal"] },
      "of their listing at any time.",
    ],
  },
  {
    title: "7. Free Community Initiative",
    body: [
      "BSD is currently operated as a free community initiative until 30 June 2027. During this period:",
      // CLIENT-REVIEW (L3): "No sponsorships" became "No website sponsorships" so this stays consistent with print edition
      // sponsorship being allowed.
      { list: ["No listing fees", "No website sponsorships", "No advertisements", "No paid promotions"] },
      "are accepted.",
      "Future premium services may be introduced only after necessary preparations and formalities.",
    ],
  },
  {
    title: "8. Right to Modify or Remove Listings",
    body: [
      "BSD reserves the right to:",
      {
        list: [
          "Edit formatting for consistency",
          "Remove duplicate or inappropriate listings",
          "Decline submissions that do not meet community guidelines",
        ],
      },
      "without prior notice.",
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
      <h1 className="text-3xl font-bold text-brand-navy">Legal Disclaimer</h1>
      <DocSections sections={SECTIONS} />
      <div className="mt-12 text-center">
        <ArrowLink href="/privacy" className="justify-center">
          Read the Privacy Policy
        </ArrowLink>
      </div>
    </div>
  );
}
