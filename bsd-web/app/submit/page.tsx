import type { Metadata } from "next";
import { CATEGORIES } from "@/lib/content";

export const metadata: Metadata = {
  title: "Submit Your Listing",
  description: "Add your business or service to the BSD directory — free of charge.",
  alternates: { canonical: "/submit" },
};

export default function SubmitPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold text-slate-900">Submit Your Listing</h1>
      <p className="mt-4 text-slate-600">
        Add your business or service to the BSD directory — free of charge. Covers all {CATEGORIES.length} categories,
        including Independent Professionals who work without a physical office.
      </p>

      <div className="mt-10 rounded-lg border border-dashed border-slate-300 p-8 text-center">
        <p className="text-slate-600">
          The online submission form is launching shortly. In the meantime, email your business details to:
        </p>
        <a href="mailto:info@bsd.wales" className="mt-3 inline-block text-lg font-semibold text-teal hover:underline">
          info@bsd.wales
        </a>
        <p className="mt-4 text-sm text-slate-500">
          Include: business/service name, category, a short description (50–150 words), services offered, contact
          phone/email, address or coverage area, opening hours, and any photos or logo.
        </p>
      </div>

      <p className="mt-8 text-sm text-slate-500">
        Thank you! Once submitted, the BSD team will verify and publish your listing within 3–7 days.
      </p>
    </div>
  );
}
