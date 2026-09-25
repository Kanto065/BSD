import Link from "next/link";
import type { Metadata } from "next";
import { ChevronDown, Check, MapPin, Plus, Search, ShieldCheck, Smartphone, Target } from "lucide-react";
import VerificationBadge from "@/components/VerificationBadge";
import { ArrowLink } from "@/components/ArrowLink";
import BusinessCard from "@/components/BusinessCard";
import { featured } from "@/lib/api";
import { ALL_ZONES_LABEL, HOME_FAQ, SITE_DESCRIPTION, ZONES, zoneLabel } from "@/lib/content";
import { HOMEPAGE_TILES, getCategories } from "@/lib/taxonomy";

// The page is prerendered, then refreshed from the API at most once a minute. The API is never called while the
// site is being built (see lib/api.ts).
export const revalidate = 60;

export const metadata: Metadata = {
  title: "BSD – Bangladeshi Business & Service Directory | Swansea Bay & South West Wales",
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
};

const TRUST_TAGS = ["100% Free Public Access", "Community Verified Listings", "Digital & Print Exposure", "UK GDPR Compliant"];

const OWNER_BENEFITS = [
  { icon: Target, title: "Targeted Reach", text: "Reach local customers looking for Bangladeshi businesses." },
  { icon: Smartphone, title: "Digital + Print", text: "Listed on bsd.wales & included in upcoming printed guides." },
  { icon: ShieldCheck, title: "Verified Trust", text: "Build instant credibility with our green verified badge." },
];

type Step = { label: string; href?: string };

// Links follow the Homepage Full Body doc. "View Verified Info" points at the coverage page (the doc's
// /coverage, which redirects to /coverage-area), where the verification summary lives.
const VISITOR_STEPS: Step[] = [
  { label: "Search Category / Zone", href: "/categories" },
  { label: "View Verified Info", href: "/coverage-area" },
  { label: "Connect Directly" },
];

const OWNER_STEPS: Step[] = [
  { label: "Submit Details Online", href: "/submit" },
  { label: "Volunteer Verification", href: "/verification-policy" },
  { label: "Verified & Get Listed", href: "/search" },
];

function StepList({ title, steps }: { title: string; steps: Step[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h3 className="text-sm font-bold uppercase tracking-wide text-brand-teal-dark">{title}</h3>
      <ol className="mt-4 space-y-3">
        {steps.map((s, i) => (
          <li key={s.label} className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-navy text-sm font-bold text-white">
              {i + 1}
            </span>
            {s.href ? (
              <Link href={s.href} className="font-semibold text-brand-navy hover:text-brand-blue hover:underline">
                {s.label}
              </Link>
            ) : (
              <span className="font-semibold text-brand-navy">{s.label}</span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

export default async function HomePage() {
  const [featuredResult, categories] = await Promise.all([featured(8), getCategories()]);
  const popular = categories.slice(0, HOMEPAGE_TILES);
  const featuredItems = featuredResult.ok ? featuredResult.data.items : [];

  return (
    <>
      {/* Hero: exact copy per "Exact Copy & Field Specifications" in the Homepage Header doc */}
      <section className="bg-gradient-to-b from-sky-50 to-white px-4 py-14 text-center sm:px-6 sm:py-20">
        <div className="mx-auto max-w-4xl">
          <span className="inline-block rounded-full bg-sky-100 px-4 py-1 text-sm font-semibold text-brand-blue">
            Swansea Bay & South West Wales Edition
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-brand-navy sm:text-5xl">
            Bangladeshi Business & Service Directory
          </h1>
          <p className="mx-auto mt-5 max-w-3xl text-lg text-slate-600">
            Connecting trusted local businesses, professionals, and community services across Swansea, Neath Port
            Talbot & Carmarthenshire (Postcodes SA1 to SA34).
          </p>

          <form
            action="/search"
            method="GET"
            role="search"
            className="mx-auto mt-8 flex max-w-4xl flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:flex-row"
          >
            <div className="relative flex-1">
              <label htmlFor="hero-q" className="sr-only">
                What service are you looking for?
              </label>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                id="hero-q"
                type="text"
                name="q"
                placeholder="Search restaurants, solicitors, trades, accountants..."
                className="w-full rounded-md border border-slate-300 py-3 pl-9 pr-3 text-sm focus:border-brand-blue focus:outline-none"
              />
            </div>
            <div className="relative md:w-72">
              <label htmlFor="hero-zone" className="sr-only">
                Select Zone (All SA1-SA34)
              </label>
              <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <select
                id="hero-zone"
                name="zone"
                defaultValue=""
                className="w-full rounded-md border border-slate-300 bg-white py-3 pl-9 pr-3 text-sm focus:border-brand-blue focus:outline-none"
              >
                <option value="">{ALL_ZONES_LABEL}</option>
                {ZONES.map((z) => (
                  <option key={z.slug} value={z.slug}>
                    {zoneLabel(z)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-blue px-6 py-3 text-sm font-semibold text-white hover:bg-brand-navy"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              Search Directory
            </button>
          </form>

          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <Link
              href="/categories"
              className="rounded-md border-2 border-brand-blue px-6 py-3 font-semibold text-brand-blue hover:bg-brand-blue hover:text-white"
            >
              Browse Directory
            </Link>
            <Link
              href="/submit"
              className="inline-flex items-center gap-2 rounded-md bg-green-700 px-6 py-3 font-semibold text-white hover:bg-green-800"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Business Free
            </Link>
          </div>

          <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-medium text-slate-700">
            {TRUST_TAGS.map((t) => (
              <li key={t} className="inline-flex items-center gap-1.5">
                <Check className="h-4 w-4 text-green-700" aria-hidden="true" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 1. Popular categories */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-brand-navy sm:text-3xl">Popular Categories</h2>
          <p className="mt-2 text-slate-600">Find Verified Services Across South West Wales</p>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
          {popular.map((c) => (
            <Link
              key={c.slug}
              href={`/categories/${c.slug}`}
              className="rounded-lg border border-slate-200 p-4 text-center text-sm font-semibold text-brand-navy transition hover:border-brand-teal hover:shadow-sm"
            >
              <c.icon className="mx-auto h-7 w-7 text-brand-teal" aria-hidden="true" />
              <span className="mt-2 block">{c.name}</span>
            </Link>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link
            href="/categories"
            className="inline-flex items-center gap-2 rounded-md border-2 border-brand-blue px-6 py-3 font-semibold text-brand-blue hover:bg-brand-blue hover:text-white"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            View All 20+ Categories
          </Link>
        </div>
      </section>

      {/* 2. Explore by regional zones */}
      <section className="bg-slate-50 px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-brand-navy sm:text-3xl">Explore by Regional Zones</h2>
            <p className="mt-2 text-slate-600">Click a zone to find local businesses near you</p>
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {ZONES.map((z) => (
              <div key={z.slug} className="flex flex-col rounded-xl border border-slate-200 bg-white p-6">
                <h3 className="text-lg font-bold text-brand-navy">
                  Zone {z.number}: {z.name}
                </h3>
                <p className="mt-3 text-sm text-slate-600">
                  <span className="font-semibold text-slate-800">Postcodes:</span> {z.postcodeLabel}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  <span className="font-semibold text-slate-800">Key Areas:</span> {z.keyAreas}
                </p>
                <div className="mt-auto pt-5">
                  <Link
                    href={`/${z.slug}`}
                    className="inline-flex w-full items-center justify-center rounded-md bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy"
                  >
                    Browse Zone {z.number}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Featured and verified (Community Verified listings only, empty until there is data) */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-brand-navy sm:text-3xl">Featured & Verified Local Businesses</h2>
          {/* CLIENT-REVIEW: client copy, left as written. "Hand-verified for operational quality & accuracy"
              sits close to what the Legal Disclaimer disclaims. */}
          <p className="mt-2 text-slate-600">Hand-verified for operational quality & accuracy</p>
        </div>
        {featuredItems.length > 0 ? (
          <>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {featuredItems.map((b) => (
                <BusinessCard key={b.slug} business={b} />
              ))}
            </div>
            <div className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-2">
              <ArrowLink href="/search">Browse all listings</ArrowLink>
              <ArrowLink href="/verification-policy">How verification works</ArrowLink>
            </div>
          </>
        ) : (
          <div className="mx-auto mt-8 max-w-2xl rounded-xl border border-dashed border-slate-300 p-8 text-center">
            <VerificationBadge status="COMMUNITY_VERIFIED" />
            <p className="mt-4 text-slate-600">
              Businesses appear here once our field volunteers have completed their checks.
            </p>
            <ArrowLink href="/verification-policy" className="mt-4 justify-center text-sm">
              How verification works
            </ArrowLink>
          </div>
        )}
      </section>

      {/* 4. Business owner */}
      <section className="bg-brand-navy px-4 py-16 text-white sm:px-6">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">Are You a Local Business Owner?</h2>
          <p className="mt-2 text-slate-200">
            Put your services in front of thousands of local residents and community members.
          </p>
          <div className="mt-8 grid gap-6 text-left md:grid-cols-3">
            {OWNER_BENEFITS.map((b) => (
              <div key={b.title} className="rounded-xl bg-white/10 p-6">
                <b.icon className="h-7 w-7 text-brand-teal" aria-hidden="true" />
                <h3 className="mt-3 text-lg font-bold">{b.title}</h3>
                <p className="mt-1 text-sm text-slate-200">{b.text}</p>
              </div>
            ))}
          </div>
          <Link
            href="/submit"
            className="mt-8 inline-flex items-center gap-2 rounded-md bg-white px-6 py-3 font-semibold text-brand-navy hover:bg-slate-100"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Register Your Business Now (100% Free)
          </Link>
        </div>
      </section>

      {/* 5. How it works */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-brand-navy sm:text-3xl">How It Works</h2>
          <p className="mt-2 text-slate-600">3 simple steps</p>
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <StepList title="For Visitors" steps={VISITOR_STEPS} />
          <StepList title="For Business Owners" steps={OWNER_STEPS} />
        </div>
      </section>

      {/* 6. FAQ accordion */}
      <section className="bg-slate-50 px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-2xl font-bold text-brand-navy sm:text-3xl">Frequently Asked Questions</h2>
          <div className="mt-8 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
            {HOME_FAQ.map((item) => (
              <details key={item.question} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-brand-navy marker:content-none">
                  {item.question}
                  <ChevronDown className="h-5 w-5 shrink-0 text-brand-teal-dark transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <p className="mt-3 text-slate-600">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
