"use client";

import Link from "next/link";
import { atLeast, useSession } from "@/lib/admin-session";
import { ErrorNote, PageTitle, useAdminData } from "@/components/admin/ui";

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

function Tile({ label, value, href, highlight }: { label: string; value: number; href?: string; highlight?: boolean }) {
  const body = (
    <>
      <p className="text-sm text-slate-600">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${highlight && value > 0 ? "text-amber-700" : "text-brand-navy"}`}>{value}</p>
    </>
  );
  const cls = "block rounded-xl border border-slate-200 bg-white p-5";
  return href ? (
    <Link href={href} className={`${cls} hover:border-brand-blue`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export default function AdminDashboard() {
  const { admin } = useSession();
  const { data, error } = useAdminData<Dashboard>("/dashboard");
  const mod = atLeast(admin?.role, "MODERATOR");

  return (
    <div>
      <PageTitle sub={`Signed in as ${admin?.name}.`}>Dashboard</PageTitle>
      <ErrorNote error={error} />
      {data && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Tile label="Waiting for review" value={data.listings.PENDING} href={mod ? "/admin/listings?status=PENDING" : undefined} highlight />
          <Tile label="Awaiting verification" value={data.verificationQueue} href="/admin/verification" highlight />
          <Tile label="Approved (live)" value={data.listings.APPROVED} href={mod ? "/admin/listings?status=APPROVED" : undefined} />
          <Tile label="Approved this week" value={data.approvedThisWeek} />
          {mod && data.emergencyRemovals > 0 && <Tile label="Emergency removals (24 hours)" value={data.emergencyRemovals} href="/admin/requests?type=removal" highlight />}
          {mod && <Tile label="Update requests" value={data.pendingUpdates} href="/admin/requests" highlight />}
          {mod && <Tile label="Removal requests" value={data.pendingRemovals} href="/admin/requests?type=removal" highlight />}
          {mod && <Tile label="Pending claims" value={data.pendingClaims} href="/admin/claims" highlight />}
          {mod && <Tile label="Open messages" value={data.openMessages} href="/admin/messages" highlight />}
          {mod && <Tile label="Rejected" value={data.listings.REJECTED} href="/admin/listings?status=REJECTED" />}
          {mod && <Tile label="Removed" value={data.listings.REMOVED} href="/admin/listings?status=REMOVED" />}
        </div>
      )}
    </div>
  );
}
