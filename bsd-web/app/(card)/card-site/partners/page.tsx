import type { Metadata } from "next";
import Link from "next/link";
import { CardFrame, CardMain } from "@/components/card/CardFrame";
import Pager from "@/components/market/Pager";
import ZoneSelect from "@/components/ZoneSelect";
import { apiGet } from "@/lib/api";
import type { Partner } from "@/lib/card-api";
import { POPULAR_CATEGORIES } from "@/lib/content";
import { PUBLIC_LABELS as T, SITE_NAV } from "@/lib/pass-site-labels";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `${SITE_NAV.partners} | BSD Privilege Pass` };

type SP = Record<string, string | string[] | undefined>;
type Row = Partner & { category: { name: string; slug: string } };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
const field = "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base";

function href(f: { q?: string; zone?: string; category?: string }, page = 1) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) qs.set(k, v);
  if (page > 1) qs.set("page", String(page));
  const s = qs.toString();
  return s ? `/partners?${s}` : "/partners";
}

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const f = { q: one(sp.q)?.slice(0, 100), zone: one(sp.zone), category: one(sp.category) };
  const page = Math.max(1, Math.min(1000, parseInt(one(sp.page) ?? "1", 10) || 1));
  const qs = new URLSearchParams({ page: String(page), pageSize: "12" });
  for (const [k, v] of Object.entries(f)) if (v) qs.set(k, v);
  // The API answers with a 60 second public cache, so the page reuses it for the same time.
  const res = await apiGet<{ items: Row[]; page: number; pageSize: number; total: number }>(`/pass/partners?${qs}`, { revalidate: 60 });
  const tab = (active: boolean) =>
    `inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-semibold ${active ? "bg-teal-700 text-white" : "border border-slate-300 bg-white text-bc-shell hover:border-teal-700"}`;

  return (
    <CardFrame>
      <CardMain title={SITE_NAV.partners} intro={T.partnersIntro}>
        <form action="/partners" method="get" role="search" className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
          {f.category && <input type="hidden" name="category" value={f.category} />}
          <div>
            <label htmlFor="q" className="text-sm font-medium text-slate-800">{T.searchLabel}</label>
            <input id="q" name="q" type="search" maxLength={100} defaultValue={f.q ?? ""} className={field} />
          </div>
          <div>
            <label htmlFor="zone" className="text-sm font-medium text-slate-800">{T.zoneLabel}</label>
            <ZoneSelect id="zone" name="zone" defaultValue={f.zone ?? ""} className={field} />
          </div>
          <button type="submit" className="min-h-11 rounded-full bg-teal-700 px-6 text-sm font-semibold text-white hover:bg-teal-800">{T.searchButton}</button>
        </form>
        <nav aria-label="Categories" className="mt-4 flex gap-2 overflow-x-auto pb-1">
          <Link href={href({ q: f.q, zone: f.zone })} className={tab(!f.category)}>{T.allCategories}</Link>
          {POPULAR_CATEGORIES.map((c) => (
            <Link key={c.slug} href={href({ q: f.q, zone: f.zone, category: c.slug })} className={tab(f.category === c.slug)}>{c.name}</Link>
          ))}
        </nav>
        {!res.ok ? (
          <p className="mt-6 text-slate-700">{T.partnersDown}</p>
        ) : res.data.items.length === 0 ? (
          <p className="mt-6 text-slate-700">{T.noPartners}</p>
        ) : (
          <>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {res.data.items.map((p) => (
                <li key={p.slug} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                  <p className="font-heading font-semibold text-bc-shell">{p.name}</p>
                  <p className="text-xs text-slate-600">{p.category.name} | {p.areaLabel ?? p.postcodeDistrict}</p>
                  {p.offer && (
                    <p className="mt-2 text-sm font-semibold text-teal-800">
                      {p.offer.title}
                      {p.offer.percent !== null ? ` (${p.offer.percent}% off)` : ""}
                    </p>
                  )}
                  {p.offer && <p className="text-sm text-slate-700">{p.offer.terms}</p>}
                </li>
              ))}
            </ul>
            <Pager page={res.data.page} pageSize={res.data.pageSize} total={res.data.total} href={(n) => href(f, n)} />
          </>
        )}
      </CardMain>
    </CardFrame>
  );
}
