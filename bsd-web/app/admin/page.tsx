"use client";

import Link from "next/link";
import { ArrowUpRight, BadgeCheck, CheckCircle2, ClipboardList, FilePen, Inbox, MessageSquare, Siren, Trash2 } from "lucide-react";
import { atLeast, useSession } from "@/lib/admin-session";
import { ErrorNote, PageTitle, Skeleton, useAdminData } from "@/components/admin/ui";

type Dashboard = {
  listings: Record<"PENDING" | "APPROVED" | "REJECTED" | "REMOVED", number>;
  approvedThisWeek: number;
  verificationQueue: number;
  pendingClaims: number;
  openMessages: number;
  pendingUpdates: number;
  pendingRemovals: number;
  emergencyRemovals: number;
};

type Queue = { label: string; value: number; href: string; icon: typeof Inbox; urgent?: boolean };

/** A work queue. Tinted when something is waiting so the eye goes to it first. */
function QueueTile({ label, value, href, icon: Icon, urgent }: Queue) {
  const waiting = value > 0;
  const tone = urgent && waiting ? "border-red-200 bg-red-50" : waiting ? "border-amber-200 bg-amber-50/60" : "border-slate-200 bg-white";
  const iconTone = urgent && waiting ? "bg-red-100 text-red-700" : waiting ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-500";
  return (
    <Link
      href={href}
      className={`group flex flex-col justify-between rounded-xl border p-5 shadow-[0_1px_2px_rgba(12,46,66,0.05)] transition hover:-translate-y-0.5 hover:border-brand-blue hover:shadow-md active:translate-y-0 ${tone}`}
    >
      <div className="flex items-start justify-between">
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconTone}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <ArrowUpRight className="h-4 w-4 text-slate-400 transition group-hover:text-brand-blue" aria-hidden="true" />
      </div>
      <div className="mt-4">
        <p className="text-3xl font-bold tabular-nums text-brand-navy">{value}</p>
        <p className="mt-1 text-sm font-medium text-slate-700">{label}</p>
      </div>
    </Link>
  );
}

/** A directory total. Plain figures, no card, since nothing here needs action. */
function Stat({ label, value, href }: { label: string; value: number; href?: string }) {
  const body = (
    <>
      <p className="text-2xl font-bold tabular-nums text-brand-navy">{value}</p>
      <p className="mt-0.5 text-sm text-slate-600">{label}</p>
    </>
  );
  return href ? (
    <Link href={href} className="block rounded-lg px-4 py-3 transition hover:bg-slate-50">
      {body}
    </Link>
  ) : (
    <div className="px-4 py-3">{body}</div>
  );
}

export default function AdminDashboard() {
  const { admin } = useSession();
  const { data, error } = useAdminData<Dashboard>("/dashboard");
  const mod = atLeast(admin?.role, "MODERATOR");
  const firstName = admin?.name.split(/\s+/)[0];

  const emergencies = mod && data ? data.emergencyRemovals : 0;
  const queues: Queue[] = data
    ? [
        ...(mod ?[{ label: "Waiting for review", value: data.listings.PENDING, href: "/admin/listings?status=PENDING", icon: ClipboardList }] : []),
        { label: "Awaiting verification", value: data.verificationQueue, href: "/admin/verification", icon: BadgeCheck },
        ...(mod
          ? [
              { label: "Update requests", value: data.pendingUpdates, href: "/admin/requests", icon: FilePen },
              { label: "Removal requests", value: data.pendingRemovals, href: "/admin/requests?type=removal", icon: Trash2 },
              { label: "Pending claims", value: data.pendingClaims, href: "/admin/claims", icon: Inbox },
              { label: "Open messages", value: data.openMessages, href: "/admin/messages", icon: MessageSquare },
            ]
          : []),
      ]
    : [];
  const waiting = queues.reduce((sum, q) => sum + q.value, 0) + emergencies;

  return (
    <div>
      <PageTitle sub={data ? (waiting > 0 ? `${waiting} item${waiting === 1 ? "" : "s"} waiting across your queues.` : "Nothing is waiting right now.") : undefined}>
        {firstName ? `Welcome back, ${firstName}` : "Dashboard"}
      </PageTitle>
      <ErrorNote error={error} />

      {emergencies > 0 && (
        <Link
          href="/admin/requests?type=removal"
          className="mb-6 flex items-center gap-4 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-red-900 transition hover:border-red-300 hover:bg-red-100/70"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-700">
            <Siren className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="flex-1">
            <span className="block font-semibold">
              {emergencies} emergency removal{emergencies === 1 ? "" : "s"} waiting
            </span>
            <span className="block text-sm text-red-800">These must be handled within 24 hours.</span>
          </span>
          <ArrowUpRight className="h-5 w-5 shrink-0" aria-hidden="true" />
        </Link>
      )}

      <section aria-labelledby="queues-heading">
        <h2 id="queues-heading" className="mb-3 text-sm font-semibold text-slate-700">
          Needs attention
        </h2>
        {!data && !error ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: mod ? 6 : 1 }, (_, i) => (
              <Skeleton key={i} className="h-36 w-full rounded-xl" />
            ))}
          </div>
        ) : data && waiting === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
            <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
            All clear. Every queue is empty.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {queues.map((q) => (
              <QueueTile key={q.label} {...q} />
            ))}
          </div>
        )}
      </section>

      {data && (
        <section aria-labelledby="directory-heading" className="mt-10">
          <h2 id="directory-heading" className="mb-3 text-sm font-semibold text-slate-700">
            Directory
          </h2>
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-[0_1px_2px_rgba(12,46,66,0.05)] sm:grid-cols-4">
            <Stat label="Approved (live)" value={data.listings.APPROVED} href={mod ? "/admin/listings?status=APPROVED" : undefined} />
            <Stat label="Approved this week" value={data.approvedThisWeek} />
            {mod && <Stat label="Rejected" value={data.listings.REJECTED} href="/admin/listings?status=REJECTED" />}
            {mod && <Stat label="Removed" value={data.listings.REMOVED} href="/admin/listings?status=REMOVED" />}
          </div>
        </section>
      )}
    </div>
  );
}
