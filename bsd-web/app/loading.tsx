// Shown straight away while a page loads its data, so a tap on a link always responds, even on a slow mobile connection.
export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="mx-auto max-w-6xl animate-pulse px-4 py-12 sm:px-6 sm:py-16">
      <span className="sr-only">Loading…</span>
      <div className="h-8 w-2/3 max-w-sm rounded bg-slate-200" />
      <div className="mt-4 h-4 w-full max-w-xl rounded bg-slate-100" />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-48 rounded-xl border border-slate-200 bg-slate-50" />
        ))}
      </div>
    </div>
  );
}
