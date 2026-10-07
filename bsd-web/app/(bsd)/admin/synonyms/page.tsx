"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { ApiError, useSession } from "@/lib/admin-session";
import { Card, ErrorNote, Pager, PageTitle, SkeletonRows, buttonClass, inputClass, tableClass, tableWrapClass, theadClass, useAdminData } from "@/components/admin/ui";

type Cat = { id: string; name: string; slug: string };
type Row = { id: string; term: string; expansions: string[]; categoryId: string | null; category: Cat | null; starter: boolean };
type ListData = { items: Row[]; total: number; page: number; pageSize: number; starterCount: number; categories: Cat[]; maxRows: number };
type ImportLine = { line: number; text: string; status: "new" | "update" | "error"; error?: string; matches?: number };
type ImportResult = { applied: boolean; created: number; updated: number; errors: number; lines: ImportLine[] };

// 16px on phones (so iOS does not zoom) and 14px from the sm breakpoint, 44px tall controls.
const field = `${inputClass.replace("text-sm", "text-base sm:text-sm")} min-h-11`;
const primary = `${buttonClass} min-h-11 bg-brand-blue text-white hover:bg-brand-navy`;
const small = `${buttonClass} min-h-11 min-w-11 border border-slate-300 bg-white px-3 text-slate-700 hover:bg-slate-50`;
const PAGE_SIZE = 25;

// Search synonyms (ADMIN and above). A Bangla word or a Banglish spelling is mapped to English words and an optional
// category, and the public search then finds those listings too. Changes are live within a few seconds.
export default function SynonymsPage() {
  const { api } = useSession();
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState("");
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useAdminData<ListData>(`/synonyms?page=${page}&pageSize=${PAGE_SIZE}${applied ? `&q=${encodeURIComponent(applied)}` : ""}`);

  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [term, setTerm] = useState("");
  const [expansions, setExpansions] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<unknown>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [importOpen, setImportOpen] = useState(false);
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<unknown>(null);
  const [note, setNote] = useState("");

  useEffect(() => setPage(1), [applied]);

  function open(row: Row | null) {
    setEditing(row ? row.id : "new");
    setTerm(row?.term ?? "");
    setExpansions(row?.expansions.join(", ") ?? "");
    setCategoryId(row?.categoryId ?? "");
    setSaveError(null);
    setFieldErrors({});
    setNote("");
  }

  async function save() {
    setBusy(true);
    setSaveError(null);
    setFieldErrors({});
    const body = { term, expansions: expansions.split(",").map((s) => s.trim()).filter(Boolean), categoryId: categoryId || null };
    try {
      if (editing === "new") await api("/synonyms", { method: "POST", body });
      else await api(`/synonyms/${editing}`, { method: "PATCH", body });
      setEditing(null);
      setNote("Saved. Search uses the change within a few seconds.");
      await reload();
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length) setFieldErrors(e.fieldErrors);
      else setSaveError(e);
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: Row) {
    if (!window.confirm(`Remove "${row.term}" from the search synonyms?`)) return;
    setNote("");
    try {
      await api(`/synonyms/${row.id}`, { method: "DELETE" });
      setNote("Removed.");
      await reload();
    } catch (e) {
      setSaveError(e);
    }
  }

  async function runImport(apply: boolean) {
    setBusy(true);
    setImportError(null);
    try {
      const r = await api<ImportResult>("/synonyms/import", { method: "POST", body: { text, apply } });
      setPreview(r);
      if (apply) {
        setNote(`Imported. ${r.created} added, ${r.updated} updated.`);
        setText("");
        setPreview(null);
        setImportOpen(false);
        await reload();
      }
    } catch (e) {
      setImportError(e);
      if (e instanceof ApiError && e.fieldErrors.text) setImportError(new Error(e.fieldErrors.text));
    } finally {
      setBusy(false);
    }
  }

  const form = (
    <div className="space-y-3">
      <div>
        <label htmlFor="syn-term" className="text-sm font-semibold text-slate-800">Word people search for</label>
        <input id="syn-term" lang="bn" className={field} value={term} maxLength={60} onChange={(e) => setTerm(e.target.value)} placeholder="হিজামা or hijama" />
        {fieldErrors.term && <p className="mt-1 text-sm text-red-700">{fieldErrors.term}</p>}
      </div>
      <div>
        <label htmlFor="syn-exp" className="text-sm font-semibold text-slate-800">Also match these words (separate with commas, up to 8)</label>
        <input id="syn-exp" className={field} value={expansions} onChange={(e) => setExpansions(e.target.value)} placeholder="cupping therapy, CuppingTherapy" />
        {fieldErrors.expansions && <p className="mt-1 text-sm text-red-700">{fieldErrors.expansions}</p>}
      </div>
      <div>
        <label htmlFor="syn-cat" className="text-sm font-semibold text-slate-800">Also show this whole category (optional)</label>
        <select id="syn-cat" className={field} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">No category</option>
          {data?.categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {fieldErrors.categoryId && <p className="mt-1 text-sm text-red-700">{fieldErrors.categoryId}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={primary} disabled={busy} onClick={save}>{busy ? "Saving..." : "Save"}</button>
        <button type="button" className={small} onClick={() => setEditing(null)}>Cancel</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageTitle
        sub="Words people type in Bangla or Banglish, matched to the English words and categories used in listings."
        actions={
          <>
            <button type="button" className={small} onClick={() => { setImportOpen((v) => !v); setPreview(null); setImportError(null); }}>
              <Upload className="h-4 w-4" aria-hidden="true" /> Import
            </button>
            <button type="button" className={primary} onClick={() => open(null)}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Add
            </button>
          </>
        }
      >
        Search synonyms
      </PageTitle>

      {data && data.starterCount > 0 && (
        <div role="note" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Starter list.</strong> {data.starterCount} rows came from a draft starter list and have not been reviewed by a Bangla reader. Check them, then edit or remove any row. A row you edit loses its Starter badge.
        </div>
      )}
      {note && <p role="status" className="text-sm font-semibold text-green-700">{note}</p>}
      <ErrorNote error={saveError} />

      {editing && <Card title={editing === "new" ? "Add a synonym" : "Edit synonym"}>{form}</Card>}

      {importOpen && (
        <Card title="Import many at once">
          <p className="text-sm text-slate-600">One per line: <code>word | expansion, expansion | category-slug</code>. The category is optional. Up to 500 lines. Preview first, nothing is saved until you apply.</p>
          <label htmlFor="syn-import" className="sr-only">Lines to import</label>
          <textarea id="syn-import" lang="bn" rows={8} className={`${field} font-mono`} value={text} onChange={(e) => { setText(e.target.value); setPreview(null); }} placeholder={"হিজামা | hijama, cupping therapy\nমুদি | grocery | groceries-and-halal"} />
          <ErrorNote error={importError} />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={small} disabled={busy || !text.trim()} onClick={() => runImport(false)}>Preview</button>
            <button type="button" className={primary} disabled={busy || !preview || preview.errors > 0} onClick={() => runImport(true)}>Apply</button>
          </div>
          {preview && (
            <div className="mt-4">
              <p className="text-sm font-semibold text-slate-800">{preview.created} new, {preview.updated} to update, {preview.errors} with errors</p>
              <ul className="mt-2 divide-y divide-slate-100 text-sm">
                {preview.lines.map((l) => (
                  <li key={l.line} className="py-2">
                    <span className="font-mono text-xs text-slate-500">Line {l.line}</span> {l.text}
                    <div className={l.status === "error" ? "text-red-700" : "text-slate-600"}>
                      {l.status === "error" ? l.error : `${l.status === "new" ? "New" : "Updates an existing row"}, matches ${l.matches} listing${l.matches === 1 ? "" : "s"}`}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      <form className="flex gap-2" role="search" onSubmit={(e) => { e.preventDefault(); setApplied(q.trim()); }}>
        <label htmlFor="syn-search" className="sr-only">Search the synonym list</label>
        <input id="syn-search" type="search" lang="bn" className={`${field} mt-0`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a word or expansion" />
        <button type="submit" className={small}>Find</button>
        {applied && (
          <button type="button" className={small} aria-label="Clear search" onClick={() => { setQ(""); setApplied(""); }}>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </form>

      {error ? (
        <ErrorNote error={error} />
      ) : loading && !data ? (
        <SkeletonRows rows={6} cols={4} />
      ) : data && (
        <>
          <div className={tableWrapClass}>
            <table className={tableClass}>
              <thead className={theadClass}>
                <tr>
                  <th className="px-4 py-3">Word</th>
                  <th className="px-4 py-3">Also matches</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 align-top font-semibold text-slate-900" lang="bn">
                      {r.term}
                      {r.starter && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Starter</span>}
                    </td>
                    <td className="px-4 py-3 align-top text-slate-700">{r.expansions.join(", ")}</td>
                    <td className="px-4 py-3 align-top text-slate-700">{r.category?.name ?? ""}</td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex justify-end gap-2">
                        <button type="button" className={small} aria-label={`Edit ${r.term}`} onClick={() => open(r)}><Pencil className="h-4 w-4" aria-hidden="true" /></button>
                        <button type="button" className={small} aria-label={`Remove ${r.term}`} onClick={() => remove(r)}><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {data.items.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-600">{applied ? "Nothing matches that search." : "No synonyms yet. Add the first one."}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Pager page={page} total={data.total} pageSize={PAGE_SIZE} onPage={setPage} />
        </>
      )}
    </div>
  );
}
