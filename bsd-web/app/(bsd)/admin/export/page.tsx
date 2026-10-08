"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { useSession } from "@/lib/admin-session";
import { Card, ErrorNote, PageTitle, buttonClass } from "@/components/admin/ui";

// M7. Downloads every approved listing for the printed guide, grouped by zone then category.
// The download goes through the signed-in API call, so the token never appears in a URL.
export default function ExportPage() {
  const { api } = useSession();
  const [busy, setBusy] = useState<"csv" | "json" | null>(null);
  const [error, setError] = useState<unknown>(null);

  async function download(format: "csv" | "json") {
    setBusy(format);
    setError(null);
    try {
      const blob = await api<Blob>(`/export/listings?format=${format}`, { blob: true });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bsd-print-export-${new Date().toISOString().slice(0, 10)}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageTitle sub="Approved listings for the printed guide, grouped by zone, then category, then name from A to Z.">Print export</PageTitle>
      <ErrorNote error={error} />
      <Card title="Download listings">
        <p className="max-w-[70ch] text-sm leading-relaxed text-slate-600">
          Addresses are left out for listings that hide them, and emails are included only where the owner chose to show them. Every download is recorded in the audit log.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" disabled={busy !== null} onClick={() => void download("csv")} className={`${buttonClass} bg-brand-blue text-white hover:bg-brand-blue/90`}>
            <Download className="h-4 w-4" aria-hidden="true" />
            {busy === "csv" ? "Preparing..." : "Download CSV"}
          </button>
          <button type="button" disabled={busy !== null} onClick={() => void download("json")} className={`${buttonClass} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}>
            <Download className="h-4 w-4" aria-hidden="true" />
            {busy === "json" ? "Preparing..." : "Download JSON"}
          </button>
        </div>
      </Card>
    </div>
  );
}
