"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession } from "@/lib/admin-session";
import { Card, ErrorNote, PageTitle, Pager, buttonClass, fmtDate, useAdminData } from "@/components/admin/ui";

type Claim = {
  id: string;
  status: string;
  claimantName: string;
  claimantEmail: string;
  claimantPhone: string | null;
  proofText: string;
  proofFileUrl: string | null;
  createdAt: string;
  reviewedAt: string | null;
  business: { id: string; name: string; slug: string; status: string };
  reviewedBy: { name: string } | null;
};

// "Claim This Listing" requests. The public claim form comes with M6; until then claims arrive by email to support@.
export default function ClaimsPage() {
  const { api } = useSession();
  const [status, setStatus] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [pageNo, setPageNo] = useState(1);
  const { data, error, reload } = useAdminData<{ items: Claim[]; total: number; page: number; pageSize: number }>(`/claims?status=${status}&page=${pageNo}`);
  const [actionError, setActionError] = useState<unknown>(null);

  async function decide(id: string, decision: "approve" | "reject") {
    setActionError(null);
    try {
      await api(`/claims/${id}/${decision}`, { method: "PATCH", body: {} });
      await reload();
    } catch (e) {
      setActionError(e);
    }
  }

  return (
    <div>
      <PageTitle sub="Requests from people who say a listing is theirs. Check the proof before approving.">Claims</PageTitle>
      <div className="mb-4 flex gap-2">
        {(["PENDING", "APPROVED", "REJECTED"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setStatus(s);
              setPageNo(1);
            }}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${s === status ? "bg-brand-navy text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}
          >
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>
      <ErrorNote error={error ?? actionError} />
      <div className="space-y-3">
        {data?.items.map((c) => (
          <Card key={c.id}>
            <p className="text-sm text-slate-600">
              For{" "}
              <Link href={`/admin/listings/${c.business.id}`} className="font-semibold text-brand-navy hover:underline">
                {c.business.name}
              </Link>{" "}
              · {fmtDate(c.createdAt)}
            </p>
            <p className="mt-2 font-semibold text-brand-navy">
              {c.claimantName} · {c.claimantEmail}
              {c.claimantPhone ? ` · ${c.claimantPhone}` : ""}
            </p>
            <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{c.proofText}</p>
            {c.proofFileUrl && (
              <a href={c.proofFileUrl} target="_blank" rel="noopener" className="mt-2 inline-block text-sm font-semibold text-brand-teal-dark hover:underline">
                Open the proof file
              </a>
            )}
            {c.status === "PENDING" ? (
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => decide(c.id, "approve")} className={`${buttonClass} bg-green-700 text-white hover:bg-green-800`}>
                  Approve claim
                </button>
                <button type="button" onClick={() => decide(c.id, "reject")} className={`${buttonClass} border border-red-300 bg-white text-red-800 hover:bg-red-50`}>
                  Reject claim
                </button>
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-500">
                {c.status.toLowerCase()} by {c.reviewedBy?.name} on {fmtDate(c.reviewedAt)}
              </p>
            )}
          </Card>
        ))}
        {data && data.items.length === 0 && <Card>No {status.toLowerCase()} claims.</Card>}
      </div>
      {data && <Pager page={data.page} total={data.total} pageSize={data.pageSize} onPage={setPageNo} />}
    </div>
  );
}
