import Link from "next/link";

const cls = "inline-flex min-h-11 items-center rounded-full border border-slate-300 bg-white px-5 text-sm font-semibold text-bc-shell hover:border-bc-bar";

/** Previous and Next links for a result page. `href(page)` builds the address. */
export default function Pager({ page, pageSize, total, href }: { page: number; pageSize: number; total: number; href: (p: number) => string }) {
  const last = Math.max(1, Math.ceil(total / pageSize));
  if (last <= 1) return null;
  return (
    <nav aria-label="Pages" className="mt-6 flex items-center justify-between gap-3">
      {page > 1 ? <Link href={href(page - 1)} className={cls}>Previous</Link> : <span />}
      <p className="text-sm text-slate-600">Page {page} of {last}</p>
      {page < last ? <Link href={href(page + 1)} className={cls}>Next</Link> : <span />}
    </nav>
  );
}
