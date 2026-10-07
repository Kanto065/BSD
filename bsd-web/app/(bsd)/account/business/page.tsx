import type { Metadata } from "next";
import Link from "next/link";
import BusinessProfileForm from "@/components/BusinessProfileForm";
import { publicApiBase } from "@/lib/api";
import { getCategories, toOptions } from "@/lib/taxonomy";

export const metadata: Metadata = {
  title: "Your Business Details",
  description: "The business details saved on your BSD account.",
  robots: { index: false, follow: false },
};

// Rendered per request so the browser gets the API address of the running deployment.
export const dynamic = "force-dynamic";

export default async function BusinessDetailsPage() {
  const categories = await getCategories();
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <Link href="/account" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-teal-dark hover:underline">
        Your account
      </Link>
      <h1 className="mt-2 text-3xl font-bold text-brand-navy">Your business details</h1>
      <p className="mt-4 text-slate-600">Save your details once. They fill in the Submit form for you, and you can change them here at any time.</p>
      <div className="mt-10">
        <BusinessProfileForm apiBase={publicApiBase()} categories={toOptions(categories)} />
      </div>
    </div>
  );
}
