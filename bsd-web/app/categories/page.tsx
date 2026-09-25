import Link from "next/link";
import type { Metadata } from "next";
import { getCategories } from "@/lib/taxonomy";

// Categories come from the admin panel, fetched fresh on every visit.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Browse Categories",
  description: "Browse all the categories of Bangladeshi businesses and services listed on BSD across Swansea, Neath Port Talbot and Carmarthenshire.",
  alternates: { canonical: "/categories" },
};

export default async function CategoriesPage() {
  const categories = await getCategories();
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold text-brand-navy">Browse Categories</h1>
      <p className="mt-2 text-slate-600">All {categories.length} categories of Bangladeshi businesses and services across South West Wales.</p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c) => (
          <Link
            key={c.slug}
            href={`/categories/${c.slug}`}
            className="rounded-lg border border-slate-200 p-5 transition hover:border-brand-teal hover:shadow-sm"
          >
            <c.icon className="h-7 w-7 text-brand-teal" aria-hidden="true" />
            <h2 className="mt-2 font-semibold text-brand-navy">{c.name}</h2>
            {c.subcategories.length > 0 && (
              <p className="mt-1 line-clamp-2 text-sm text-slate-500">{c.subcategories.map((s) => s.name).join(", ")}</p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
