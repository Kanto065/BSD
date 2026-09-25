"use client";

import { useState } from "react";
import { useSession } from "@/lib/admin-session";
import { Card, ErrorNote, PageTitle, Pager, buttonClass, fmtDate, useAdminData } from "@/components/admin/ui";

type Message = { id: string; type: string; name: string; email: string; message: string; createdAt: string; status: string };

// Messages sent through the site's contact form. The form itself comes later; until then contact is by email.
export default function MessagesPage() {
  const { api } = useSession();
  const [status, setStatus] = useState<"OPEN" | "RESOLVED">("OPEN");
  const [pageNo, setPageNo] = useState(1);
  const { data, error, reload } = useAdminData<{ items: Message[]; total: number; page: number; pageSize: number }>(`/messages?status=${status}&page=${pageNo}`);
  const [actionError, setActionError] = useState<unknown>(null);

  return (
    <div>
      <PageTitle>Messages</PageTitle>
      <div className="mb-4 flex gap-2">
        {(["OPEN", "RESOLVED"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setStatus(s);
              setPageNo(1);
            }}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${s === status ? "bg-brand-navy text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}
          >
            {s === "OPEN" ? "Open" : "Resolved"}
          </button>
        ))}
      </div>
      <ErrorNote error={error ?? actionError} />
      <div className="space-y-3">
        {data?.items.map((m) => (
          <Card key={m.id}>
            <p className="text-sm text-slate-600">
              {m.type.toLowerCase()} · {fmtDate(m.createdAt)}
            </p>
            <p className="mt-1 font-semibold text-brand-navy">
              {m.name} ·{" "}
              <a href={`mailto:${m.email}`} className="text-brand-teal-dark hover:underline">
                {m.email}
              </a>
            </p>
            <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{m.message}</p>
            {m.status === "OPEN" && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await api(`/messages/${m.id}/resolve`, { method: "PATCH" });
                    await reload();
                  } catch (e) {
                    setActionError(e);
                  }
                }}
                className={`${buttonClass} mt-3 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}
              >
                Mark resolved
              </button>
            )}
          </Card>
        ))}
        {data && data.items.length === 0 && <Card>No {status === "OPEN" ? "open" : "resolved"} messages.</Card>}
      </div>
      {data && <Pager page={data.page} total={data.total} pageSize={data.pageSize} onPage={setPageNo} />}
    </div>
  );
}
