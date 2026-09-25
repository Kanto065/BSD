"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useSession } from "@/lib/admin-session";
import { Card, ErrorNote, PageTitle, Pager, buttonClass, fmtDate, inputClass, useAdminData } from "@/components/admin/ui";

type Base = {
  id: string;
  status: string;
  requestedAt: string;
  requesterName: string | null;
  requesterEmail: string | null;
  requesterPhone: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  business: { id: string; name: string; slug: string; status: string };
  reviewedBy: { name: string } | null;
};
type UpdateReq = Base & { requestedChanges: { message?: string } };
type RemovalReq = Base & { reason: string | null; isEmergency: boolean };

// Working days since the request, for the 3-7 working day target (weekends not counted).
function workingDaysSince(iso: string): number {
  let days = 0;
  const d = new Date(iso);
  const now = new Date();
  while (d < now) {
    d.setDate(d.getDate() + 1);
    if (d <= now && d.getDay() !== 0 && d.getDay() !== 6) days++;
  }
  return days;
}

function Age({ iso, emergency }: { iso: string; emergency?: boolean }) {
  const hours = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (emergency) {
    const late = hours > 24;
    return <span className={`text-xs font-semibold ${late ? "text-red-700" : "text-amber-800"}`}>{Math.floor(hours)} h old{late ? ", past the 24-hour target" : ""}</span>;
  }
  const wd = workingDaysSince(iso);
  return <span className={`text-xs font-semibold ${wd > 7 ? "text-red-700" : wd >= 5 ? "text-amber-800" : "text-slate-500"}`}>{wd} working day{wd === 1 ? "" : "s"} waiting</span>;
}

function Requests() {
  const params = useSearchParams();
  const router = useRouter();
  const type = params.get("type") === "removal" ? "removal" : "update";
  const [status, setStatus] = useState("PENDING");
  const [pageNo, setPageNo] = useState(1);
  const { api } = useSession();
  const path = type === "removal" ? "/removal-requests" : "/update-requests";
  const { data, error, reload } = useAdminData<{ items: (UpdateReq | RemovalReq)[]; total: number; page: number; pageSize: number }>(`${path}?status=${status}&page=${pageNo}`);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<unknown>(null);

  const decide = async (id: string, decision: string) => {
    setActionError(null);
    try {
      await api(`${path}/${id}`, { method: "PATCH", body: { status: decision, ...(notes[id] ? { note: notes[id] } : {}) } });
      await reload();
    } catch (e) {
      setActionError(e);
    }
  };
  const doneStatuses = type === "removal" ? ["REMOVED", "REJECTED"] : ["APPLIED", "REJECTED"];

  return (
    <div>
      <PageTitle sub="Targets: updates and removals within 3–7 working days, emergency removals within 24 hours.">Update & removal requests</PageTitle>
      <div className="mb-4 flex flex-wrap gap-2">
        {(["update", "removal"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setStatus("PENDING");
              setPageNo(1);
              router.push(`/admin/requests${t === "removal" ? "?type=removal" : ""}`);
            }}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${t === type ? "bg-brand-navy text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}
          >
            {t === "update" ? "Update requests" : "Removal requests"}
          </button>
        ))}
        <select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPageNo(1); }} className="ml-auto rounded-md border border-slate-300 bg-white px-2 py-1 text-sm">
          {["PENDING", ...doneStatuses].map((s) => (
            <option key={s} value={s}>
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      </div>
      <ErrorNote error={error ?? actionError} />
      <div className="space-y-3">
        {data?.items.map((r) => {
          const removal = type === "removal" ? (r as RemovalReq) : null;
          return (
            <Card key={r.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-brand-navy">
                    <Link href={`/admin/listings/${r.business.id}`} className="hover:underline">
                      {r.business.name}
                    </Link>{" "}
                    <span className="text-xs font-normal text-slate-500">({r.business.status.toLowerCase()})</span>
                  </p>
                  <p className="text-sm text-slate-600">
                    {r.requesterName} ·{" "}
                    <a href={`mailto:${r.requesterEmail}`} className="text-brand-teal-dark hover:underline">
                      {r.requesterEmail}
                    </a>
                    {r.requesterPhone ? ` · ${r.requesterPhone}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  {removal?.isEmergency && (
                    <p className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">
                      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Emergency
                    </p>
                  )}
                  <p className="text-xs text-slate-500">{fmtDate(r.requestedAt)}</p>
                  {r.status === "PENDING" && <Age iso={r.requestedAt} emergency={removal?.isEmergency} />}
                </div>
              </div>
              <p className="mt-3 whitespace-pre-line text-sm text-slate-800">
                {removal ? removal.reason || <span className="text-slate-400">No reason given</span> : (r as UpdateReq).requestedChanges?.message}
              </p>
              {r.status === "PENDING" ? (
                <div className="mt-3 space-y-2">
                  <input
                    aria-label="Note (optional, kept for the record)"
                    placeholder="Note (optional, kept for the record)"
                    value={notes[r.id] ?? ""}
                    onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                    className={inputClass}
                  />
                  <div className="flex flex-wrap gap-2">
                    {removal ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Remove "${r.business.name}" from the directory?`)) void decide(r.id, "REMOVED");
                        }}
                        className={`${buttonClass} bg-red-700 text-white hover:bg-red-800`}
                      >
                        Remove the listing
                      </button>
                    ) : (
                      <>
                        <Link href={`/admin/listings/${r.business.id}`} className={`${buttonClass} border border-slate-300 bg-white text-slate-700`}>
                          Open the listing to edit
                        </Link>
                        <button type="button" onClick={() => decide(r.id, "APPLIED")} className={`${buttonClass} bg-green-700 text-white hover:bg-green-800`}>
                          Mark as done
                        </button>
                      </>
                    )}
                    <button type="button" onClick={() => decide(r.id, "REJECTED")} className={`${buttonClass} border border-slate-300 bg-white text-slate-700`}>
                      Decline
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-xs text-slate-500">
                  {r.status.toLowerCase()} by {r.reviewedBy?.name} on {fmtDate(r.reviewedAt)}
                  {r.reviewNote ? `: ${r.reviewNote}` : ""}
                </p>
              )}
            </Card>
          );
        })}
        {data && data.items.length === 0 && <Card>Nothing here.</Card>}
      </div>
      {data && <Pager page={data.page} total={data.total} pageSize={data.pageSize} onPage={setPageNo} />}
    </div>
  );
}

export default function RequestsPage() {
  return (
    <Suspense>
      <Requests />
    </Suspense>
  );
}
