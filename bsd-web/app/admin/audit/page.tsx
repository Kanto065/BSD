"use client";

import Link from "next/link";
import { useState } from "react";
import { EmptyState, ErrorNote, PageTitle, Pager, SkeletonRows, fmtDate, tableClass, tableWrapClass, theadClass, useAdminData } from "@/components/admin/ui";

type Entry = { id: string; action: string; entityType: string; entityId: string; details: unknown; createdAt: string; admin: { name: string; email: string } };

// Every admin action, newest first. Read-only.
export default function AuditPage() {
  const [pageNo, setPageNo] = useState(1);
  const { data, error, loading } = useAdminData<{ items: Entry[]; total: number; page: number; pageSize: number }>(`/audit-log?page=${pageNo}&pageSize=50`);

  return (
    <div>
      <PageTitle sub="Every action taken in the admin panel, newest first.">Audit log</PageTitle>
      <ErrorNote error={error} />
      <div className={tableWrapClass}>
        <table className={tableClass}>
          <thead className={theadClass}>
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Who</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Record</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && !data && <SkeletonRows cols={4} />}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={4}>
                  <EmptyState title="No actions yet">Every approval, rejection and change made in the admin panel is recorded here.</EmptyState>
                </td>
              </tr>
            )}
            {data?.items.map((e) => (
              <tr key={e.id}>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{fmtDate(e.createdAt)}</td>
                <td className="px-4 py-3">{e.admin.name}</td>
                <td className="px-4 py-3 font-mono text-xs">{e.action}</td>
                <td className="px-4 py-3">
                  {e.entityType === "Business" ? (
                    <Link href={`/admin/listings/${e.entityId}`} className="text-brand-teal-dark hover:underline">
                      Listing
                    </Link>
                  ) : (
                    <span className="text-slate-600">{e.entityType}</span>
                  )}
                  {e.details ? <p className="max-w-md truncate text-xs text-slate-500">{JSON.stringify(e.details)}</p> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data && <Pager page={data.page} total={data.total} pageSize={data.pageSize} onPage={setPageNo} />}
    </div>
  );
}
