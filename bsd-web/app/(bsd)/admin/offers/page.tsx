"use client";

import { useState } from "react";
import { atLeast, useSession } from "@/lib/admin-session";
import { fmtOfferPercent, rejectReasonError } from "@/lib/admin-offers";
import { Card, ErrorNote, PageTitle, Pager, StatusPill, buttonClass, fmtDate, inputClass, useAdminData } from "@/components/admin/ui";

type Item = {
  id: string;
  title: string;
  percent: number | null;
  terms: string | null;
  status: string;
  rejectionReason: string | null;
  decidedAt: string | null;
  createdAt: string;
  business: { id: string; name: string; slug: string; status: string };
};

const COUNTS_EVENT = "offers-counts-changed";

export default function OffersPage() {
  const { api, admin } = useSession();
  const [status, setStatus] = useState<"PENDING" | "ALL">("PENDING");
  const [pageNo, setPageNo] = useState(1);
  const allowed = atLeast(admin?.role, "MODERATOR");
  const { data, error, reload } = useAdminData<{ items: Item[]; total: number; page: number; pageSize: number }>(
    allowed ? `/offers?${status === "PENDING" ? "status=PENDING&" : ""}page=${pageNo}` : null,
  );
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [reasonError, setReasonError] = useState<string | null>(null);

  if (!allowed) return <Card>You do not have permission to see this page.</Card>;

  const decide = async (id: string, decision: "approve" | "reject") => {
    setActionError(null);
    setReasonError(null);
    if (decision === "reject") {
      const msg = rejectReasonError(reasons[id] ?? "");
      if (msg) return setReasonError(msg);
    }
    try {
      await api(`/offers/${id}/${decision}`, { method: "POST", body: decision === "reject" ? { reason: (reasons[id] ?? "").trim() } : undefined });
      setRejecting(null);
      window.dispatchEvent(new Event(COUNTS_EVENT));
      await reload();
    } catch (e) {
      setActionError(e);
    }
  };

  return (
    <div>
      <PageTitle sub="Discount offers from merchants. Approving makes an offer live for pass holders.">Offers</PageTitle>
      <div className="mb-4 flex flex-wrap gap-2">
        {(["PENDING", "ALL"] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={status === s}
            onClick={() => {
              setStatus(s);
              setPageNo(1);
            }}
            className={`${buttonClass} min-h-[44px] ${status === s ? "bg-brand-navy text-white" : "border border-slate-300 bg-white text-brand-navy hover:bg-slate-50"}`}
          >
            {s === "PENDING" ? "Pending" : "All"}
          </button>
        ))}
      </div>
      <ErrorNote error={error ?? actionError} />
      <div className="space-y-4">
        {data?.items.map((o) => (
          <Card key={o.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="break-words font-semibold text-brand-navy">{o.business.name}</p>
                <p className="break-words text-sm font-medium text-slate-800">{o.title}</p>
                <p className="text-sm text-slate-700">{fmtOfferPercent(o.percent)}</p>
                <p className="mt-1 text-xs text-slate-500">Submitted {fmtDate(o.createdAt)}</p>
              </div>
              <StatusPill status={o.status} />
            </div>
            <p className="mt-3 whitespace-pre-line break-words text-sm text-slate-700">Terms: {o.terms || "None given"}</p>
            {o.rejectionReason && <p className="mt-3 break-words text-sm text-slate-700">Reason given: {o.rejectionReason}</p>}
            {o.status === "PENDING" ? (
              <div className="mt-4">
                {rejecting === o.id ? (
                  <div>
                    <label htmlFor={`reason-${o.id}`} className="text-sm font-semibold text-slate-800">
                      Reason shown to the merchant
                    </label>
                    <input
                      id={`reason-${o.id}`}
                      value={reasons[o.id] ?? ""}
                      maxLength={300}
                      onChange={(e) => setReasons({ ...reasons, [o.id]: e.target.value })}
                      aria-invalid={!!reasonError}
                      className={`${inputClass.replace("text-sm", "text-base sm:text-sm")} min-h-[44px]`}
                    />
                    {reasonError && (
                      <p role="alert" className="mt-1 text-sm text-red-700">
                        {reasonError}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button type="button" onClick={() => decide(o.id, "reject")} className={`${buttonClass} min-h-[44px] bg-red-700 text-white hover:bg-red-800`}>
                        Confirm reject
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRejecting(null);
                          setReasonError(null);
                        }}
                        className={`${buttonClass} min-h-[44px] border border-slate-300 bg-white text-brand-navy`}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => decide(o.id, "approve")} className={`${buttonClass} min-h-[44px] bg-green-700 text-white hover:bg-green-800`}>
                      Approve
                    </button>
                    <button type="button" onClick={() => setRejecting(o.id)} className={`${buttonClass} min-h-[44px] border border-red-300 bg-white text-red-800 hover:bg-red-50`}>
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ) : (
              o.decidedAt && <p className="mt-3 text-xs text-slate-500">Decided {fmtDate(o.decidedAt)}</p>
            )}
          </Card>
        ))}
        {data && data.items.length === 0 && <Card>No offers {status === "PENDING" ? "waiting" : "yet"}.</Card>}
      </div>
      {data && <Pager page={data.page} total={data.total} pageSize={data.pageSize} onPage={setPageNo} />}
    </div>
  );
}
