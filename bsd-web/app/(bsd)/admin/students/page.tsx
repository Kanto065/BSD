"use client";

import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { atLeast, useSession } from "@/lib/admin-session";
import { Card, ErrorNote, PageTitle, Pager, StatusPill, buttonClass, fmtDate, inputClass, useAdminData } from "@/components/admin/ui";

type Item = {
  id: string;
  userId: string;
  status: string;
  submittedAt: string;
  decidedAt: string | null;
  rejectionReason: string | null;
  proofType: string;
  note: string | null;
  hasProof: boolean;
  user: { name: string; email: string; postcode: string };
};

// The proof is fetched with the admin token and shown from an in-memory blob URL, so there is no address to copy
// that works anywhere else. The URL is dropped as soon as the preview closes.
function Proof({ id, type }: { id: string; type: string }) {
  const { api } = useSession();
  const [url, setUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!open) return;
    let made: string | null = null;
    let cancelled = false;
    api<Blob>(`/students/${id}/proof`, { blob: true })
      .then((b) => {
        if (cancelled) return;
        made = URL.createObjectURL(b);
        setUrl(made);
      })
      .catch((e) => !cancelled && setError(e));
    return () => {
      cancelled = true;
      if (made) URL.revokeObjectURL(made);
      setUrl(null);
    };
  }, [open, id, api]);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${buttonClass} min-h-[44px] border border-slate-300 bg-white text-brand-navy hover:bg-slate-50`}>
        View file
      </button>
    );
  }
  return (
    <div className="mt-2">
      <ErrorNote error={error} />
      {url && type === "application/pdf" && <iframe src={url} sandbox="" title="Student proof" className="h-[28rem] w-full rounded-lg border border-slate-200" />}
      {url && type !== "application/pdf" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="Student proof" onContextMenu={(e) => e.preventDefault()} className="max-h-[28rem] max-w-full rounded-lg border border-slate-200" />
      )}
      {!url && !error && <p className="text-sm text-slate-600">Loading the file...</p>}
      <button type="button" onClick={() => setOpen(false)} className={`${buttonClass} mt-2 min-h-[44px] border border-slate-300 bg-white text-brand-navy hover:bg-slate-50`}>
        Close preview
      </button>
    </div>
  );
}

export default function StudentsPage() {
  const { api, admin } = useSession();
  const [status, setStatus] = useState<"PENDING" | "ALL">("PENDING");
  const [pageNo, setPageNo] = useState(1);
  const allowed = atLeast(admin?.role, "MODERATOR");
  const { data, error, reload } = useAdminData<{ items: Item[]; total: number; page: number; pageSize: number }>(allowed ? `/students?status=${status}&page=${pageNo}` : null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);

  if (!allowed) return <Card>You do not have permission to see this page.</Card>;

  const decide = async (id: string, decision: "approve" | "reject") => {
    setActionError(null);
    try {
      await api(`/students/${id}/${decision}`, { method: "POST", body: decision === "reject" ? { reason: reasons[id] ?? "" } : undefined });
      setRejecting(null);
      await reload();
    } catch (e) {
      setActionError(e);
    }
  };

  return (
    <div>
      <PageTitle sub="Student card or enrolment letter checks. Approving gives the member the Student badge.">Students</PageTitle>
      <p role="note" className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        Do not copy this file anywhere. It is deleted automatically.
      </p>
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
            {s === "PENDING" ? "Waiting" : "All"}
          </button>
        ))}
      </div>
      <ErrorNote error={error ?? actionError} />
      <div className="space-y-4">
        {data?.items.map((r) => (
          <Card key={r.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-brand-navy">{r.user.name}</p>
                <p className="break-words text-sm text-slate-600">
                  {r.user.email} · {r.user.postcode}
                </p>
                <p className="mt-1 text-xs text-slate-500">Sent {fmtDate(r.submittedAt)}</p>
              </div>
              <StatusPill status={r.status} />
            </div>
            {r.note && <p className="mt-3 break-words text-sm text-slate-700">Note: {r.note}</p>}
            {r.rejectionReason && <p className="mt-3 break-words text-sm text-slate-700">Reason given: {r.rejectionReason}</p>}
            <div className="mt-3">{r.hasProof ? <Proof id={r.id} type={r.proofType} /> : <p className="text-sm text-slate-500">{r.status === "PENDING" ? "No file" : "file deleted"}</p>}</div>
            {r.status === "PENDING" ? (
              <div className="mt-4">
                {rejecting === r.id ? (
                  <div>
                    <label htmlFor={`reason-${r.id}`} className="text-sm font-semibold text-slate-800">
                      Reason shown to the member
                    </label>
                    <p className="text-xs text-slate-600">Do not include personal data. The member sees this text as written.</p>
                    <input
                      id={`reason-${r.id}`}
                      value={reasons[r.id] ?? ""}
                      maxLength={300}
                      onChange={(e) => setReasons({ ...reasons, [r.id]: e.target.value })}
                      className={`${inputClass.replace("text-sm", "text-base sm:text-sm")} min-h-[44px]`}
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button type="button" onClick={() => decide(r.id, "reject")} className={`${buttonClass} min-h-[44px] bg-red-700 text-white hover:bg-red-800`}>
                        Confirm reject
                      </button>
                      <button type="button" onClick={() => setRejecting(null)} className={`${buttonClass} min-h-[44px] border border-slate-300 bg-white text-brand-navy`}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => decide(r.id, "approve")} className={`${buttonClass} min-h-[44px] bg-green-700 text-white hover:bg-green-800`}>
                      Approve
                    </button>
                    <button type="button" onClick={() => setRejecting(r.id)} className={`${buttonClass} min-h-[44px] border border-red-300 bg-white text-red-800 hover:bg-red-50`}>
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ) : (
              r.decidedAt && <p className="mt-3 text-xs text-slate-500">Decided {fmtDate(r.decidedAt)}</p>
            )}
          </Card>
        ))}
        {data && data.items.length === 0 && <Card>No requests {status === "PENDING" ? "waiting" : "yet"}.</Card>}
      </div>
      {data && <Pager page={data.page} total={data.total} pageSize={data.pageSize} onPage={setPageNo} />}
    </div>
  );
}
