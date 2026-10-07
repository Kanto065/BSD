"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  GitMerge,
  GripVertical,
  Home,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { ApiError, useSession } from "@/lib/admin-session";
import { CATEGORY_ICONS, iconFor } from "@/lib/category-icons";
import { ErrorNote, PageTitle, Skeleton, StatusPill, buttonClass, fmtDate, inputClass, useAdminData } from "@/components/admin/ui";
import { HOMEPAGE_TILES } from "@/lib/taxonomy";

type Sub = { id: string; name: string; slug: string; listingCount: number };
type Cat = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sortOrder: number;
  requiresOwnerName: boolean;
  status: "APPROVED" | "PENDING" | "REJECTED";
  submittedAt: string | null;
  sampleListings: { id: string; name: string }[];
  listingCount: number;
  subcategories: Sub[];
};
type FormValues = { name: string; slug: string; description: string; icon: string; requiresOwnerName: boolean; subs: string[] };
type Panel = { mode: "add" } | { mode: "edit"; cat: Cat } | { mode: "merge"; cat: Cat } | null;
type Run = (fn: () => Promise<unknown>, done?: string) => Promise<boolean>;

const sameOrder = (a: { id: string }[], b: { id: string }[]) => a.length === b.length && a.every((x, i) => x.id === b[i]!.id);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Moves the item with id `from` to where `to` is, returning a new array (used while dragging). */
function moveTo<T extends { id: string }>(list: T[], from: string, to: string): T[] {
  const a = list.findIndex((x) => x.id === from);
  const b = list.findIndex((x) => x.id === to);
  if (a < 0 || b < 0 || a === b) return list;
  const next = [...list];
  next.splice(b, 0, next.splice(a, 1)[0]!);
  return next;
}

// Categories and their subcategories as they appear on the website (the site picks up changes within about a minute).
// Subcategories are the part visitors actually browse by. Categories start collapsed; open one (or all) to work on its list.
export default function CategoriesPage() {
  const { api } = useSession();
  const { data, error, reload } = useAdminData<{ categories: Cat[] }>("/categories");
  const [actionError, setActionError] = useState<unknown>(null);
  const [order, setOrder] = useState<Cat[]>([]);
  const [panel, setPanel] = useState<Panel>(null);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [toast, setToast] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const dragStart = useRef<Cat[]>([]);

  useEffect(() => {
    // Only approved categories are on the site and in its order. Suggested ones sit in their own panel.
    if (data && !dragId) setOrder(data.categories.filter((c) => c.status === "APPROVED"));
  }, [data, dragId]);

  // Every category starts collapsed, so the page opens as a short list. A search still opens the matches.
  const collapsedOnce = useRef(false);
  useEffect(() => {
    if (!data || collapsedOnce.current) return;
    collapsedOnce.current = true;
    setCollapsed(new Set(data.categories.filter((c) => c.status === "APPROVED").map((c) => c.id)));
  }, [data]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const run: Run = async (fn, done) => {
    setActionError(null);
    try {
      await fn();
      await reload();
      if (done) setToast(done);
      return true;
    } catch (e) {
      setActionError(e);
      return false;
    }
  };

  const flashSaved = () => {
    setSaving("saved");
    setTimeout(() => setSaving("idle"), 1800);
  };

  // Shows the new order straight away, saves it, and puts the old order back if the save fails.
  async function saveOrder(next: Cat[], before: Cat[]) {
    setOrder(next);
    setSaving("saving");
    setActionError(null);
    try {
      await api("/categories/reorder", { method: "POST", body: { ids: next.map((c) => c.id) } });
      await reload();
      flashSaved();
    } catch (e) {
      setOrder(before);
      setSaving("idle");
      setActionError(e);
    }
  }

  async function saveSubOrder(cat: Cat, subs: Sub[]) {
    setSaving("saving");
    setActionError(null);
    try {
      await api(`/categories/${cat.id}/subcategories/reorder`, { method: "POST", body: { ids: subs.map((s) => s.id) } });
      await reload();
      flashSaved();
      return true;
    } catch (e) {
      setSaving("idle");
      setActionError(e);
      await reload();
      return false;
    }
  }

  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[index], next[j]] = [next[j]!, next[index]!];
    void saveOrder(next, order);
  };

  const filtering = query.trim().length > 0;
  const q = query.trim().toLowerCase();
  const subMatches = (c: Cat) => c.subcategories.some((s) => s.name.toLowerCase().includes(q));
  const visible = filtering ? order.filter((c) => c.name.toLowerCase().includes(q) || c.slug.includes(q) || subMatches(c)) : order;

  const totals = useMemo(
    () => ({
      listings: order.reduce((n, c) => n + c.listingCount, 0),
      subs: order.reduce((n, c) => n + c.subcategories.length, 0),
      noSubs: order.filter((c) => c.subcategories.length === 0).length,
    }),
    [order]
  );

  const allCollapsed = order.length > 0 && collapsed.size === order.length;
  const toggle = (id: string) =>
    setCollapsed((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div>
      <PageTitle
        sub={`The order here is the order on the website, for categories and for the subcategories inside them. The first ${HOMEPAGE_TILES} categories are the homepage tiles. Changes appear on the site within about a minute.`}
        actions={
          <button type="button" onClick={() => setPanel({ mode: "add" })} className={`${buttonClass} bg-brand-blue text-white shadow-sm hover:bg-brand-navy`}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Add a category
          </button>
        }
      >
        Categories
      </PageTitle>
      <ErrorNote error={error ?? actionError} />

      {!data && !error ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-xl" />
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-[0_1px_2px_rgba(12,46,66,0.05)] sm:grid-cols-4">
            <Summary label="Subcategories" value={totals.subs} note={totals.noSubs ? `${plural(totals.noSubs, "category has", "categories have")} none yet` : undefined} />
            <Summary label="Categories" value={order.length} />
            <Summary label="Homepage tiles" value={`${Math.min(order.length, HOMEPAGE_TILES)} of ${HOMEPAGE_TILES}`} />
            <Summary label="Listings" value={totals.listings} />
          </dl>

          <PendingPanel
            pending={data?.categories.filter((c) => c.status === "PENDING") ?? []}
            run={run}
            onMerge={(cat) => setPanel({ mode: "merge", cat })}
            api={api}
          />

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-80">
              <label htmlFor="cat-search" className="sr-only">
                Search categories and subcategories
              </label>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <input
                id="cat-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search categories and subcategories"
                className={`${inputClass} !mt-0 pl-9`}
              />
            </div>
            <button
              type="button"
              onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(order.map((c) => c.id)))}
              className={`${buttonClass} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}
            >
              {allCollapsed ? <ChevronsUpDown className="h-4 w-4" aria-hidden="true" /> : <ChevronsDownUp className="h-4 w-4" aria-hidden="true" />}
              {allCollapsed ? "Expand all" : "Collapse all"}
            </button>
            <p className="ml-auto flex items-center gap-2 text-sm text-slate-600" aria-live="polite">
              {saving === "saving" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Saving the new order
                </>
              ) : saving === "saved" ? (
                <>
                  <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" /> Order saved
                </>
              ) : filtering ? (
                "Clear the search to reorder."
              ) : (
                <span className="hidden lg:inline">Hover a row to drag it into a new order. Click a subcategory to see its listings.</span>
              )}
            </p>
          </div>

          <ol className="mt-3 space-y-3" aria-label="Categories in website order">
            {visible.map((c) => {
              const i = order.indexOf(c);
              return (
                <li key={c.id}>
                  {!filtering && i === HOMEPAGE_TILES && order.length > HOMEPAGE_TILES && <HomepageLine />}
                  <CategoryCard
                    cat={c}
                    index={i}
                    total={order.length}
                    open={!collapsed.has(c.id) || (filtering && subMatches(c))}
                    highlight={filtering ? q : ""}
                    dragging={dragId === c.id}
                    canDrag={!filtering && saving !== "saving"}
                    onToggle={() => toggle(c.id)}
                    onMove={(dir) => move(i, dir)}
                    onEdit={() => setPanel({ mode: "edit", cat: c })}
                    onMerge={() => setPanel({ mode: "merge", cat: c })}
                    onDelete={() => run(() => api(`/categories/${c.id}`, { method: "DELETE" }), `Deleted ${c.name}`)}
                    onDragStart={() => {
                      dragStart.current = order;
                      setDragId(c.id);
                    }}
                    onDragEnter={() => {
                      if (dragId && dragId !== c.id) setOrder((cur) => moveTo(cur, dragId, c.id));
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      if (!sameOrder(order, dragStart.current)) void saveOrder(order, dragStart.current);
                    }}
                    onSubOrder={(subs) => saveSubOrder(c, subs)}
                    run={run}
                  />
                </li>
              );
            })}
          </ol>
          {filtering && visible.length === 0 && (
            <p className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-600">
              No category or subcategory matches &ldquo;{query}&rdquo;.
            </p>
          )}
        </>
      )}

      {panel?.mode === "merge" && (
        <Drawer title={`Merge ${panel.cat.name}`} onClose={() => setPanel(null)}>
          <MergeForm
            cat={panel.cat}
            targets={order.filter((c) => c.id !== panel.cat.id)}
            onCancel={() => setPanel(null)}
            onMerge={async (body) => {
              if (await run(() => api(`/categories/${panel.cat.id}/merge`, { method: "POST", body }), `Merged ${panel.cat.name}`)) setPanel(null);
            }}
          />
        </Drawer>
      )}

      {panel && panel.mode !== "merge" && (
        <Drawer title={panel.mode === "add" ? "New category" : `Edit ${panel.cat.name}`} onClose={() => setPanel(null)}>
          <CategoryForm
            mode={panel.mode}
            initial={
              panel.mode === "add"
                ? { name: "", slug: "", description: "", icon: "package", requiresOwnerName: false, subs: [] }
                : {
                    name: panel.cat.name,
                    slug: panel.cat.slug,
                    description: panel.cat.description ?? "",
                    icon: panel.cat.icon ?? "package",
                    requiresOwnerName: panel.cat.requiresOwnerName,
                    subs: panel.cat.subcategories.map((s) => s.name),
                  }
            }
            position={panel.mode === "add" ? order.length + 1 : order.findIndex((c) => c.id === panel.cat.id) + 1}
            onCancel={() => setPanel(null)}
            onSave={async (v) => {
              if (panel.mode === "add") {
                await api("/categories", {
                  method: "POST",
                  body: { name: v.name, description: v.description || null, icon: v.icon, requiresOwnerName: v.requiresOwnerName, ...(v.subs.length ? { subcategories: v.subs } : {}) },
                });
              } else {
                await api(`/categories/${panel.cat.id}`, {
                  method: "PATCH",
                  body: { name: v.name, slug: v.slug, description: v.description || null, icon: v.icon, requiresOwnerName: v.requiresOwnerName },
                });
              }
              setPanel(null);
              await reload();
              setToast(panel.mode === "add" ? `Added ${v.name}${v.subs.length ? ` with ${plural(v.subs.length, "subcategory", "subcategories")}` : ""}` : `Saved ${v.name}`);
            }}
          />
        </Drawer>
      )}

      {toast && (
        <div role="status" className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg bg-brand-navy px-4 py-3 text-sm font-medium text-white shadow-lg">
          <Check className="h-4 w-4 text-brand-teal" aria-hidden="true" /> {toast}
        </div>
      )}
    </div>
  );
}

// Form controls in the new panels: 16px on phones (no zoom on focus) and a 44px tall tap target.
const field = `${inputClass} min-h-11 !text-base sm:!text-sm`;
const bigButton = `${buttonClass} min-h-11`;

/** Categories typed in through "Others" on the Submit form. The admin approves, merges or rejects each one. */
function PendingPanel({ pending, run, onMerge, api }: { pending: Cat[]; run: Run; onMerge: (c: Cat) => void; api: (path: string, init?: { method?: string; body?: unknown }) => Promise<unknown> }) {
  if (!pending.length) return null;
  return (
    <section aria-labelledby="pending-title" className="mt-6 rounded-xl border border-amber-300 bg-amber-50/60 p-4 shadow-[0_1px_2px_rgba(12,46,66,0.05)] sm:p-5">
      <h2 id="pending-title" className="font-heading text-base font-bold text-brand-navy">
        Suggested by users ({pending.length})
      </h2>
      <p className="mt-1 text-sm text-slate-700">
        People typed these under Others on the Submit form. They are hidden from the site, and their listings cannot be approved, until you decide.
      </p>
      <ul className="mt-4 space-y-3">
        {pending.map((c) => (
          <PendingRow key={c.id} cat={c} run={run} onMerge={onMerge} api={api} />
        ))}
      </ul>
    </section>
  );
}

function PendingRow({ cat: c, run, onMerge, api }: { cat: Cat; run: Run; onMerge: (c: Cat) => void; api: (path: string, init?: { method?: string; body?: unknown }) => Promise<unknown> }) {
  const [name, setName] = useState(c.name);
  const [armed, setArmed] = useState(false);
  const [reason, setReason] = useState("");
  const post = (action: string, body: unknown, done: string) => run(() => api(`/categories/${c.id}/${action}`, { method: "POST", body }), done);
  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="font-semibold text-brand-navy">{c.name}</p>
      <p className="text-xs text-slate-600">
        {plural(c.listingCount, "listing", "listings")}
        {c.submittedAt ? ` · suggested ${fmtDate(c.submittedAt)}` : ""}
        {c.sampleListings.length ? ` · ${c.sampleListings.map((l) => l.name).join(", ")}` : ""}
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1 basis-48">
          <label htmlFor={`pn-${c.id}`} className="text-xs font-semibold text-slate-700">
            Category name
          </label>
          <input id={`pn-${c.id}`} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className={field} />
        </div>
        <button type="button" disabled={name.trim().length < 2} onClick={() => void post("approve", name.trim() === c.name ? {} : { name: name.trim() }, `Approved ${name.trim()}`)} className={`${bigButton} bg-brand-blue text-white hover:bg-brand-navy`}>
          <Check className="h-4 w-4" aria-hidden="true" /> Approve as new category
        </button>
        <button type="button" onClick={() => onMerge(c)} className={`${bigButton} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}>
          <GitMerge className="h-4 w-4" aria-hidden="true" /> Merge or make a subcategory
        </button>
      </div>
      <div className="mt-3 border-t border-slate-100 pt-3">
        {armed ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1 basis-48">
              <label htmlFor={`pr-${c.id}`} className="text-xs font-semibold text-slate-700">
                Reason shown with the rejected listings (optional)
              </label>
              <input id={`pr-${c.id}`} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} className={field} />
            </div>
            <button type="button" onClick={() => void post("reject", reason.trim() ? { reason: reason.trim() } : {}, `Rejected ${c.name}`)} className={`${bigButton} bg-red-700 text-white hover:bg-red-800`}>
              Confirm reject
            </button>
            <button type="button" onClick={() => setArmed(false)} className={`${bigButton} text-slate-700 hover:bg-slate-100`}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setArmed(true)} className={`${bigButton} text-red-700 hover:bg-red-50`}>
            <X className="h-4 w-4" aria-hidden="true" /> Reject and its waiting listings
          </button>
        )}
      </div>
    </li>
  );
}

/** Moves all listings and subcategories of one category into another, then removes it. Also turns a suggestion into a subcategory. */
function MergeForm({
  cat,
  targets,
  onCancel,
  onMerge,
}: {
  cat: Cat;
  targets: Cat[];
  onCancel: () => void;
  onMerge: (body: { targetId: string; subcategoryId?: string; newSubcategoryName?: string }) => Promise<void>;
}) {
  const [targetId, setTargetId] = useState("");
  const [sub, setSub] = useState(cat.status === "PENDING" ? "__new" : "");
  const [newName, setNewName] = useState(cat.status === "PENDING" ? cat.name : "");
  const [busy, setBusy] = useState(false);
  const target = targets.find((t) => t.id === targetId);
  const ready = Boolean(target) && (sub !== "__new" || newName.trim().length >= 2);
  return (
    <form
      className="space-y-5 p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!target) return;
        setBusy(true);
        await onMerge({ targetId, ...(sub === "__new" ? { newSubcategoryName: newName.trim() } : sub ? { subcategoryId: sub } : {}) });
        setBusy(false);
      }}
    >
      <p className="text-sm text-slate-700">
        All {plural(cat.listingCount, "listing", "listings")} and {plural(cat.subcategories.length, "subcategory", "subcategories")} of <strong>{cat.name}</strong> move into the category you choose, then {cat.name} is deleted. A subcategory with the same name is joined, not duplicated.
      </p>
      <div>
        <label htmlFor="merge-target" className="block text-sm font-semibold text-brand-navy">
          Merge into
        </label>
        <select id="merge-target" value={targetId} onChange={(e) => { setTargetId(e.target.value); setSub(cat.status === "PENDING" ? "__new" : ""); }} className={field}>
          <option value="">Choose a category</option>
          {targets.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      {target && (
        <div>
          <label htmlFor="merge-sub" className="block text-sm font-semibold text-brand-navy">
            Listings with no subcategory go to
          </label>
          <select id="merge-sub" value={sub} onChange={(e) => setSub(e.target.value)} className={field}>
            <option value="">Leave them with no subcategory</option>
            {target.subcategories.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            <option value="__new">A new subcategory</option>
          </select>
          {sub === "__new" && (
            <div className="mt-3">
              <label htmlFor="merge-new" className="block text-sm font-semibold text-brand-navy">
                New subcategory name
              </label>
              <input id="merge-new" value={newName} maxLength={80} onChange={(e) => setNewName(e.target.value)} className={field} />
            </div>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={!ready || busy} className={`${bigButton} bg-brand-blue text-white hover:bg-brand-navy`}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <GitMerge className="h-4 w-4" aria-hidden="true" />} Merge and delete {cat.name}
        </button>
        <button type="button" onClick={onCancel} className={`${bigButton} text-slate-700 hover:bg-slate-100`}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function Summary({ label, value, note }: { label: string; value: number | string; note?: string }) {
  return (
    <div className="px-4 py-3">
      <dt className="text-sm text-slate-600">{label}</dt>
      <dd className="mt-0.5 text-2xl font-bold tabular-nums text-brand-navy">{value}</dd>
      {note && <dd className="text-xs text-slate-500">{note}</dd>}
    </div>
  );
}

function HomepageLine() {
  return (
    <div className="flex items-center gap-3 pb-3" role="separator" aria-label={`Categories above this line are the ${HOMEPAGE_TILES} homepage tiles`}>
      <span className="h-px flex-1 bg-brand-teal/40" />
      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-teal/10 px-3 py-1 text-center text-xs font-semibold text-brand-teal-dark">
        <Home className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> Homepage tiles end here. Categories below appear on the Categories page only.
      </span>
      <span className="h-px flex-1 bg-brand-teal/40" />
    </div>
  );
}

/** Highlights the part of a name that matches the search. */
function Marked({ text, q }: { text: string; q: string }) {
  const at = q ? text.toLowerCase().indexOf(q) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded bg-amber-100 px-0.5 text-inherit">{text.slice(at, at + q.length)}</mark>
      {text.slice(at + q.length)}
    </>
  );
}

/** A two-step delete: the first click asks, the second deletes. Resets after a few seconds. */
function DeleteButton({ label, locked, lockedReason, onDelete, small }: { label: string; locked: boolean; lockedReason: string; onDelete: () => void; small?: boolean }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  const size = small ? "h-3.5 w-3.5" : "h-4 w-4";
  if (locked) {
    return (
      <span className={`rounded-lg ${small ? "p-1.5" : "p-2"} text-slate-300`} title={lockedReason}>
        <Lock className={size} aria-hidden="true" />
        <span className="sr-only">{lockedReason}</span>
      </span>
    );
  }
  if (armed) {
    return (
      <button
        type="button"
        onClick={() => {
          setArmed(false);
          onDelete();
        }}
        className={`${buttonClass} bg-red-700 text-white hover:bg-red-800 ${small ? "px-2.5 py-1 text-xs" : "px-3 py-1.5"}`}
      >
        Confirm delete
      </button>
    );
  }
  return (
    <button type="button" onClick={() => setArmed(true)} className={`rounded-lg ${small ? "p-1.5" : "p-2"} text-slate-500 transition hover:bg-red-50 hover:text-red-700 active:scale-95`} title="Delete">
      <Trash2 className={size} aria-hidden="true" />
      <span className="sr-only">Delete {label}</span>
    </button>
  );
}

function CategoryCard({
  cat: c,
  index: i,
  total,
  open,
  highlight,
  dragging,
  canDrag,
  onToggle,
  onMove,
  onEdit,
  onMerge,
  onDelete,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onSubOrder,
  run,
}: {
  cat: Cat;
  index: number;
  total: number;
  open: boolean;
  highlight: string;
  dragging: boolean;
  canDrag: boolean;
  onToggle: () => void;
  onMove: (dir: -1 | 1) => void;
  onEdit: () => void;
  onMerge: () => void;
  onDelete: () => Promise<boolean>;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
  onSubOrder: (subs: Sub[]) => Promise<boolean>;
  run: Run;
}) {
  const Icon = iconFor(c.icon);
  const homepage = i < HOMEPAGE_TILES;
  const [handle, setHandle] = useState(false);

  return (
    <div
      draggable={canDrag && handle}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", c.id);
        onDragStart();
      }}
      onDragEnter={onDragEnter}
      onDragOver={(e) => canDrag && e.preventDefault()}
      onDrop={(e) => e.preventDefault()}
      onDragEnd={() => {
        setHandle(false);
        onDragEnd();
      }}
      className={`group/cat overflow-hidden rounded-xl border bg-white shadow-[0_1px_2px_rgba(12,46,66,0.05)] transition ${
        dragging ? "scale-[0.99] border-brand-blue opacity-60 ring-2 ring-brand-blue/30" : "border-slate-200"
      }`}
    >
      {/* Category header */}
      <div className={`group/head flex items-center gap-3 px-3 py-2.5 sm:px-4 ${homepage ? "bg-brand-teal/[0.06]" : "bg-slate-50"}`}>
        {/* The drag handle only shows on hover, so it does not pull the eye away from the names. */}
        <span
          onMouseDown={() => setHandle(true)}
          onMouseUp={() => setHandle(false)}
          aria-hidden="true"
          title={canDrag ? "Drag to reorder categories" : undefined}
          className={`hidden rounded-md p-1 text-slate-400 opacity-0 transition-opacity sm:block ${
            canDrag ? "cursor-grab hover:bg-white hover:text-slate-600 active:cursor-grabbing group-hover/head:opacity-100" : "invisible"
          }`}
        >
          <GripVertical className="h-5 w-5" />
        </span>
        <span className="w-5 shrink-0 text-right text-sm font-semibold tabular-nums text-slate-500">{i + 1}</span>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ${homepage ? "text-brand-teal-dark ring-brand-teal/20" : "text-slate-600 ring-slate-200"}`}>
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={`subs-${c.id}`} className="min-w-0 flex-1 text-left">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-semibold text-brand-navy">
              <Marked text={c.name} q={highlight} />
            </span>
            {homepage && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-teal/10 px-2 py-0.5 text-xs font-semibold text-brand-teal-dark">
                <Home className="h-3 w-3" aria-hidden="true" /> Homepage
              </span>
            )}
            {c.requiresOwnerName && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200" title="Listings must give the owner or provider name">
                <UserRound className="h-3 w-3" aria-hidden="true" /> Owner name
              </span>
            )}
          </span>
          <span className="block truncate text-xs text-slate-500">
            {plural(c.subcategories.length, "subcategory", "subcategories")} · {plural(c.listingCount, "listing", "listings")} · /categories/{c.slug}
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-0.5">
          <div className="flex flex-col sm:opacity-0 sm:transition sm:focus-within:opacity-100 sm:group-hover/cat:opacity-100">
            <button type="button" aria-label={`Move ${c.name} up`} disabled={i === 0 || !canDrag} onClick={() => onMove(-1)} className="rounded p-0.5 text-slate-500 hover:bg-white disabled:opacity-30">
              <ArrowUp className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" aria-label={`Move ${c.name} down`} disabled={i === total - 1 || !canDrag} onClick={() => onMove(1)} className="rounded p-0.5 text-slate-500 hover:bg-white disabled:opacity-30">
              <ArrowDown className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <button type="button" onClick={onEdit} className="rounded-lg p-2 text-slate-600 transition hover:bg-white hover:text-brand-navy active:scale-95" title="Edit category">
            <Pencil className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Edit {c.name}</span>
          </button>
          <button type="button" onClick={onMerge} className="rounded-lg p-2 text-slate-600 transition hover:bg-white hover:text-brand-navy active:scale-95" title="Merge into another category">
            <GitMerge className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Merge {c.name} into another category</span>
          </button>
          <DeleteButton label={c.name} locked={c.listingCount > 0} lockedReason={`${c.name} has listings. Move them to another category before deleting.`} onDelete={() => void onDelete()} />
          <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={`subs-${c.id}`} className="rounded-lg p-2 text-slate-500 transition hover:bg-white" title={open ? "Hide subcategories" : "Show subcategories"}>
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
            <span className="sr-only">{open ? "Hide" : "Show"} subcategories of {c.name}</span>
          </button>
        </div>
      </div>

      <div id={`subs-${c.id}`} className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">{open && <SubcategoryList category={c} highlight={highlight} canDrag={canDrag} onOrder={onSubOrder} run={run} />}</div>
      </div>
    </div>
  );
}

function SubcategoryList({
  category: c,
  highlight,
  canDrag,
  onOrder,
  run,
}: {
  category: Cat;
  highlight: string;
  canDrag: boolean;
  onOrder: (subs: Sub[]) => Promise<boolean>;
  run: Run;
}) {
  const { api } = useSession();
  const [subs, setSubs] = useState(c.subcategories);
  const [dragId, setDragId] = useState<string | null>(null);
  const [handleId, setHandleId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const before = useRef<Sub[]>([]);

  useEffect(() => {
    if (!dragId) setSubs(c.subcategories);
  }, [c.subcategories, dragId]);

  const commit = async (next: Sub[], prev: Sub[]) => {
    setSubs(next);
    if (!(await onOrder(next))) setSubs(prev);
  };
  const step = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= subs.length) return;
    const next = [...subs];
    [next[index], next[j]] = [next[j]!, next[index]!];
    void commit(next, subs);
  };

  return (
    <div className="border-t border-slate-200">
      {subs.length === 0 ? (
        <p className="px-4 py-4 text-sm text-slate-600 sm:pl-[4.75rem]">No subcategories yet. Add the first one below so visitors can narrow their search.</p>
      ) : (
        <ol className="divide-y divide-slate-100" aria-label={`Subcategories of ${c.name}`}>
          {subs.map((s, k) => (
            <li
              key={s.id}
              draggable={canDrag && handleId === s.id}
              onDragStart={(e) => {
                e.stopPropagation();
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", s.id);
                before.current = subs;
                setDragId(s.id);
              }}
              onDragEnter={(e) => {
                if (!dragId) return;
                e.stopPropagation();
                if (dragId !== s.id) setSubs((cur) => moveTo(cur, dragId, s.id));
              }}
              onDragOver={(e) => {
                if (!dragId) return;
                e.stopPropagation();
                e.preventDefault();
              }}
              onDrop={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onDragEnd={(e) => {
                e.stopPropagation();
                setDragId(null);
                setHandleId(null);
                if (!sameOrder(subs, before.current)) void commit(subs, before.current);
              }}
              className={dragId === s.id ? "bg-sky-50 opacity-60" : undefined}
            >
             <div className={`group/sub flex items-center gap-3 px-3 py-2 transition sm:px-4 ${previewId === s.id ? "bg-slate-50" : "hover:bg-slate-50"}`}>
              <span
                onMouseDown={() => setHandleId(s.id)}
                onMouseUp={() => setHandleId(null)}
                aria-hidden="true"
                title={canDrag ? "Drag to reorder subcategories" : undefined}
                className={`ml-0 hidden rounded p-0.5 text-slate-400 opacity-0 transition-opacity sm:ml-9 sm:block ${
                  canDrag ? "cursor-grab hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing group-hover/sub:opacity-100" : "invisible"
                }`}
              >
                <GripVertical className="h-4 w-4" />
              </span>
              <span className="w-5 shrink-0 text-right text-xs font-medium tabular-nums text-slate-400">{k + 1}</span>

              {renaming?.id === s.id ? (
                <form
                  className="flex flex-1 items-center gap-1"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (await run(() => api(`/subcategories/${s.id}`, { method: "PATCH", body: { name: renaming.name } }), "Subcategory renamed")) setRenaming(null);
                  }}
                >
                  <input
                    autoFocus
                    aria-label="Subcategory name"
                    value={renaming.name}
                    onChange={(e) => setRenaming({ id: s.id, name: e.target.value })}
                    onKeyDown={(e) => e.key === "Escape" && setRenaming(null)}
                    className={`${inputClass} !mt-0 h-8 max-w-xs py-1`}
                  />
                  <button type="submit" className="rounded-md bg-brand-blue p-1.5 text-white hover:bg-brand-navy" title="Save">
                    <Check className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only">Save</span>
                  </button>
                  <button type="button" onClick={() => setRenaming(null)} className="rounded-md p-1.5 text-slate-600 hover:bg-slate-200" title="Cancel">
                    <X className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only">Cancel</span>
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setPreviewId(previewId === s.id ? null : s.id)}
                  aria-expanded={previewId === s.id}
                  aria-controls={`preview-${s.id}`}
                  className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-sm text-slate-800 hover:text-brand-blue"
                  title="Show the listings in this subcategory"
                >
                  <span className="truncate">
                    <Marked text={s.name} q={highlight} />
                  </span>
                  <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${previewId === s.id ? "rotate-180 text-brand-blue" : ""}`} aria-hidden="true" />
                </button>
              )}

              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs tabular-nums ${s.listingCount ? "bg-brand-navy/5 font-semibold text-brand-navy" : "text-slate-400"}`}>
                {s.listingCount}
                <span className="hidden sm:inline"> {s.listingCount === 1 ? "listing" : "listings"}</span>
              </span>
              <div className="flex shrink-0 items-center">
                <div className="flex sm:opacity-0 sm:transition sm:focus-within:opacity-100 sm:group-hover/sub:opacity-100">
                  <button type="button" aria-label={`Move ${s.name} up`} disabled={k === 0 || !canDrag} onClick={() => step(k, -1)} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30">
                    <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button type="button" aria-label={`Move ${s.name} down`} disabled={k === subs.length - 1 || !canDrag} onClick={() => step(k, 1)} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30">
                    <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => setRenaming({ id: s.id, name: s.name })} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-navy" title="Rename">
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="sr-only">Rename {s.name}</span>
                  </button>
                </div>
                <DeleteButton
                  small
                  label={s.name}
                  locked={s.listingCount > 0}
                  lockedReason={`${s.name} has listings. Change their subcategory before deleting.`}
                  onDelete={() => void run(() => api(`/subcategories/${s.id}`, { method: "DELETE" }), `Removed ${s.name}`)}
                />
              </div>
             </div>
              {previewId === s.id && <ListingPreview sub={s} />}
            </li>
          ))}
        </ol>
      )}

      <form
        className="flex items-center gap-2 border-t border-dashed border-slate-200 px-3 py-2.5 sm:px-4 sm:pl-[4.75rem]"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const added = name.trim();
          if (await run(() => api(`/categories/${c.id}/subcategories`, { method: "POST", body: { name: added } }), `Added ${added}`)) setName("");
          setBusy(false);
        }}
      >
        <label htmlFor={`add-sub-${c.id}`} className="sr-only">
          New subcategory for {c.name}
        </label>
        <Plus className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        <input
          id={`add-sub-${c.id}`}
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`Add a subcategory to ${c.name}`}
          className="h-8 min-w-0 flex-1 border-0 bg-transparent px-1 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-0"
        />
        {name.trim() && (
          <button type="submit" disabled={busy} className={`${buttonClass} h-8 bg-brand-blue px-3 py-1 text-white hover:bg-brand-navy`}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Add
          </button>
        )}
      </form>
    </div>
  );
}

type PreviewRow = { id: string; name: string; status: string; postcode: string; submittedAt: string; zone: { name: string } };
const PREVIEW_SIZE = 5;

/** A short look at the listings in one subcategory, newest first, with a link to the full filtered list. */
function ListingPreview({ sub }: { sub: Sub }) {
  const { data, error, loading } = useAdminData<{ items: PreviewRow[]; total: number; counts: Record<string, number> }>(
    `/listings?subcategory=${encodeURIComponent(sub.id)}&pageSize=${PREVIEW_SIZE}`
  );
  // Open the full list on the tab that has the most listings, live ones first when tied.
  const tab = data ? (["APPROVED", "PENDING", "REJECTED", "REMOVED"] as const).reduce((best, s) => ((data.counts[s] ?? 0) > (data.counts[best] ?? 0) ? s : best), "APPROVED") : "APPROVED";
  const live = data?.counts.APPROVED ?? 0;
  const waiting = data?.counts.PENDING ?? 0;

  return (
    <div id={`preview-${sub.id}`} className="border-t border-slate-100 bg-slate-50/70 px-3 pb-3 pt-2 sm:pl-[7.25rem] sm:pr-4">
      {error ? (
        <ErrorNote error={error} />
      ) : loading && !data ? (
        <div className="space-y-2 py-1">
          {Array.from({ length: Math.min(3, Math.max(1, sub.listingCount)) }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-lg" />
          ))}
        </div>
      ) : data && data.total === 0 ? (
        <p className="py-2 text-sm text-slate-600">No listings in {sub.name} yet. New submissions that choose it will appear here.</p>
      ) : data ? (
        <>
          <p className="pb-2 text-xs text-slate-600">
            {plural(data.total, "listing", "listings")}: {live} live{waiting ? `, ${waiting} waiting for review` : ""}
            {data.total > PREVIEW_SIZE ? `. Showing the newest ${PREVIEW_SIZE}.` : "."}
          </p>
          <ul className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            {data.items.map((l) => (
              <li key={l.id} className="border-b border-slate-100 last:border-0">
                <Link href={`/admin/listings/${l.id}`} className="flex items-center gap-3 px-3 py-2 text-sm transition hover:bg-slate-50">
                  <span className="min-w-0 flex-1 truncate font-medium text-brand-navy">{l.name}</span>
                  <span className="hidden shrink-0 text-xs text-slate-500 sm:inline">
                    {l.postcode}, {l.zone.name}
                  </span>
                  <StatusPill status={l.status} />
                  <span className="hidden shrink-0 text-xs tabular-nums text-slate-500 md:inline">{fmtDate(l.submittedAt).split(",")[0]}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href={`/admin/listings?${new URLSearchParams({ status: tab, subcategory: sub.id })}`}
            className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-teal-dark hover:underline"
          >
            View all in Listings <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </>
      ) : null}
    </div>
  );
}

/** A panel that slides in from the right. Escape or the backdrop closes it. */
function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const [shown, setShown] = useState(false);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close.current();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <div onClick={onClose} className={`absolute inset-0 bg-brand-navy/40 transition-opacity duration-200 ${shown ? "opacity-100" : "opacity-0"}`} />
      <div
        className={`absolute inset-y-0 right-0 flex w-full max-w-lg flex-col bg-white shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none ${
          shown ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 id="drawer-title" className="text-lg font-bold text-brand-navy">
            {title}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Close">
            <X className="h-5 w-5" aria-hidden="true" />
            <span className="sr-only">Close</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

/** The optional subcategory list in the new-category form: type a name, press Enter, repeat. */
function SubcategoryDraft({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const add = () => {
    const n = draft.trim().replace(/\s+/g, " ");
    if (n.length < 2) return setNote("Use at least 2 characters.");
    if (value.some((x) => x.toLowerCase() === n.toLowerCase())) return setNote("That subcategory is already in the list.");
    onChange([...value, n]);
    setDraft("");
    setNote(null);
  };
  const swap = (i: number, j: number) => {
    const next = [...value];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };
  return (
    <div>
      <p className="text-sm font-semibold text-slate-800">
        Subcategories <span className="font-normal text-slate-500">(optional)</span>
      </p>
      <p className="mt-0.5 text-xs text-slate-600">Visitors browse by these. Add them now or later from the list.</p>
      {value.length > 0 && (
        <ol className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
          {value.map((n, i) => (
            <li key={n} className="flex items-center gap-2 px-3 py-1.5 text-sm">
              <span className="w-5 text-right text-xs tabular-nums text-slate-400">{i + 1}</span>
              <span className="flex-1 truncate text-slate-800">{n}</span>
              <button type="button" aria-label={`Move ${n} up`} disabled={i === 0} onClick={() => swap(i, i - 1)} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30">
                <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button type="button" aria-label={`Move ${n} down`} disabled={i === value.length - 1} onClick={() => swap(i, i + 1)} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30">
                <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button type="button" aria-label={`Remove ${n}`} onClick={() => onChange(value.filter((x) => x !== n))} className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-700">
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ol>
      )}
      <div className="mt-2 flex gap-2">
        <label htmlFor="draft-sub" className="sr-only">
          Subcategory name
        </label>
        <input
          id="draft-sub"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setNote(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="e.g. Wedding Photographers"
          className={`${inputClass} !mt-0`}
        />
        <button type="button" onClick={add} className={`${buttonClass} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}>
          <Plus className="h-4 w-4" aria-hidden="true" /> Add
        </button>
      </div>
      {note && <p className="mt-1 text-sm text-red-700">{note}</p>}
    </div>
  );
}

function CategoryForm({
  mode,
  initial,
  position,
  onSave,
  onCancel,
}: {
  mode: "add" | "edit";
  initial: FormValues;
  position: number;
  onSave: (v: FormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [iconQuery, setIconQuery] = useState("");
  const Preview = iconFor(v.icon);
  const icons = Object.keys(CATEGORY_ICONS).filter((n) => n.includes(iconQuery.trim().toLowerCase()));
  const homepage = position <= HOMEPAGE_TILES;

  return (
    <form
      className="flex min-h-full flex-col"
      onSubmit={async (e) => {
        e.preventDefault();
        setErrors({});
        setError(null);
        setBusy(true);
        try {
          await onSave(v);
        } catch (err) {
          if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors);
          else setError(err);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="flex-1 space-y-6 px-6 py-6">
        <div>
          <p className="text-sm font-semibold text-slate-700">Preview</p>
          <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white text-brand-teal shadow-sm ring-1 ring-slate-200">
                <Preview className="h-7 w-7" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-brand-navy">{v.name || "Category name"}</p>
                <p className="text-xs text-slate-600">
                  Position {position}. {homepage ? "Shown as a homepage tile." : "Shown on the Categories page."}
                </p>
              </div>
            </div>
            {v.subs.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {v.subs.map((n) => (
                  <span key={n} className="rounded-full bg-white px-2.5 py-0.5 text-xs text-slate-700 ring-1 ring-slate-200">
                    {n}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="cat-name" className="text-sm font-semibold text-slate-800">
            Name
          </label>
          <input id="cat-name" autoFocus required value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} className={inputClass} />
          {errors.name && <p className="mt-1 text-sm text-red-700">{errors.name}</p>}
        </div>

        {mode === "add" ? (
          <SubcategoryDraft value={v.subs} onChange={(subs) => setV({ ...v, subs })} />
        ) : (
          <div>
            <label htmlFor="cat-slug" className="text-sm font-semibold text-slate-800">
              Web address
            </label>
            <div className="mt-1 flex rounded-lg shadow-sm">
              <span className="inline-flex items-center rounded-l-lg border border-r-0 border-slate-300 bg-slate-50 px-3 text-sm text-slate-600">/categories/</span>
              <input id="cat-slug" required value={v.slug} onChange={(e) => setV({ ...v, slug: e.target.value })} className={`${inputClass} !mt-0 rounded-l-none shadow-none`} />
            </div>
            <p className="mt-1 text-xs text-slate-600">Changing this changes the page address, and old links stop working.</p>
            {errors.slug && <p className="mt-1 text-sm text-red-700">{errors.slug}</p>}
          </div>
        )}
        {errors.subcategories && <p className="text-sm text-red-700">{errors.subcategories}</p>}

        <div>
          <label htmlFor="cat-desc" className="text-sm font-semibold text-slate-800">
            Description <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <textarea id="cat-desc" rows={2} maxLength={300} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} className={inputClass} />
          <p className="mt-1 text-right text-xs tabular-nums text-slate-500">{v.description.length} / 300</p>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <p id="cat-icon" className="text-sm font-semibold text-slate-800">
              Icon
            </p>
            <div className="relative w-40">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <input aria-label="Find an icon" value={iconQuery} onChange={(e) => setIconQuery(e.target.value)} placeholder="Find icon" className={`${inputClass} !mt-0 h-8 py-1 pl-8 text-xs`} />
            </div>
          </div>
          <div role="radiogroup" aria-labelledby="cat-icon" className="mt-2 grid max-h-48 grid-cols-6 gap-1.5 overflow-y-auto rounded-xl border border-slate-200 p-2 sm:grid-cols-8">
            {icons.map((name) => {
              const Icon = iconFor(name);
              const selected = v.icon === name;
              return (
                <button
                  key={name}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={name}
                  title={name}
                  onClick={() => setV({ ...v, icon: name })}
                  className={`flex aspect-square items-center justify-center rounded-lg transition active:scale-95 ${
                    selected ? "bg-brand-navy text-white shadow-sm" : "text-brand-teal-dark hover:bg-slate-100"
                  }`}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </button>
              );
            })}
            {icons.length === 0 && <p className="col-span-full py-4 text-center text-sm text-slate-600">No icon matches that name.</p>}
          </div>
          {errors.icon && <p className="mt-1 text-sm text-red-700">{errors.icon}</p>}
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm text-slate-700 transition hover:border-slate-300">
          <input type="checkbox" checked={v.requiresOwnerName} onChange={(e) => setV({ ...v, requiresOwnerName: e.target.checked })} className="mt-0.5 h-4 w-4 accent-brand-blue" />
          <span>
            <span className="block font-semibold text-slate-800">Owner name required</span>
            Listings in this category must give the owner or service provider name (as for Independent Professionals).
          </span>
        </label>

        {mode === "edit" && <p className="text-xs text-slate-600">Subcategories are added, renamed and reordered in the list on the main page.</p>}
        <ErrorNote error={error} />
      </div>

      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4">
        <button type="button" onClick={onCancel} className={`${buttonClass} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}>
          Cancel
        </button>
        <button type="submit" disabled={busy} className={`${buttonClass} bg-brand-blue text-white hover:bg-brand-navy`}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {mode === "add" ? (v.subs.length ? `Create with ${plural(v.subs.length, "subcategory", "subcategories")}` : "Create category") : "Save changes"}
        </button>
      </div>
    </form>
  );
}
