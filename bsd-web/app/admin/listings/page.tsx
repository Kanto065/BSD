"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { X } from "lucide-react";
import VerificationBadge, { type VerificationStatus } from "@/components/VerificationBadge";
import { EmptyState, ErrorNote, PageTitle, Pager, SkeletonRows, StatusPill, fmtDate, inputClass, tableClass, tableWrapClass, theadClass, useAdminData } from "@/components/admin/ui";

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
type Result = {
  items: Row[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<string, number>;
  subcategory?: { id: string; name: string; category: { name: string } } | null;
};

const TABS = ["PENDING", "APPROVED", "REJECTED", "REMOVED"] as const;
const TAB_LABEL = { PENDING: "Waiting for review", APPROVED: "Approved", REJECTED: "Rejected", REMOVED: "Removed" };

function Listings() {
  const params = useSearchParams();
  const router = useRouter();
  const status = (TABS as readonly string[]).includes(params.get("status") ?? "") ? params.get("status")! : "PENDING";
  const q = params.get("q") ?? "";
  const pageNo = Number(params.get("page") ?? 1) || 1;
  const sub = params.get("subcategory") ?? "";
  const [search, setSearch] = useState(q);

  // A subcategory filter arrives from the Categories page and stays on while switching tabs, searching or paging.
  const keep = { ...(q ? { q } : {}), ...(sub ? { subcategory: sub } : {}) };
  const qs = new URLSearchParams({ status, page: String(pageNo), pageSize: "25", ...keep });
  const { data, error, loading } = useAdminData<Result>(`/listings?${qs}`);
  const go = (next: Record<string, string>) => {
    const merged: Record<string, string> = { status, ...keep, ...next };
    for (const k of Object.keys(merged)) if (merged[k] === "") delete merged[k];
    router.push(`/admin/listings?${new URLSearchParams(merged)}`);
  };

  return (
    <div>
      <PageTitle>Listings</PageTitle>
      {sub && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-600">Showing</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-teal/10 py-1 pl-3 pr-1 font-semibold text-brand-teal-dark">
            {data?.subcategory ? `${data.subcategory.name} in ${data.subcategory.category.name}` : "one subcategory"}
            <button
              type="button"
              onClick={() => go({ subcategory: "", page: "1" })}
              className="rounded-full p-0.5 hover:bg-brand-teal/20"
              title="Show every listing"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only">Remove the subcategory filter</span>
            </button>
          </span>
          <Link href="/admin/categories" className="text-brand-teal-dark hover:underline">
            Back to categories
          </Link>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => go({ status: t, page: "1" })}
            aria-pressed={t === status}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition active:scale-[0.98] ${
              t === status ? "bg-brand-navy text-white shadow-sm" : "bg-white text-slate-700 ring-1 ring-inset ring-slate-200 hover:ring-brand-blue"
            }`}
          >
            {TAB_LABEL[t]}
            {data?.counts[t] !== undefined && <span className={`rounded-full px-1.5 text-xs tabular-nums ${t === status ? "bg-white/20" : "bg-slate-100 text-slate-600"}`}>{data.counts[t]}</span>}
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
      <div className={`mt-2 ${tableWrapClass}`}>
        <table className={tableClass}>
          <thead className={theadClass}>
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
              <tr key={r.id} className="transition hover:bg-slate-50/80">
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
                      <VerificationBadge status={r.verificationStatus} size="sm" />
                    </div>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{fmtDate(r.submittedAt)}</td>
              </tr>
            ))}
            {loading && !data && <SkeletonRows cols={5} />}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <EmptyState title={q ? "No listings match that search" : "Nothing here"}>{q ? "Try a different name, postcode, phone or email." : "Listings with this status will appear here."}</EmptyState>
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
