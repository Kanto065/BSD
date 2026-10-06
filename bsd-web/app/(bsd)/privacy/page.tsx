import type { Metadata } from "next";
import Link from "next/link";
import { DocSections, docLink, type DocSection } from "@/components/DocSections";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How BSD collects, uses, stores and protects information submitted to the directory, and your GDPR rights.",
  alternates: { canonical: "/privacy" },
};

const contactPage = (
  <Link href="/contact" className={docLink}>
    BSD Contact Page
  </Link>
);

// Verbatim from the client's "BSD – Privacy Policy" document, including its lists. The only wording changes are the
// CLIENT-REVIEW items marked below.
const SECTIONS: DocSection[] = [
  {
    title: "1. Introduction",
    body: [
      "BSD – Bangladeshi Business & Service Directory (Swansea Bay Edition) is committed to protecting the privacy of all individuals and businesses who submit information to the directory. This Privacy Policy explains what data we collect, how we use it, how we store it, and your rights under GDPR.",
      "BSD operates as a free community initiative under the BayConnect ecosystem.",
    ],
  },
  {
    title: "2. Data We Collect",
    body: [
      "When you submit your business or service to BSD, we may collect the following information:",
      {
        list: [
          "Business / Service Name",
          "Category",
          "Owner / Provider Name",
          "Phone Number",
          "Email Address (optional)",
          "Website / Social Media Links (optional)",
          "Address or Coverage Area",
          "Description of Services",
          "Photos or Logo (optional)",
          "Additional notes provided voluntarily",
        ],
      },
      "We do not collect sensitive personal data.",
    ],
  },
  {
    title: "3. How We Use Your Data",
    body: [
      "Your submitted information is used exclusively for the following purposes:",
      {
        list: [
          "Publishing your listing in the BSD directory (print + digital)",
          "Helping community members find your business or service",
          "Improving directory accuracy and coverage",
          "Contacting you for updates or corrections (if needed)",
          "Preparing future digital platforms or mobile apps",
        ],
      },
      "We do not use your data for marketing, advertising, or commercial purposes.",
    ],
  },
  {
    title: "4. Legal Basis for Processing (GDPR)",
    body: [
      "BSD processes your data under the following GDPR principles:",
      {
        list: [
          "Consent: You voluntarily submit your information and agree to its publication.",
          "Legitimate Interest: BSD aims to support community access to local Bangladeshi businesses and services.",
          "Transparency: You are informed about how your data is used and stored.",
        ],
      },
    ],
  },
  {
    title: "5. Data Storage & Protection",
    body: [
      {
        list: [
          "Your data is stored securely within BSD’s internal systems.",
          "Access is restricted to authorised administrators only.",
          "We do not share, sell, trade, or transfer your data to third parties.",
          "We take reasonable measures to prevent unauthorised access, alteration, or misuse.",
        ],
      },
    ],
  },
  {
    title: "6. Data Sharing",
    body: [
      "BSD does not share your data with:",
      { list: ["Advertisers", "Sponsors", "External companies", "Third-party marketing platforms"] },
      "Your data is used only for directory publication and community benefit.",
    ],
  },
  {
    title: "7. Your Rights (GDPR)",
    body: [
      "You have the right to:",
      {
        list: [
          "Access your listing",
          "Request correction of inaccurate information",
          "Request removal of your listing",
          "Request updates at any time",
          "Withdraw consent for publication",
          "Request temporary suspension of your listing",
        ],
      },
      { node: <p>To exercise these rights, contact us via the {contactPage}.</p> },
    ],
  },
  {
    title: "8. Removal of Listings",
    body: [
      "You may request removal of your listing at any time. BSD will remove the listing within 3–7 working days.",
      "Emergency corrections (incorrect or sensitive information) will be addressed within 24 hours.",
    ],
  },
  {
    title: "9. Photos, Logos & Media",
    body: [
      "Any photos or logos submitted are used solely for directory display. You retain full ownership of your media. BSD will remove or replace media upon request.",
    ],
  },
  {
    title: "10. Children’s Privacy",
    body: [
      "BSD does not knowingly collect or publish information from individuals under the age of 16. All submissions must be made by adults or authorised representatives.",
    ],
  },
  {
    title: "11. Free Community Initiative",
    body: [
      "BSD operates as a free community initiative until 30 June 2027. During this period:",
      // CLIENT-REVIEW (L3): "No sponsorships" became "No website sponsorships" so this stays consistent with print edition
      // sponsorship being allowed.
      { list: ["No listing fees", "No website sponsorships", "No advertisements", "No paid promotions"] },
      "are accepted.",
      "Your data will never be used for commercial purposes during this period.",
    ],
  },
  {
    title: "12. Future Changes",
    body: [
      "If BSD introduces premium services or expands its digital platform, this Privacy Policy may be updated. Any changes will be announced publicly and will require renewed consent if applicable.",
    ],
  },
  {
    title: "13. Contact Information",
    body: [
      "For privacy-related questions or requests:",
      {
        node: (
          <>
            {/* CLIENT-REVIEW (L4): v1 gave privacy@bsd.wales. The v2 mailbox set uses compliance@bsd.wales for privacy and GDPR. */}
            <p>
              <span className="font-semibold text-slate-800">Email:</span>{" "}
              <a href="mailto:compliance@bsd.wales" className={docLink}>
                compliance@bsd.wales
              </a>
            </p>
            <p className="mt-1">
              <span className="font-semibold text-slate-800">Contact Page:</span> {contactPage}
            </p>
          </>
        ),
      },
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold text-brand-navy">Privacy Policy</h1>
      <DocSections sections={SECTIONS} />
    </div>
  );
}
