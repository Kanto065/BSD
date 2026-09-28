"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { ApiError, useSession } from "@/lib/admin-session";

// Small building blocks shared by the admin pages.
// Shape rule for the whole admin area: controls (inputs, buttons) are rounded-lg, panels are rounded-xl, pills are full.

export const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-500 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20";
export const buttonClass =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60";

// Tables share one look: a panel with a quiet header row and light dividers between rows.
export const tableWrapClass = "overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(12,46,66,0.05)]";
export const tableClass = "w-full text-left text-sm";
export const theadClass = "border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600";

export function Card({ title, children, actions }: { title?: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(12,46,66,0.05)] sm:p-6">
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-base font-bold text-brand-navy">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageTitle({ children, sub, actions }: { children: React.ReactNode; sub?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-brand-navy">{children}</h1>
        {sub && <p className="mt-1 max-w-[70ch] text-sm leading-relaxed text-slate-600">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof ApiError ? error.message : "Something went wrong. Please try again.";
  return (
    <p role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}

/** A grey placeholder block shown while data loads, sized like the content it stands in for. */
export function Skeleton({ className = "h-4 w-full" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-slate-200/80 motion-reduce:animate-none ${className}`} />;
}

/** Placeholder rows for a table while its data loads. */
export function SkeletonRows({ rows = 5, cols }: { rows?: number; cols: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }, (_, c) => (
            <td key={c} className="px-4 py-4">
              <Skeleton className={c === 0 ? "h-4 w-40" : "h-4 w-24"} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <Inbox className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="mt-3 font-semibold text-brand-navy">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-slate-600">{children}</p>}
    </div>
  );
}

export function Pager({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const step = `${buttonClass} border border-slate-300 bg-white px-3 text-slate-700 hover:bg-slate-50`;
  return (
    <nav aria-label="Pages" className="mt-4 flex items-center justify-between gap-3 text-sm">
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className={step}>
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Previous
      </button>
      <span className="text-slate-600">
        Page <strong className="font-semibold text-slate-900">{page}</strong> of {pages}
        <span className="hidden sm:inline"> ({total} in total)</span>
      </span>
      <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} className={step}>
        Next <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </nav>
  );
}

export const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

/** Loads admin data for a page and lets it reload after an action. */
export function useAdminData<T>(path: string | null) {
  const { api } = useSession();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      setData(await api<T>(path));
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [api, path]);
  useEffect(() => {
    void load();
  }, [load]);
  return { data, error, loading, reload: load };
}

export const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-900 ring-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  REJECTED: "bg-red-50 text-red-800 ring-red-200",
  REMOVED: "bg-slate-100 text-slate-700 ring-slate-200",
};

export function StatusPill({ status }: { status: string }) {
  const label = status.charAt(0) + status.slice(1).toLowerCase();
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${STATUS_STYLE[status] ?? "bg-slate-100 text-slate-700 ring-slate-200"}`}>
      {label}
    </span>
  );
}
