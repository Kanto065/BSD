"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { ApiError, useSession } from "@/lib/admin-session";
import { Card, ErrorNote, PageTitle, Skeleton, buttonClass, inputClass, useAdminData } from "@/components/admin/ui";
import MaintenanceBanner from "@/components/MaintenanceBanner";
import { SECTION_TEXT, bannerLines, type Maintenance, type SectionState } from "@/lib/sections";

type Def = { key: string; label: string; kind: "page" | "home" | "footer"; locked?: string; text?: { title: number; body?: number } };
type Config = {
  maintenance: Maintenance;
  sections: Record<string, SectionState>;
  homeOrder: string[];
  bannerMax: number;
  registry: Def[];
};

// 16px on phones (so iOS does not zoom) and 14px from the sm breakpoint, like the rest of the admin.
const field = `${inputClass} min-h-11 text-base sm:text-sm`;
const primary = `${buttonClass} min-h-11 bg-brand-blue text-white hover:bg-brand-navy`;
const small = `${buttonClass} min-h-11 min-w-11 border border-slate-300 bg-white px-3 text-slate-700 hover:bg-slate-50`;

function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <label className={`flex min-h-11 items-center gap-3 text-sm font-semibold ${disabled ? "text-slate-500" : "text-slate-800"}`}>
      <input type="checkbox" className="h-5 w-5 accent-brand-blue" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

// Site settings (ADMIN and above): the maintenance banner, which sections show, the homepage order and the editable
// headings. The public site picks changes up within about a minute.
export default function SitePage() {
  const { api } = useSession();
  const { data, error, loading, reload } = useAdminData<Config>("/site");
  const [m, setM] = useState<Maintenance>({ enabled: false, textEn: "", textBn: "" });
  const [items, setItems] = useState<Record<string, SectionState>>({});
  const [order, setOrder] = useState<string[]>([]);
  const [busy, setBusy] = useState<"" | "banner" | "sections">("");
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [saveError, setSaveError] = useState<unknown>(null);

  useEffect(() => {
    if (!data) return;
    setM(data.maintenance);
    setItems(data.sections);
    setOrder(data.homeOrder);
  }, [data]);

  async function save(kind: "banner" | "sections") {
    setBusy(kind);
    setNote(null);
    setSaveError(null);
    try {
      if (kind === "banner") await api("/site/maintenance", { method: "PUT", body: m });
      else await api("/site/sections", { method: "PUT", body: { items, order } });
      setNote({ ok: true, text: "Saved. The public site updates within about a minute." });
      await reload();
    } catch (e) {
      setSaveError(e);
      if (e instanceof ApiError && e.fieldErrors.textEn) setNote({ ok: false, text: e.fieldErrors.textEn });
    } finally {
      setBusy("");
    }
  }

  const set = (key: string, patch: Partial<SectionState>) => setItems((cur) => ({ ...cur, [key]: { ...cur[key]!, ...patch } }));
  const move = (key: string, delta: number) =>
    setOrder((cur) => {
      const i = cur.indexOf(key);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= cur.length) return cur;
      const next = [...cur];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  if (!data) {
    return (
      <div>
        <PageTitle>Site</PageTitle>
        <ErrorNote error={error} />
        {loading && <Skeleton className="h-48 w-full" />}
      </div>
    );
  }
  const def = (k: string) => data.registry.find((d) => d.key === k)!;
  const pages = data.registry.filter((d) => d.kind === "page");
  const textual = [...order.map(def), def("footer-cta")];

  return (
    <div className="space-y-6">
      <PageTitle sub="Show a notice across the whole site, choose which sections appear and edit the headings. Changes reach the public site within about a minute.">Site</PageTitle>
      <ErrorNote error={saveError} />
      {note && (
        <p role="status" className={`rounded-lg border px-4 py-3 text-sm font-medium ${note.ok ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`}>
          {note.text}
        </p>
      )}

      <Card title="Maintenance banner">
        <div className="space-y-4">
          <Switch checked={m.enabled} onChange={(v) => setM({ ...m, enabled: v })} label="Show the banner on every page" />
          <div>
            <label htmlFor="banner-en" className="text-sm font-semibold text-slate-700">
              Banner text (English)
            </label>
            <textarea id="banner-en" rows={2} maxLength={data.bannerMax} className={field} value={m.textEn} onChange={(e) => setM({ ...m, textEn: e.target.value })} />
            <p className="mt-1 text-xs text-slate-600">
              {m.textEn.length} of {data.bannerMax} characters. Plain text only.
            </p>
          </div>
          <div>
            <label htmlFor="banner-bn" className="text-sm font-semibold text-slate-700">
              Banner text (Bangla, optional)
            </label>
            <textarea id="banner-bn" rows={2} maxLength={data.bannerMax} className={field} value={m.textBn} onChange={(e) => setM({ ...m, textBn: e.target.value })} />
            <p className="mt-1 text-xs text-slate-600">
              {m.textBn.length} of {data.bannerMax} characters.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">Preview</p>
            <div className="mt-1 overflow-hidden rounded-lg border border-slate-200">
              {bannerLines({ ...m, enabled: true }).length ? (
                <MaintenanceBanner lines={bannerLines({ ...m, enabled: true })} />
              ) : (
                <p className="px-3 py-3 text-sm text-slate-600">Type some text to see the banner.</p>
              )}
            </div>
          </div>
          <button type="button" className={primary} disabled={busy !== ""} onClick={() => save("banner")}>
            {busy === "banner" ? "Saving..." : "Save banner"}
          </button>
        </div>
      </Card>

      <Card title="Pages">
        <p className="mb-2 text-sm text-slate-600">A hidden page disappears from the menus, the footer and the sitemap, and its address shows Page not found.</p>
        <ul className="divide-y divide-slate-100">
          {pages.map((d) => (
            <li key={d.key}>
              <Switch label={d.label} checked={items[d.key]?.visible !== false} disabled={!!d.locked} onChange={(v) => set(d.key, { visible: v })} />
              {d.locked && <p className="-mt-2 mb-2 ml-8 text-xs text-slate-600">{d.locked}</p>}
            </li>
          ))}
        </ul>
        <button type="button" className={`${primary} mt-4`} disabled={busy !== ""} onClick={() => save("sections")}>
          {busy === "sections" ? "Saving..." : "Save pages, order and text"}
        </button>
      </Card>

      <Card title="Homepage order and text">
        <p className="mb-3 text-sm text-slate-600">Use the arrows to reorder the homepage sections. Leave a heading or text box empty to keep the standard wording.</p>
        <ol className="space-y-3">
          {textual.map((d) => {
            const idx = order.indexOf(d.key);
            const st = items[d.key];
            const defaults = SECTION_TEXT[d.key] ?? {};
            return (
              <li key={d.key} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Switch label={d.label} checked={st?.visible !== false} onChange={(v) => set(d.key, { visible: v })} />
                  {idx >= 0 && (
                    <div className="flex gap-2">
                      <button type="button" className={small} disabled={idx === 0} onClick={() => move(d.key, -1)} aria-label={`Move ${d.label} up`}>
                        <ArrowUp className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button type="button" className={small} disabled={idx === order.length - 1} onClick={() => move(d.key, 1)} aria-label={`Move ${d.label} down`}>
                        <ArrowDown className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>
                {d.text && (
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor={`t-${d.key}`} className="text-xs font-semibold text-slate-700">
                        Heading (up to {d.text.title} characters)
                      </label>
                      <input id={`t-${d.key}`} type="text" maxLength={d.text.title} className={field} placeholder={defaults.title} value={st?.title ?? ""} onChange={(e) => set(d.key, { title: e.target.value || null })} />
                    </div>
                    {d.text.body ? (
                      <div>
                        <label htmlFor={`b-${d.key}`} className="text-xs font-semibold text-slate-700">
                          Text (up to {d.text.body} characters)
                        </label>
                        <input id={`b-${d.key}`} type="text" maxLength={d.text.body} className={field} placeholder={defaults.body} value={st?.body ?? ""} onChange={(e) => set(d.key, { body: e.target.value || null })} />
                      </div>
                    ) : null}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        <button type="button" className={`${primary} mt-4`} disabled={busy !== ""} onClick={() => save("sections")}>
          {busy === "sections" ? "Saving..." : "Save pages, order and text"}
        </button>
      </Card>
    </div>
  );
}
