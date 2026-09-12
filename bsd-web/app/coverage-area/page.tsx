import type { Metadata } from "next";
import { COVERAGE_AREAS } from "@/lib/content";

export const metadata: Metadata = {
  title: "Coverage Area",
  description:
    "BSD covers the wider Swansea Bay region: Swansea, Neath Port Talbot, Llanelli, Gorseinon, Mumbles, Morriston, Sketty and Uplands.",
  alternates: { canonical: "/coverage-area" },
};

export default function CoverageAreaPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold text-slate-900">Coverage Area</h1>
      <p className="mt-4 text-slate-600">BSD covers the wider Swansea Bay region, including:</p>
      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {COVERAGE_AREAS.map((a) => (
          <li key={a} className="rounded-lg border border-slate-200 px-4 py-3 text-center font-medium text-slate-700">
            {a}
          </li>
        ))}
      </ul>
      <p className="mt-8 text-slate-600">
        Additional nearby areas may be included as the directory expands.
      </p>
    </div>
  );
}
