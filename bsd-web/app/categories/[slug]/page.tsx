import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLink } from "@/components/ArrowLink";
import { CATEGORIES, SITE_URL } from "@/lib/content";

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: c.slug }));
}

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const category = CATEGORIES.find((c) => c.slug === slug);
  if (!category) return {};
  const description =
    category.subcategories.length > 0
      ? `${category.name} businesses and services across South West Wales: ${category.subcategories.join(", ")}.`
      : `${category.name} businesses and services across South West Wales.`;
  return {
    title: category.name,
    description,
    alternates: { canonical: `/categories/${category.slug}` },
    openGraph: { title: category.name, description, url: `${SITE_URL}/categories/${category.slug}` },
  };
}

export default async function CategoryDetailPage({ params }: { params: Params }) {
  const { slug } = await params;
  const category = CATEGORIES.find((c) => c.slug === slug);
  if (!category) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <ArrowLink href="/categories" direction="left" className="text-sm">
        All Categories
      </ArrowLink>
      <h1 className="mt-4 flex items-center gap-3 text-3xl font-bold text-brand-navy">
        <category.icon className="h-8 w-8 text-brand-teal" aria-hidden="true" />
        {category.name}
      </h1>

      {category.subcategories.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {category.subcategories.map((sub) => (
            <span key={sub} className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-600">
              {sub}
            </span>
          ))}
        </div>
      )}

      <div className="mt-12 rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">
        Listings in this category will appear here once businesses are submitted and approved.
      </div>

      <div className="mt-8 text-center">
        <Link href="/submit" className="inline-block rounded-md bg-green-700 px-6 py-3 font-semibold text-white hover:bg-green-800">
          Submit Your Business
        </Link>
      </div>
    </div>
  );
}
