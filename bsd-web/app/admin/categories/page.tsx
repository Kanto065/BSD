"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { ApiError, useSession } from "@/lib/admin-session";
import { CATEGORY_ICONS, iconFor } from "@/lib/category-icons";
import { Card, ErrorNote, PageTitle, buttonClass, inputClass, useAdminData } from "@/components/admin/ui";
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
  listingCount: number;
  subcategories: Sub[];
};

function IconPicker({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  return (
    <div role="radiogroup" aria-labelledby={id} className="mt-1 grid max-h-40 grid-cols-8 gap-1 overflow-y-auto rounded-md border border-slate-200 p-2 sm:grid-cols-12">
      {Object.keys(CATEGORY_ICONS).map((name) => {
        const Icon = iconFor(name);
        const selected = value === name;
        return (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={name}
            title={name}
            onClick={() => onChange(name)}
            className={`flex h-9 items-center justify-center rounded-md ${selected ? "bg-brand-navy text-white" : "text-brand-teal hover:bg-slate-100"}`}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

// Categories and subcategories as they appear on the website (the site picks up changes within about a minute).
export default function CategoriesPage() {
  const { api } = useSession();
  const { data, error, reload } = useAdminData<{ categories: Cat[] }>("/categories");
  const [actionError, setActionError] = useState<unknown>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  async function run(fn: () => Promise<unknown>) {
    setActionError(null);
    try {
      await fn();
      await reload();
      return true;
    } catch (e) {
      setActionError(e);
      return false;
    }
  }

  const cats = data?.categories ?? [];
  const move = (index: number, dir: -1 | 1) => {
    const ids = cats.map((c) => c.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    void run(() => api("/categories/reorder", { method: "POST", body: { ids } }));
  };

  return (
    <div className="space-y-6">
      <PageTitle sub={`The order here is the order on the website. The first ${HOMEPAGE_TILES} are the homepage tiles. Changes appear on the site within about a minute.`}>
        Categories
      </PageTitle>
      <ErrorNote error={error ?? actionError} />

      <div>
        <button type="button" onClick={() => setAdding((v) => !v)} className={`${buttonClass} bg-brand-blue text-white hover:bg-brand-navy`}>
          <Plus className="h-4 w-4" aria-hidden="true" /> Add a category
        </button>
      </div>
      {adding && (
        <CategoryForm
          title="New category"
          initial={{ name: "", slug: "", description: "", icon: "package", requiresOwnerName: false }}
          showSlug={false}
          onCancel={() => setAdding(false)}
          onSave={async (v) => {
            await api("/categories", { method: "POST", body: { name: v.name, description: v.description || null, icon: v.icon, requiresOwnerName: v.requiresOwnerName } });
            setAdding(false);
            await reload();
          }}
        />
      )}

      <div className="space-y-3">
        {cats.map((c, i) => {
          const Icon = iconFor(c.icon);
          return (
            <Card key={c.id}>
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex flex-col">
                  <button type="button" aria-label={`Move ${c.name} up`} disabled={i === 0} onClick={() => move(i, -1)} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30">
                    <ArrowUp className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button type="button" aria-label={`Move ${c.name} down`} disabled={i === cats.length - 1} onClick={() => move(i, 1)} className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30">
                    <ArrowDown className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                <Icon className="mt-1 h-7 w-7 shrink-0 text-brand-teal" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-brand-navy">
                    {i + 1}. {c.name}
                    {i < HOMEPAGE_TILES && <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-brand-blue">homepage</span>}
                  </p>
                  <p className="text-xs text-slate-500">
                    /categories/{c.slug} · {c.listingCount} listing{c.listingCount === 1 ? "" : "s"}
                    {c.requiresOwnerName ? " · owner name required" : ""}
                  </p>
                  {c.description && <p className="mt-1 text-sm text-slate-600">{c.description}</p>}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditing(editing === c.id ? null : c.id)} className={`${buttonClass} border border-slate-300 bg-white text-slate-700`}>
                    <Pencil className="h-4 w-4" aria-hidden="true" /> Edit
                  </button>
                  <button
                    type="button"
                    disabled={c.listingCount > 0}
                    title={c.listingCount > 0 ? "Move its listings to another category first" : undefined}
                    onClick={() => {
                      if (window.confirm(`Delete the category "${c.name}" and its subcategories?`)) void run(() => api(`/categories/${c.id}`, { method: "DELETE" }));
                    }}
                    className={`${buttonClass} border border-red-200 bg-white text-red-700 hover:bg-red-50`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete
                  </button>
                </div>
              </div>

              {editing === c.id && (
                <div className="mt-4">
                  <CategoryForm
                    title={`Edit ${c.name}`}
                    initial={{ name: c.name, slug: c.slug, description: c.description ?? "", icon: c.icon ?? "package", requiresOwnerName: c.requiresOwnerName }}
                    showSlug
                    onCancel={() => setEditing(null)}
                    onSave={async (v) => {
                      await api(`/categories/${c.id}`, {
                        method: "PATCH",
                        body: { name: v.name, slug: v.slug, description: v.description || null, icon: v.icon, requiresOwnerName: v.requiresOwnerName },
                      });
                      setEditing(null);
                      await reload();
                    }}
                  />
                </div>
              )}

              <Subcategories category={c} run={run} />
            </Card>
          );
        })}
      </div>
    </div>
  );
}

type FormValues = { name: string; slug: string; description: string; icon: string; requiresOwnerName: boolean };

function CategoryForm({
  title,
  initial,
  showSlug,
  onSave,
  onCancel,
}: {
  title: string;
  initial: FormValues;
  showSlug: boolean;
  onSave: (v: FormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(null);
  const id = `f-${title.replace(/\W+/g, "-")}`;
  return (
    <form
      className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setErrors({});
        setError(null);
        try {
          await onSave(v);
        } catch (err) {
          if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors);
          else setError(err);
        }
      }}
    >
      <p className="font-semibold text-brand-navy">{title}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-name`} className="text-sm font-semibold text-brand-navy">
            Name
          </label>
          <input id={`${id}-name`} required value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} className={inputClass} />
          {errors.name && <p className="mt-1 text-sm text-red-700">{errors.name}</p>}
        </div>
        {showSlug && (
          <div>
            <label htmlFor={`${id}-slug`} className="text-sm font-semibold text-brand-navy">
              Web address
            </label>
            <input id={`${id}-slug`} required value={v.slug} onChange={(e) => setV({ ...v, slug: e.target.value })} className={inputClass} />
            <p className="mt-1 text-xs text-slate-500">Changing this changes the page address, and old links stop working.</p>
            {errors.slug && <p className="mt-1 text-sm text-red-700">{errors.slug}</p>}
          </div>
        )}
      </div>
      <div>
        <label htmlFor={`${id}-desc`} className="text-sm font-semibold text-brand-navy">
          Description <span className="font-normal text-slate-500">(optional)</span>
        </label>
        <input id={`${id}-desc`} maxLength={300} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} className={inputClass} />
      </div>
      <div>
        <p id={`${id}-icon`} className="text-sm font-semibold text-brand-navy">
          Icon
        </p>
        <IconPicker id={`${id}-icon`} value={v.icon} onChange={(icon) => setV({ ...v, icon })} />
        {errors.icon && <p className="mt-1 text-sm text-red-700">{errors.icon}</p>}
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={v.requiresOwnerName} onChange={(e) => setV({ ...v, requiresOwnerName: e.target.checked })} className="accent-brand-blue" />
        Listings in this category must give the owner or service provider name (as for Independent Professionals)
      </label>
      <ErrorNote error={error} />
      <div className="flex gap-2">
        <button type="submit" className={`${buttonClass} bg-brand-blue text-white hover:bg-brand-navy`}>
          Save
        </button>
        <button type="button" onClick={onCancel} className={`${buttonClass} bg-white text-slate-700`}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function Subcategories({ category: c, run }: { category: Cat; run: (fn: () => Promise<unknown>) => Promise<boolean> }) {
  const { api } = useSession();
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-sm font-semibold text-brand-teal-dark">Subcategories ({c.subcategories.length})</summary>
      <ul className="mt-2 space-y-1">
        {c.subcategories.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-2 text-sm">
            {renaming?.id === s.id ? (
              <form
                className="flex flex-1 gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (await run(() => api(`/subcategories/${s.id}`, { method: "PATCH", body: { name: renaming.name } }))) setRenaming(null);
                }}
              >
                <input aria-label="Subcategory name" value={renaming.name} onChange={(e) => setRenaming({ id: s.id, name: e.target.value })} className={`${inputClass} !mt-0`} />
                <button type="submit" className={`${buttonClass} bg-brand-blue text-white`}>
                  Save
                </button>
                <button type="button" onClick={() => setRenaming(null)} className={`${buttonClass} bg-white text-slate-700`}>
                  Cancel
                </button>
              </form>
            ) : (
              <>
                <span className="flex-1 text-slate-800">
                  {s.name} <span className="text-xs text-slate-500">({s.listingCount})</span>
                </span>
                <button type="button" onClick={() => setRenaming({ id: s.id, name: s.name })} className="text-xs font-semibold text-brand-teal-dark hover:underline">
                  Rename
                </button>
                <button
                  type="button"
                  disabled={s.listingCount > 0}
                  title={s.listingCount > 0 ? "Change the subcategory of its listings first" : undefined}
                  onClick={() => {
                    if (window.confirm(`Delete the subcategory "${s.name}"?`)) void run(() => api(`/subcategories/${s.id}`, { method: "DELETE" }));
                  }}
                  className="text-xs font-semibold text-red-700 hover:underline disabled:text-slate-400 disabled:no-underline"
                >
                  Delete
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      <form
        className="mt-2 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run(() => api(`/categories/${c.id}/subcategories`, { method: "POST", body: { name } }))) setName("");
        }}
      >
        <label htmlFor={`add-sub-${c.id}`} className="sr-only">
          New subcategory for {c.name}
        </label>
        <input id={`add-sub-${c.id}`} required value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a subcategory" className={`${inputClass} !mt-0`} />
        <button type="submit" className={`${buttonClass} border border-slate-300 bg-white text-slate-700`}>
          <Plus className="h-4 w-4" aria-hidden="true" /> Add
        </button>
      </form>
    </details>
  );
}
