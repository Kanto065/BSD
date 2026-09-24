import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { ArrowLink } from "@/components/ArrowLink";

export const metadata: Metadata = {
  title: "Print Directory (Coming Soon)",
  description: "The official BSD print edition is under production. Download the digital regional coverage map and factsheet in the meantime.",
  alternates: { canonical: "/download-pdf" },
};

// Copy is verbatim from the "Print Guide Link Redirection Strategy" note in the Website Footer Structural
// Layout doc. The PDF is generated from the Regional Coverage Factsheet (see scripts/build-factsheet-pdf.mjs).
export default function DownloadPdfPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
      <h1 className="text-3xl font-bold text-brand-navy">BSD Regional Print Directory (Coming Soon)</h1>
      <p className="mt-4 text-slate-600">
        Our official print edition is currently under production. In the meantime, you can download our digital
        regional coverage map & factsheet.
      </p>
      <a
        href="/BSD-Regional-Coverage-Factsheet.pdf"
        download
        className="mt-8 inline-flex items-center gap-2 rounded-md bg-brand-blue px-6 py-3 font-semibold text-white hover:bg-brand-navy"
      >
        <FileText className="h-5 w-5" aria-hidden="true" />
        Download Coverage Factsheet (PDF)
      </a>
      <div className="mt-10">
        <ArrowLink href="/categories" className="justify-center">
          Browse the directory in the meantime
        </ArrowLink>
      </div>
    </div>
  );
}
