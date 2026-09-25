import type { Metadata } from "next";
import SubmitForm from "@/components/SubmitForm";
import { publicApiBase } from "@/lib/api";
import { CATEGORIES, EMAILS } from "@/lib/content";

export const metadata: Metadata = {
  title: "Submit Your Listing",
  description: "Add your business or service to the BSD directory — free of charge.",
  alternates: { canonical: "/submit" },
};

// Rendered per request so the browser gets the API address of the running deployment.
export const dynamic = "force-dynamic";

export default function SubmitPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold text-brand-navy">Submit Your Listing</h1>
      <p className="mt-4 text-slate-600">
        Add your business or service to the BSD directory — free of charge. Covers all {CATEGORIES.length} categories,
        including Independent Professionals who work without a physical office.
      </p>
      <p className="mt-2 text-sm text-slate-500">
        Every listing is checked by the BSD team before it is published. Questions? Email{" "}
        <a href={`mailto:${EMAILS.support}`} className="font-semibold text-brand-teal-dark hover:underline">
          {EMAILS.support}
        </a>
        .
      </p>
      <div className="mt-10">
        <SubmitForm apiBase={publicApiBase()} />
      </div>
    </div>
  );
}
