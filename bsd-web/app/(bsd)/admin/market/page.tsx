"use client";

import { useState } from "react";
import { useSession } from "@/lib/admin-session";
import { Card, ErrorNote, PageTitle, Pager, buttonClass, fmtDate, inputClass, useAdminData } from "@/components/admin/ui";

// Marketplace admin (M12-D): review queue, reports, support tickets, safe exchange spots and category staging.
// The API is bsd-api admin.market.ts. Every action there is audited.

type Item = {
  id: string; slug: string; title: string; description: string; kind: string; status: string; pricePence: number | null; postcode: string;
  hideFullAddress: boolean; reportCount: number; createdAt: string; removalReason: string | null; category: { name: string };
  owner: { id: string; name: string; email: string }; reports: { reason: string; note: string | null; createdAt: string }[];
};
type TicketRow = { id: string; number: string; category: string; message: string; status: string; adminReply: string | null; createdAt: string; user: { name: string; email: string }; listing: { slug: string; title: string } | null };
type Spot = { id: string; name: string; address: string; postcodeDistrict: string; active: boolean };
type Cat = { id: string; name: string; staged: boolean };
type Paged<T> = { items: T[]; total: number; page: number; pageSize: number };

const TABS = ["Queue", "Tickets", "Spots", "Categories"] as const;
const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
const ghost = `${buttonClass} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;
const solid = `${buttonClass} bg-brand-navy text-white hover:bg-brand-navy/90`;

function useAct(reload: () => Promise<void>) {
  const { api } = useSession();
  const [error, setError] = useState<unknown>(null);
  const act = async (path: string, method: string, body?: unknown) => {
    try {
      await api(path, { method, body });
      setError(null);
      await reload();
    } catch (e) {
      setError(e);
    }
  };
  return { error, act };
}

function Queue() {
  const [filter, setFilter] = useState("all");
  const [pageNo, setPageNo] = useState(1);
  const { data, error, reload } = useAdminData<Paged<Item>>(`/market/queue?filter=${filter}&page=${pageNo}`);
  const a = useAct(reload);
  return (
    <div>
      <div className="mb-4 flex gap-2">
        {["all", "pending", "reported"].map((f) => (
          <button key={f} type="button" onClick={() => { setFilter(f); setPageNo(1); }} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${f === filter ? "bg-brand-navy text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
      <ErrorNote error={error ?? a.error} />
      <div className="space-y-3">
        {data?.items.map((l) => (
          <Card key={l.id}>
            <p className="text-sm text-slate-600">{l.status} · {l.category.name} · {fmtDate(l.createdAt)}</p>
            <p className="mt-1 font-semibold text-brand-navy">{l.title}{l.pricePence !== null && ` · £${(l.pricePence / 100).toFixed(2)}`}</p>
            <p className="text-sm text-slate-600">{l.owner.name} · {l.owner.email} · {l.postcode}{l.hideFullAddress && " (hidden from the public)"}</p>
            <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{l.description}</p>
            {l.reports.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-sm text-amber-900">
                {l.reports.map((r, i) => <li key={i}>{r.reason}{r.note && ` (${r.note})`}</li>)}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {l.status === "PENDING" && <button type="button" onClick={() => a.act(`/market/listings/${l.id}/approve`, "POST")} className={solid}>Approve</button>}
              {l.status !== "REMOVED" && (
                <button type="button" className={ghost} onClick={() => { const reason = window.prompt("Reason shown to the member"); if (reason) void a.act(`/market/listings/${l.id}/remove`, "POST", { reason }); }}>Remove</button>
              )}
              {l.status === "REMOVED" && <button type="button" onClick={() => a.act(`/market/listings/${l.id}/restore`, "POST")} className={ghost}>Restore</button>}
              <button type="button" className={ghost} onClick={() => { const reason = window.prompt(`Remove every listing by ${l.owner.name}? Reason shown to the member`); if (reason) void a.act(`/market/users/${l.owner.id}/remove-listings`, "POST", { reason }); }}>Remove all by this member</button>
            </div>
          </Card>
        ))}
        {data && data.items.length === 0 && <Card>Nothing waiting.</Card>}
      </div>
      {data && <Pager page={data.page} total={data.total} pageSize={data.pageSize} onPage={setPageNo} />}
    </div>
  );
}

function TicketCard({ t, act }: { t: TicketRow; act: (path: string, method: string, body?: unknown) => Promise<void> }) {
  const [reply, setReply] = useState(t.adminReply ?? "");
  return (
    <Card>
      <p className="text-sm text-slate-600">{t.number} · {t.category} · {fmtDate(t.createdAt)} · {t.status}</p>
      <p className="mt-1 font-semibold text-brand-navy">{t.user.name} · {t.user.email}</p>
      {t.listing && <p className="text-sm text-slate-600">About {t.listing.title}</p>}
      <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{t.message}</p>
      <label className="mt-3 block text-sm font-medium">Reply (the member sees it on screen, no email is sent)
        <textarea className={inputClass} rows={3} value={reply} onChange={(e) => setReply(e.target.value)} />
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" disabled={!reply.trim()} onClick={() => act(`/market/tickets/${t.id}`, "PATCH", { adminReply: reply })} className={solid}>Send reply</button>
        {STATUSES.filter((s) => s !== t.status).map((s) => <button key={s} type="button" onClick={() => act(`/market/tickets/${t.id}`, "PATCH", { status: s })} className={ghost}>Mark {s.replace("_", " ").toLowerCase()}</button>)}
      </div>
    </Card>
  );
}

function Tickets() {
  const [status, setStatus] = useState("OPEN");
  const [pageNo, setPageNo] = useState(1);
  const { data, error, reload } = useAdminData<Paged<TicketRow>>(`/market/tickets?status=${status}&page=${pageNo}`);
  const a = useAct(reload);
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button key={s} type="button" onClick={() => { setStatus(s); setPageNo(1); }} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${s === status ? "bg-brand-navy text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}>
            {s.replace("_", " ").charAt(0) + s.replace("_", " ").slice(1).toLowerCase()}
          </button>
        ))}
      </div>
      <ErrorNote error={error ?? a.error} />
      <div className="space-y-3">
        {data?.items.map((t) => <TicketCard key={`${t.id}${t.status}`} t={t} act={a.act} />)}
        {data && data.items.length === 0 && <Card>No tickets here.</Card>}
      </div>
      {data && <Pager page={data.page} total={data.total} pageSize={data.pageSize} onPage={setPageNo} />}
    </div>
  );
}

function Spots() {
  const { data, error, reload } = useAdminData<{ spots: Spot[] }>("/market/spots");
  const a = useAct(reload);
  const [f, setF] = useState({ name: "", address: "", postcodeDistrict: "" });
  return (
    <div className="space-y-4">
      <ErrorNote error={error ?? a.error} />
      <Card title="Add a safe exchange spot">
        <form className="grid gap-3 sm:grid-cols-3" onSubmit={async (e) => { e.preventDefault(); await a.act("/market/spots", "POST", f); setF({ name: "", address: "", postcodeDistrict: "" }); }}>
          <label className="text-sm font-medium">Name<input className={inputClass} required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <label className="text-sm font-medium">Address<input className={inputClass} required value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></label>
          <label className="text-sm font-medium">Postcode district<input className={inputClass} required placeholder="SA1" value={f.postcodeDistrict} onChange={(e) => setF({ ...f, postcodeDistrict: e.target.value })} /></label>
          <div><button type="submit" className={solid}>Add spot</button></div>
        </form>
      </Card>
      {data?.spots.map((s) => (
        <Card key={s.id}>
          <p className="font-semibold text-brand-navy">{s.name} · {s.postcodeDistrict}{!s.active && " (off)"}</p>
          <p className="text-sm text-slate-600">{s.address}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" className={ghost} onClick={() => a.act(`/market/spots/${s.id}`, "PATCH", { active: !s.active })}>{s.active ? "Turn off" : "Turn on"}</button>
            <button type="button" className={ghost} onClick={() => { if (window.confirm("Delete this spot?")) void a.act(`/market/spots/${s.id}`, "DELETE"); }}>Delete</button>
          </div>
        </Card>
      ))}
      {data && data.spots.length === 0 && <Card>No spots yet. Sellers see the line about agreeing a public place by WhatsApp.</Card>}
    </div>
  );
}

function Categories() {
  const { data, error, reload } = useAdminData<{ categories: Cat[] }>("/market/categories");
  const a = useAct(reload);
  return (
    <div className="space-y-3">
      <ErrorNote error={error ?? a.error} />
      {data?.categories.map((c) => (
        <Card key={c.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-brand-navy">{c.name}{c.staged && " (hidden)"}</p>
            <button type="button" className={ghost} onClick={() => a.act(`/market/categories/${c.id}`, "PATCH", { staged: !c.staged })}>{c.staged ? "Show on the site" : "Hide from the site"}</button>
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function MarketAdminPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Queue");
  const { data: counts } = useAdminData<{ pending: number; reported: number; openTickets: number }>("/market/counts");
  const badge: Record<string, number | undefined> = { Queue: counts ? counts.pending + counts.reported : undefined, Tickets: counts?.openTickets };
  return (
    <div>
      <PageTitle sub="Review listings, answer support tickets and manage safe exchange spots and categories.">Market</PageTitle>
      <div role="tablist" aria-label="Market" className="mb-5 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`min-h-11 rounded-full px-4 text-sm font-semibold ${tab === t ? "bg-brand-navy text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}>
            {t}{badge[t] ? ` (${badge[t]})` : ""}
          </button>
        ))}
      </div>
      {tab === "Queue" && <Queue />}
      {tab === "Tickets" && <Tickets />}
      {tab === "Spots" && <Spots />}
      {tab === "Categories" && <Categories />}
    </div>
  );
}
