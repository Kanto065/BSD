import Link from "next/link";
import type { Metadata } from "next";
import { CATEGORIES, COVERAGE_AREAS, FEATURED_CATEGORY_SLUGS, SITE_DESCRIPTION } from "@/lib/content";

export const metadata: Metadata = {
  title: "BSD – Bangladeshi Business & Service Directory | Swansea Bay",
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
};

const featured = CATEGORIES.filter((c) => FEATURED_CATEGORY_SLUGS.includes(c.slug));

export default function HomePage() {
  return (
    <>
      <section className="bg-gradient-to-b from-teal/5 to-white px-4 py-16 text-center sm:px-6">
        <div className="mx-auto max-w-3xl">
          <span className="inline-block rounded-full bg-teal/10 px-4 py-1 text-sm font-medium text-teal">
            Free Access • Community Initiative • Powered by BayConnect
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            BSD
            <span className="mt-1 block text-2xl font-semibold text-slate-700 sm:text-3xl">
              Bangladeshi Business & Service Directory
            </span>
          </h1>
          <p className="mt-2 text-xl text-slate-500">Swansea Bay Edition</p>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
            Find trusted Bangladeshi businesses, services & professionals across Swansea Bay.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link href="/categories" className="rounded-md bg-teal px-6 py-3 font-semibold text-white hover:bg-teal-light">
              Browse Categories
            </Link>
            <Link
              href="/categories"
              className="rounded-md border border-slate-300 px-6 py-3 font-semibold text-slate-700 hover:border-teal hover:text-teal"
            >
              Search Businesses
            </Link>
            <Link href="/submit" className="rounded-md bg-accent px-6 py-3 font-semibold text-white hover:bg-orange-700">
              Submit Listing
            </Link>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50 px-4 py-8 sm:px-6">
        <form action="/categories" method="GET" className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row">
          <input
            type="text"
            name="q"
            placeholder="Search businesses, services or categories…"
            className="flex-1 rounded-md border border-slate-300 px-4 py-3 text-sm focus:border-teal focus:outline-none"
          />
          <select
            name="category"
            defaultValue=""
            className="rounded-md border border-slate-300 px-4 py-3 text-sm focus:border-teal focus:outline-none"
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            name="area"
            defaultValue=""
            className="rounded-md border border-slate-300 px-4 py-3 text-sm focus:border-teal focus:outline-none"
          >
            <option value="">All areas</option>
            {COVERAGE_AREAS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-md bg-teal px-6 py-3 text-sm font-semibold text-white hover:bg-teal-light">
            Search
          </button>
        </form>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-bold text-slate-900">Featured Categories</h2>
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {featured.map((c) => (
            <Link
              key={c.slug}
              href={`/categories/${c.slug}`}
              className="rounded-lg border border-slate-200 p-5 text-center font-medium text-slate-700 transition hover:border-teal hover:text-teal hover:shadow-sm"
            >
              <span className="block text-2xl" aria-hidden="true">
                {c.icon}
              </span>
              <span className="mt-2 block">{c.name}</span>
            </Link>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link href="/categories" className="font-semibold text-teal hover:underline">
            View All Categories →
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6">
        <h2 className="text-lg font-semibold text-slate-400">Featured Listings</h2>
        <div className="mt-4 rounded-lg border border-dashed border-slate-300 p-8 text-slate-500">
          Premium listings will appear here.
        </div>
      </section>

      <section className="bg-slate-50 px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold text-slate-900">About BSD</h2>
          <p className="mt-4 text-slate-600">
            BSD is a free community initiative connecting local Bangladeshi businesses, service providers and
            independent professionals under one trusted platform. Free access, community-driven, no listing fee, no
            sponsorship, no advertisements, until 30 June 2027.
          </p>
          <Link href="/about" className="mt-6 inline-block font-semibold text-teal hover:underline">
            Read Full Introduction →
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
        <h2 className="text-2xl font-bold text-slate-900">Coverage Area</h2>
        <p className="mt-4 text-slate-600">Serving the wider Swansea Bay region:</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {COVERAGE_AREAS.map((a) => (
            <span key={a} className="rounded-full bg-teal/10 px-4 py-1 text-sm font-medium text-teal">
              {a}
            </span>
          ))}
        </div>
        <Link href="/coverage-area" className="mt-6 inline-block font-semibold text-teal hover:underline">
          View Full Coverage →
        </Link>
      </section>

      <section className="bg-slate-50 px-4 py-16 text-center sm:px-6">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold text-slate-900">Community Transparency</h2>
          <p className="mt-4 text-slate-600">
            BSD Directory is a free community initiative operating on a test basis until 30 June 2027. No listing
            fee, sponsorship or advertisement is accepted. Future premium services may be introduced after essential
            preparations and formalities.
          </p>
          <Link href="/transparency" className="mt-6 inline-block font-semibold text-teal hover:underline">
            Full Transparency Statement →
          </Link>
        </div>
      </section>

      <section className="px-4 py-16 text-center sm:px-6">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold text-slate-900">Legal Disclaimer</h2>
          <p className="mt-4 text-slate-600">
            BSD does not verify or guarantee the accuracy of business information. All transactions are strictly
            between the business and the customer.
          </p>
          <Link href="/legal" className="mt-6 inline-block font-semibold text-teal hover:underline">
            Full Legal Disclaimer →
          </Link>
        </div>
      </section>

      <section className="bg-teal px-4 py-16 text-center text-white sm:px-6">
        <h2 className="text-2xl font-bold">Submit Your Business</h2>
        <p className="mt-2 text-teal-50">Add your business or service to the directory — free of charge.</p>
        <Link
          href="/submit"
          className="mt-6 inline-block rounded-md bg-white px-6 py-3 font-semibold text-teal hover:bg-slate-100"
        >
          Submit Listing
        </Link>
      </section>

      <section className="px-4 py-16 text-center sm:px-6">
        <h2 className="text-2xl font-bold text-slate-900">Powered By BayConnect</h2>
        <p className="mt-2 text-slate-600">Community • Culture • Empowerment</p>
        <Link
          href="/about#powered-by-bayconnect"
          className="mt-6 inline-block rounded-md border border-slate-300 px-6 py-3 font-semibold text-slate-700 hover:border-teal hover:text-teal"
        >
          BayConnect Profile
        </Link>
      </section>
    </>
  );
}
