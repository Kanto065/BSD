"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { useSession } from "@/lib/admin-session";
import { Card, ErrorNote, PageTitle, Pager, buttonClass, fmtDate, inputClass, useAdminData } from "@/components/admin/ui";

type Claim = {
  id: string;
  status: string;
  claimantName: string;
  claimantEmail: string;
  claimantPhone: string | null;
  proofText: string;
  proofFileUrl: string | null;
  proofType: string | null;
  hasProof: boolean;
  decisionNote: string | null;
  linkedOwner: boolean;
  createdAt: string;
  reviewedAt: string | null;
  business: { id: string; name: string; slug: string; status: string; owner: { name: string; email: string | null } | null };
  reviewedBy: { name: string } | null;
  user: { name: string; email: string | null; postcode: string } | null;
};

// The private document is fetched with the admin token and shown from an in-memory blob URL, so there is no address
// that works anywhere else. The URL is dropped as soon as the preview closes. Every open is audited by the API.
function Proof({ id, type }: { id: string; type: string }) {
  const { api } = useSession();
  const [url, setUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!open) return;
    let made: string | null = null;
    let cancelled = false;
    api<Blob>(`/claims/${id}/proof`, { blob: true })
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
      {url && type === "application/pdf" && <iframe src={url} sandbox="" title="Claim document" className="h-[28rem] w-full rounded-lg border border-slate-200" />}
      {url && type !== "application/pdf" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="Claim document" onContextMenu={(e) => e.preventDefault()} className="max-h-[28rem] max-w-full rounded-lg border border-slate-200" />
      )}
      {!url && !error && <p className="text-sm text-slate-600">Loading the file...</p>}
      <button type="button" onClick={() => setOpen(false)} className={`${buttonClass} mt-2 min-h-[44px] border border-slate-300 bg-white text-brand-navy hover:bg-slate-50`}>
        Close preview
      </button>
    </div>
  );
}

const fieldClass = `${inputClass.replace("text-sm", "text-base sm:text-sm")} min-h-[44px]`;

// "Claim This Listing" requests. A signed in member sends written evidence and maybe a document. The admin reads it,
// and approving can make the member the owner of the listing in the same step. No email goes out.
export default function ClaimsPage() {
  const { api } = useSession();
  const [status, setStatus] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [pageNo, setPageNo] = useState(1);
  const { data, error, reload } = useAdminData<{ items: Claim[]; total: number; page: number; pageSize: number }>(`/claims?status=${status}&page=${pageNo}`);
  const [actionError, setActionError] = useState<unknown>(null);
  const [link, setLink] = useState<Record<string, boolean>>({});
  const [replace, setReplace] = useState<Record<string, boolean>>({});
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function decide(c: Claim, decision: "approve" | "reject") {
    setActionError(null);
    try {
      const body = decision === "approve" ? { linkOwner: c.user ? (link[c.id] ?? true) : false, replaceOwner: replace[c.id] ?? false } : { note: notes[c.id] ?? "" };
      await api(`/claims/${c.id}/${decision}`, { method: "PATCH", body });
      setRejecting(null);
      await reload();
    } catch (e) {
      setActionError(e);
    }
  }

  return (
    <div>
      <PageTitle sub="Requests from people who say a listing is theirs. Read the evidence before approving.">Claims</PageTitle>
      <p role="note" className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        Do not copy a claim document anywhere. It is deleted automatically.
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        {(["PENDING", "APPROVED", "REJECTED"] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={s === status}
            onClick={() => {
              setStatus(s);
              setPageNo(1);
            }}
            className={`min-h-[44px] rounded-full px-4 py-1.5 text-sm font-semibold ${s === status ? "bg-brand-navy text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}
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
            <p className="mt-1 text-sm text-slate-600">
              Current owner: {c.business.owner ? `${c.business.owner.name}${c.business.owner.email ? ` (${c.business.owner.email})` : ""}` : "none"}
            </p>
            <p className="mt-2 break-words font-semibold text-brand-navy">
              {c.claimantName} · {c.claimantEmail}
              {c.claimantPhone ? ` · ${c.claimantPhone}` : ""}
            </p>
            <p className="text-xs text-slate-500">{c.user ? `Member account, postcode ${c.user.postcode || "not given"}` : "No member account (sent before sign in was needed)"}</p>
            <p className="mt-2 whitespace-pre-line break-words text-sm text-slate-700">{c.proofText}</p>
            {c.hasProof && c.proofType ? (
              <div className="mt-3">
                <Proof id={c.id} type={c.proofType} />
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">{c.user ? (c.status === "PENDING" ? "No file" : "No file, or deleted") : "No file"}</p>
            )}
            {c.proofFileUrl && (
              <a href={c.proofFileUrl} target="_blank" rel="noopener" className="mt-2 inline-flex min-h-[44px] items-center text-sm font-semibold text-brand-teal-dark hover:underline">
                Open the proof file
              </a>
            )}
            {c.status === "PENDING" ? (
              <div className="mt-4 space-y-3">
                {c.user && (
                  <div className="space-y-1">
                    <label className="flex min-h-[44px] items-center gap-2 text-sm text-slate-800">
                      <input type="checkbox" checked={link[c.id] ?? true} onChange={(e) => setLink({ ...link, [c.id]: e.target.checked })} className="h-5 w-5 accent-brand-blue" />
                      Link this member as owner
                    </label>
                    {c.business.owner && (
                      <label className="flex min-h-[44px] items-center gap-2 text-sm text-slate-800">
                        <input type="checkbox" checked={replace[c.id] ?? false} onChange={(e) => setReplace({ ...replace, [c.id]: e.target.checked })} className="h-5 w-5 accent-brand-blue" />
                        Replace existing owner
                      </label>
                    )}
                  </div>
                )}
                {rejecting === c.id ? (
                  <div>
                    <label htmlFor={`note-${c.id}`} className="text-sm font-semibold text-slate-800">
                      Reason shown to the member
                    </label>
                    <p className="text-xs text-slate-600">Do not include personal data. The member sees this text as written.</p>
                    <input id={`note-${c.id}`} value={notes[c.id] ?? ""} maxLength={300} onChange={(e) => setNotes({ ...notes, [c.id]: e.target.value })} className={fieldClass} />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button type="button" onClick={() => decide(c, "reject")} className={`${buttonClass} min-h-[44px] bg-red-700 text-white hover:bg-red-800`}>
                        Confirm reject
                      </button>
                      <button type="button" onClick={() => setRejecting(null)} className={`${buttonClass} min-h-[44px] border border-slate-300 bg-white text-brand-navy`}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => decide(c, "approve")} className={`${buttonClass} min-h-[44px] bg-green-700 text-white hover:bg-green-800`}>
                      Approve claim
                    </button>
                    <button type="button" onClick={() => setRejecting(c.id)} className={`${buttonClass} min-h-[44px] border border-red-300 bg-white text-red-800 hover:bg-red-50`}>
                      Reject claim
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-500">
                {c.status.toLowerCase()} by {c.reviewedBy?.name} on {fmtDate(c.reviewedAt)}
                {c.linkedOwner ? ", member linked as owner" : ""}
                {c.decisionNote ? `. Note: ${c.decisionNote}` : ""}
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
