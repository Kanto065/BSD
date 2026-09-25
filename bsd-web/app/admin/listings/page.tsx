"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import VerificationBadge, { type VerificationStatus } from "@/components/VerificationBadge";
import { ErrorNote, PageTitle, Pager, StatusPill, fmtDate, inputClass, useAdminData } from "@/components/admin/ui";

type Row = {
  id: string;
  name: string;
  slug: string;
  status: string;
  verificationStatus: VerificationStatus;
  postcode: string;
  phone: string;
  submittedAt: string;
  category: { name: string };
  zone: { name: string };
  _count: { photos: number };
};
type Result = { items: Row[]; total: number; page: number; pageSize: number; counts: Record<string, number> };

const TABS = ["PENDING", "APPROVED", "REJECTED", "REMOVED"] as const;
const TAB_LABEL = { PENDING: "Waiting for review", APPROVED: "Approved", REJECTED: "Rejected", REMOVED: "Removed" };

function Listings() {
  const params = useSearchParams();
  const router = useRouter();
  const status = (TABS as readonly string[]).includes(params.get("status") ?? "") ? params.get("status")! : "PENDING";
  const q = params.get("q") ?? "";
  const pageNo = Number(params.get("page") ?? 1) || 1;
  const [search, setSearch] = useState(q);

  const qs = new URLSearchParams({ status, page: String(pageNo), pageSize: "25", ...(q ? { q } : {}) });
  const { data, error, loading } = useAdminData<Result>(`/listings?${qs}`);
  const go = (next: Record<string, string>) => router.push(`/admin/listings?${new URLSearchParams({ status, ...(q ? { q } : {}), ...next })}`);

  return (
    <div>
      <PageTitle>Listings</PageTitle>
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => go({ status: t, page: "1" })}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${t === status ? "bg-brand-navy text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-brand-blue"}`}
          >
            {TAB_LABEL[t]} {data?.counts[t] !== undefined ? `(${data.counts[t]})` : ""}
          </button>
        ))}
        <form
          className="ml-auto w-full sm:w-72"
          onSubmit={(e) => {
            e.preventDefault();
            go({ q: search, page: "1" });
          }}
        >
          <label htmlFor="q" className="sr-only">
            Search listings
          </label>
          <input id="q" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, postcode, phone, email" className={inputClass} />
        </form>
      </div>

      <div className="mt-4">
        <ErrorNote error={error} />
      </div>
      <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Listing</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Area</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Submitted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data?.items.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/admin/listings/${r.id}`} className="font-semibold text-brand-navy hover:text-brand-blue hover:underline">
                    {r.name}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {r.phone}
                    {r._count.photos ? ` · ${r._count.photos} image${r._count.photos > 1 ? "s" : ""}` : ""}
                  </p>
                </td>
                <td className="px-4 py-3 text-slate-700">{r.category.name}</td>
                <td className="px-4 py-3 text-slate-700">
                  {r.postcode}
                  <p className="text-xs text-slate-500">{r.zone.name}</p>
                </td>
                <td className="space-y-1 px-4 py-3">
                  <StatusPill status={r.status} />
                  {r.status === "APPROVED" && (
                    <div>
                      <VerificationBadge status={r.verificationStatus} className="!px-2 !py-0.5 !text-xs" />
                    </div>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{fmtDate(r.submittedAt)}</td>
              </tr>
            ))}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  {loading ? "Loading" : "Nothing here."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {data && <Pager page={data.page} total={data.total} pageSize={data.pageSize} onPage={(p) => go({ page: String(p) })} />}
    </div>
  );
}

export default function ListingsPage() {
  return (
    <Suspense>
      <Listings />
    </Suspense>
  );
}
