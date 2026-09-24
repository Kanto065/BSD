import Link from "next/link";
import { BadgeCheck, Download, Globe, Lock, Plus } from "lucide-react";
import Logo from "@/components/Logo";
import { EMAILS, ZONES, zoneLabel } from "@/lib/content";

// Column 2 to 4 links follow "Website Footer Structural Layout". The Coverage Area link points at
// /coverage-area directly, which is where /coverage redirects to.
const QUICK_LINKS = [
  { href: "/", label: "Home" },
  { href: "/categories", label: "Search Directory" },
  { href: "/coverage-area", label: "Coverage Area (SA1 – SA34)" },
  { href: "/community-initiative", label: "About Initiative" },
  { href: "/faq", label: "Frequently Asked Questions" },
  { href: "/contact", label: "Contact Support" },
];

const LEGAL_LINKS = [
  { href: "/free-access", label: "Free Access Policy" },
  { href: "/privacy", label: "Privacy Policy & GDPR Terms" },
  { href: "/community-guidelines", label: "Community Guidelines" },
  { href: "/complaints", label: "Complaints & Escalation Policy" },
  { href: "/financial-transparency", label: "Financial Transparency" },
  { href: "/bayconnect", label: "Powered by BayConnect" },
];

const linkClass = "text-slate-600 hover:text-brand-blue hover:underline";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer>
      {/* Pre-footer call-to-action banner */}
      <section className="bg-brand-navy px-4 py-12 text-center text-white sm:px-6">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold sm:text-3xl">Grow Your Business Across South West Wales</h2>
          <p className="mt-3 text-slate-200">
            Get listed in our community-verified directory or download our regional coverage guide.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/submit"
              className="inline-flex items-center gap-2 rounded-md bg-white px-6 py-3 font-semibold text-brand-navy hover:bg-slate-100"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Your Business Free
            </Link>
            <Link
              href="/download-pdf"
              className="inline-flex items-center gap-2 rounded-md border border-white px-6 py-3 font-semibold text-white hover:bg-white/10"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Download Print Guide (PDF)
            </Link>
          </div>
        </div>
      </section>

      <div className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Column 1: directory profile and mission */}
          <div>
            <Logo className="h-14" />
            <h2 className="mt-4 text-base font-bold text-brand-navy">BSD Swansea Bay</h2>
            <p className="mt-2 text-sm text-slate-600">Connecting local businesses across South West Wales</p>
            <ul className="mt-4 space-y-2 text-sm font-medium">
              <li>
                <Link href="/verification-policy" className="inline-flex items-center gap-2 text-brand-teal-dark hover:underline">
                  <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                  Community Verified
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="inline-flex items-center gap-2 text-brand-teal-dark hover:underline">
                  <Lock className="h-4 w-4" aria-hidden="true" />
                  UK GDPR Compliant
                </Link>
              </li>
              <li>
                <Link href="/free-access" className="inline-flex items-center gap-2 text-brand-teal-dark hover:underline">
                  <Globe className="h-4 w-4" aria-hidden="true" />
                  100% Free Access
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 2: quick links */}
          <nav aria-label="Quick links">
            <h2 className="text-base font-bold text-brand-navy">Quick Links</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {QUICK_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={linkClass}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Column 3: coverage zones */}
          <nav aria-label="Coverage zones">
            <h2 className="text-base font-bold text-brand-navy">Coverage Zones</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {ZONES.map((z) => (
                <li key={z.slug}>
                  <Link href={`/${z.slug}`} className={linkClass}>
                    {zoneLabel(z)}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/verification-policy" className={linkClass}>
                  Verification Standards
                </Link>
              </li>
              <li>
                <Link href="/submit" className={linkClass}>
                  Submit Free Listing
                </Link>
              </li>
            </ul>
          </nav>

          {/* Column 4: legal and governance */}
          <nav aria-label="Legal and governance">
            <h2 className="text-base font-bold text-brand-navy">Legal & Governance</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {LEGAL_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={linkClass}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Contact and support info bar */}
        <div className="border-t border-slate-200">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4 text-sm text-slate-600 sm:px-6 md:flex-row md:flex-wrap md:items-center md:gap-x-6">
            <span>
              Support:{" "}
              <a href={`mailto:${EMAILS.support}`} className="font-medium text-brand-teal-dark hover:underline">
                {EMAILS.support}
              </a>
            </span>
            <span>
              Privacy:{" "}
              <a href={`mailto:${EMAILS.compliance}`} className="font-medium text-brand-teal-dark hover:underline">
                {EMAILS.compliance}
              </a>
            </span>
            <span>
              Outreach:{" "}
              <a href={`mailto:${EMAILS.community}`} className="font-medium text-brand-teal-dark hover:underline">
                {EMAILS.community}
              </a>
            </span>
            <span>Operations: BayConnect Team, Swansea Bay, UK</span>
          </div>
        </div>

        {/* Footer bottom bar */}
        <div className="border-t border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-4 text-xs text-slate-500 sm:px-6 md:flex-row md:items-center md:justify-between">
            <p>© {year} BSD (Bangladeshi Business & Service Directory). All Rights Reserved.</p>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {/* CLIENT-REVIEW: the Legal Disclaimer link is not in the v2 footer link list. It is added here so
                  the disclaimer page stays reachable from every page. */}
              <Link href="/legal" className="hover:text-brand-blue hover:underline">
                Legal Disclaimer
              </Link>
              <span aria-hidden="true">|</span>
              <span>
                <Link href="/bayconnect" className="hover:text-brand-blue hover:underline">
                  Powered by BayConnect
                </Link>{" "}
                | Creative Partner: CREOVA Studio
              </span>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
