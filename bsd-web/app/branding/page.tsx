import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Branding",
  description: "BSD's branding guide covers logo usage, colours, typography and downloadable brand assets.",
  alternates: { canonical: "/branding" },
};

export default function BrandingPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
      <h1 className="text-3xl font-bold text-slate-900">BSD Branding Guide</h1>
      <p className="mt-4 text-slate-600">Logo usage, colours, typography and visual identity guidelines.</p>
      <div className="mt-10 rounded-lg border border-dashed border-slate-300 p-10 text-slate-500">
        Coming soon. Downloadable brand assets will be published here.
      </div>
    </div>
  );
}
