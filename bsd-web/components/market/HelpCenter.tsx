"use client";

import { useState } from "react";
import { HELP_ARTICLES, HELP_CATEGORIES, LEGAL_PENDING, helpSearch } from "@/lib/market-account";

// Help Center (M12-D): a search box and four accordion categories. The articles are client text, empty until supplied.

export default function HelpCenter() {
  const [q, setQ] = useState("");
  const found = helpSearch(HELP_ARTICLES, q);
  return (
    <div className="max-w-3xl">
      <label className="block text-sm font-medium" htmlFor="help-q">Search help articles</label>
      <input id="help-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base" />
      <div className="mt-5 space-y-2" aria-live="polite">
        {HELP_CATEGORIES.map((c) => {
          const items = found.filter((a) => a.category === c);
          return (
            <details key={c} className="rounded-xl border border-slate-200 bg-white p-4" open={q.trim() !== "" && items.length > 0}>
              <summary className="min-h-11 cursor-pointer py-2 font-semibold text-bc-shell">{c}</summary>
              {items.length === 0 ? (
                <p className="text-sm text-slate-600">{HELP_ARTICLES.length === 0 ? LEGAL_PENDING : "No articles match your search."}</p>
              ) : (
                items.map((a) => (
                  <article key={a.title} className="mt-3">
                    <h3 className="font-semibold">{a.title}</h3>
                    <p className="whitespace-pre-line text-sm text-slate-700">{a.body}</p>
                  </article>
                ))
              )}
            </details>
          );
        })}
      </div>
    </div>
  );
}
