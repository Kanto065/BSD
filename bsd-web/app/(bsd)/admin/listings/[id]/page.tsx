"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, Trash2 } from "lucide-react";
import VerificationBadge, { type VerificationStatus } from "@/components/VerificationBadge";
import { ApiError, atLeast, useSession } from "@/lib/admin-session";
import { Card, ErrorNote, StatusPill, buttonClass, fmtDate, inputClass, useAdminData } from "@/components/admin/ui";
import { ZONES } from "@/lib/content";
import { localitySlug } from "@/lib/slug";
import type { CategoryOption } from "@/lib/taxonomy";

type NameSlug = { name: string; slug: string };
type Listing = {
  id: string;
  slug: string;
  name: string;
  status: string;
  verificationStatus: VerificationStatus;
  description: string;
  servicesOffered: string[];
  ownerName: string | null;
  phone: string;
  whatsapp: string | null;
  email: string | null;
  websiteOrSocial: string | null;
  address: string | null;
  postcode: string;
  otherAreaText: string | null;
  openingHours: string | null;
  specialNotes: string | null;
  rejectionReason: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  verifiedAt: string | null;
  consentAccurateInfo: boolean;
  consentPublishPermission: boolean;
  consentNoLiability: boolean;
  consentDataStorage: boolean;
  gdprConsentStorage: boolean;
  gdprConsentRights: boolean;
  category: NameSlug & { requiresOwnerName: boolean };
  subcategory: NameSlug | null;
  zone: NameSlug;
  servedZones: { zone: NameSlug }[];
  localities: { locality: NameSlug }[];
  photos: { id: string; url: string; thumbUrl: string | null; isLogo: boolean; width: number | null; height: number | null; sizeBytes: number }[];
  reviewedBy: { name: string } | null;
  verifiedBy: { name: string } | null;
};
type History = { id: string; action: string; createdAt: string; details: unknown; admin: { name: string } };

const ACTION_LABEL: Record<string, string> = {
  APPROVE_LISTING: "Approved",
  REJECT_LISTING: "Rejected",
  REMOVE_LISTING: "Removed",
  EDIT_LISTING: "Edited",
  SET_VERIFICATION: "Verification changed",
  REMOVE_PHOTO: "Photo removed",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-slate-100 py-2 sm:grid-cols-[11rem_1fr]">
      <dt className="text-sm font-semibold text-slate-600">{label}</dt>
      <dd className="whitespace-pre-line break-words text-sm text-slate-800">{children || <span className="text-slate-400">none</span>}</dd>
    </div>
  );
}

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { api, admin } = useSession();
  const { data, error, reload } = useAdminData<{ listing: Listing; history: History[] }>(`/listings/${encodeURIComponent(id)}`);
  const [actionError, setActionError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [editing, setEditing] = useState(false);

  async function act(path: string, method: string, body?: unknown) {
    setBusy(true);
    setActionError(null);
    try {
      await api(path, { method, body });
      await reload();
      return true;
    } catch (e) {
      setActionError(e);
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (error) return <ErrorNote error={error} />;
  if (!data) return <p className="text-slate-500">Loading</p>;
  const l = data.listing;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/listings" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-teal-dark hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Listings
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-brand-navy">{l.name}</h1>
          <StatusPill status={l.status} />
          {l.status === "APPROVED" && (
            <a href={`/businesses/${l.slug}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-teal-dark hover:underline">
              View live <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Submitted {fmtDate(l.submittedAt)}
          {l.reviewedBy ? ` · last reviewed by ${l.reviewedBy.name} on ${fmtDate(l.reviewedAt)}` : ""}
        </p>
      </div>

      <Card title="Decision">
        <div className="flex flex-wrap gap-2">
          {l.status !== "APPROVED" && (
            <button type="button" disabled={busy} onClick={() => act(`/listings/${l.id}/approve`, "PATCH")} className={`${buttonClass} bg-green-700 text-white hover:bg-green-800`}>
              Approve and publish
            </button>
          )}
          {l.status !== "REJECTED" && (
            <button type="button" disabled={busy} onClick={() => setRejecting(true)} className={`${buttonClass} border border-red-300 bg-white text-red-800 hover:bg-red-50`}>
              Reject
            </button>
          )}
          {l.status !== "REMOVED" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm("Remove this listing from the directory? It is kept in the records and can be approved again later.")) {
                  void act(`/listings/${l.id}`, "DELETE", {});
                }
              }}
              className={`${buttonClass} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}
            >
              Remove
            </button>
          )}
          <button type="button" onClick={() => setEditing((v) => !v)} className={`${buttonClass} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}>
            {editing ? "Close editor" : "Edit details"}
          </button>
        </div>
        {rejecting && (
          <form
            className="mt-4 space-y-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await act(`/listings/${l.id}/reject`, "PATCH", { reason })) {
                setRejecting(false);
                setReason("");
              }
            }}
          >
            <label htmlFor="reason" className="text-sm font-semibold text-brand-navy">
              Reason for rejecting (kept for the record)
            </label>
            <textarea id="reason" required minLength={3} maxLength={500} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} />
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className={`${buttonClass} bg-red-700 text-white hover:bg-red-800`}>
                Reject listing
              </button>
              <button type="button" onClick={() => setRejecting(false)} className={`${buttonClass} bg-white text-slate-700`}>
                Cancel
              </button>
            </div>
          </form>
        )}
        {l.rejectionReason && l.status === "REJECTED" && <p className="mt-3 text-sm text-red-800">Rejected because: {l.rejectionReason}</p>}
        <div className="mt-4">
          <ErrorNote error={actionError} />
        </div>
      </Card>

      {l.status === "APPROVED" && (
        <Card title="Community verification">
          <div className="flex flex-wrap items-center gap-3">
            <VerificationBadge status={l.verificationStatus} />
            {l.verifiedBy && <span className="text-sm text-slate-600">by {l.verifiedBy.name}, {fmtDate(l.verifiedAt)}</span>}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(["NEWLY_LISTED", "PENDING_VERIFICATION", "COMMUNITY_VERIFIED"] as const)
              .filter((s) => s !== l.verificationStatus)
              .map((s) => (
                <button key={s} type="button" disabled={busy} onClick={() => act(`/listings/${l.id}/verification`, "PATCH", { status: s })} className={`${buttonClass} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}>
                  Set: <VerificationBadge status={s} size="sm" />
                </button>
              ))}
          </div>
        </Card>
      )}

      {editing && <EditForm listing={l} onSaved={() => { setEditing(false); void reload(); }} />}

      <Card title="Submitted details">
        <dl>
          <Row label="Category">
            {l.category.name}
            {l.subcategory ? ` · ${l.subcategory.name}` : ""}
          </Row>
          <Row label="Description">{l.description}</Row>
          <Row label="Services">{l.servicesOffered.join("\n")}</Row>
          <Row label="Owner / provider">{l.ownerName}</Row>
          <Row label="Phone">{l.phone}</Row>
          <Row label="WhatsApp">{l.whatsapp}</Row>
          <Row label="Email">{l.email}</Row>
          <Row label="Website / social">{l.websiteOrSocial}</Row>
          <Row label="Address">{l.address}</Row>
          <Row label="Postcode">
            {l.postcode} ({l.zone.name})
          </Row>
          <Row label="Areas served">
            {[...l.servedZones.map((z) => `All of ${z.zone.name}`), ...l.localities.map((x) => x.locality.name), ...(l.otherAreaText ? [`Other: ${l.otherAreaText}`] : [])].join("\n")}
          </Row>
          <Row label="Opening hours">{l.openingHours}</Row>
          <Row label="Special notes">{l.specialNotes}</Row>
          <Row label="Consents">
            {[l.consentAccurateInfo, l.consentPublishPermission, l.consentNoLiability, l.consentDataStorage, l.gdprConsentStorage, l.gdprConsentRights].every(Boolean)
              ? "All six given"
              : "Missing"}
          </Row>
        </dl>
      </Card>

      <Card title={`Images (${l.photos.length})`}>
        {l.photos.length === 0 ? (
          <p className="text-sm text-slate-500">No images were uploaded.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {l.photos.map((p) => (
              <figure key={p.id} className="rounded-lg border border-slate-200 p-2">
                <a href={p.url} target="_blank" rel="noopener">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.thumbUrl ?? p.url} alt="" className="h-44 w-full rounded object-contain" />
                </a>
                <figcaption className="mt-2 flex items-center justify-between text-xs text-slate-600">
                  <span>
                    {p.isLogo ? "Logo" : "Photo"} · {p.width}×{p.height} · {Math.round(p.sizeBytes / 1024)} KB
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm("Delete this image permanently?")) void act(`/listings/${l.id}/photos/${p.id}`, "DELETE");
                    }}
                    className="inline-flex items-center gap-1 font-semibold text-red-700 hover:underline"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete
                  </button>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </Card>

      {atLeast(admin?.role, "MODERATOR") && (
        <Card title="History">
          {data.history.length === 0 ? (
            <p className="text-sm text-slate-500">No actions yet.</p>
          ) : (
            <ol className="space-y-2 text-sm">
              {data.history.map((h) => (
                <li key={h.id} className="border-b border-slate-100 pb-2">
                  <span className="font-semibold text-brand-navy">{ACTION_LABEL[h.action] ?? h.action}</span> by {h.admin.name}{" "}
                  <span className="text-slate-500">· {fmtDate(h.createdAt)}</span>
                  {h.details ? <HistoryDetails details={h.details} /> : null}
                </li>
              ))}
            </ol>
          )}
        </Card>
      )}
    </div>
  );
}

function HistoryDetails({ details }: { details: unknown }) {
  if (!details || typeof details !== "object") return null;
  const entries = Object.entries(details as Record<string, unknown>);
  return (
    <ul className="mt-1 space-y-0.5 pl-4 text-xs text-slate-600">
      {entries.map(([k, v]) => {
        const change = v && typeof v === "object" && "from" in (v as object) ? (v as { from: unknown; to: unknown }) : null;
        const show = (x: unknown) => (Array.isArray(x) ? x.join(", ") : x === null || x === undefined ? "empty" : String(x));
        return (
          <li key={k}>
            {k}: {change ? `${show(change.from).slice(0, 80)} → ${show(change.to).slice(0, 80)}` : show(v).slice(0, 160)}
          </li>
        );
      })}
    </ul>
  );
}

function EditForm({ listing: l, onSaved }: { listing: Listing; onSaved: () => void }) {
  const { api, apiBase } = useSession();
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  useEffect(() => {
    fetch(`${apiBase}/categories`)
      .then((r) => r.json())
      .then((d: { categories: CategoryOption[] }) => setCategories(d.categories))
      .catch(() => setCategories([]));
  }, [apiBase]);
  const [f, setF] = useState({
    name: l.name,
    category: l.category.slug,
    subcategory: l.subcategory?.slug ?? "",
    description: l.description,
    services: l.servicesOffered.join("\n"),
    ownerName: l.ownerName ?? "",
    phone: l.phone,
    whatsapp: l.whatsapp ?? "",
    email: l.email ?? "",
    websiteOrSocial: l.websiteOrSocial ?? "",
    address: l.address ?? "",
    postcode: l.postcode,
    otherAreaText: l.otherAreaText ?? "",
    openingHours: l.openingHours ?? "",
    specialNotes: l.specialNotes ?? "",
  });
  const [zones, setZones] = useState(l.servedZones.map((z) => z.zone.slug));
  const [localities, setLocalities] = useState(l.localities.map((x) => x.locality.slug));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const category = categories.find((c) => c.slug === f.category);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const toggle = (list: string[], v: string, fn: (x: string[]) => void) => fn(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const text = (k: keyof typeof f, label: string, rows = 0) => (
    <div>
      <label htmlFor={`e-${k}`} className="text-sm font-semibold text-brand-navy">
        {label}
      </label>
      {rows ? (
        <textarea id={`e-${k}`} rows={rows} value={f[k]} onChange={set(k)} className={inputClass} />
      ) : (
        <input id={`e-${k}`} value={f[k]} onChange={set(k)} className={inputClass} />
      )}
      {errors[k === "services" ? "servicesOffered" : k] && <p className="mt-1 text-sm font-medium text-red-700">{errors[k === "services" ? "servicesOffered" : k]}</p>}
    </div>
  );

  return (
    <Card title="Edit details">
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErrors({});
          setError(null);
          try {
            await api(`/listings/${l.id}`, {
              method: "PATCH",
              body: {
                name: f.name,
                category: f.category,
                subcategory: f.subcategory || null,
                description: f.description,
                servicesOffered: f.services.split("\n").map((s) => s.trim()).filter(Boolean),
                ownerName: f.ownerName || null,
                phone: f.phone,
                whatsapp: f.whatsapp || null,
                email: f.email || null,
                websiteOrSocial: f.websiteOrSocial || null,
                address: f.address || null,
                postcode: f.postcode,
                serveZones: zones,
                localities,
                otherAreaText: f.otherAreaText || null,
                openingHours: f.openingHours || null,
                specialNotes: f.specialNotes || null,
              },
            });
            onSaved();
          } catch (err) {
            if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors);
            else setError(err);
          } finally {
            setBusy(false);
          }
        }}
      >
        {text("name", "Business / Service Name")}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="e-category" className="text-sm font-semibold text-brand-navy">
              Category
            </label>
            <select id="e-category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value, subcategory: "" })} className={inputClass}>
              {categories.length === 0 && <option value={f.category}>{l.category.name}</option>}
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="e-subcategory" className="text-sm font-semibold text-brand-navy">
              Subcategory
            </label>
            <select id="e-subcategory" value={f.subcategory} onChange={set("subcategory")} className={inputClass}>
              <option value="">None</option>
              {category?.subcategories.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
            {errors.subcategory && <p className="mt-1 text-sm font-medium text-red-700">{errors.subcategory}</p>}
          </div>
        </div>
        <div className="sm:col-span-2">{text("description", "Short Description (50–150 words)", 5)}</div>
        {text("services", "Services Offered (one per line)", 4)}
        {text("specialNotes", "Special Notes", 4)}
        {text("ownerName", "Owner / Service Provider Name")}
        {text("phone", "Phone Number")}
        {text("whatsapp", "WhatsApp Number")}
        {text("email", "Email Address")}
        {text("websiteOrSocial", "Website / Social Media")}
        {text("openingHours", "Opening Hours", 2)}
        {text("address", "Address")}
        {text("postcode", "Postcode")}
        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-semibold text-brand-navy">Areas served</legend>
          <div className="mt-2 grid gap-3 lg:grid-cols-3">
            {ZONES.map((z) => (
              <div key={z.slug} className="rounded-md border border-slate-200 p-2 text-sm">
                <label className="flex items-center gap-2 font-semibold">
                  <input type="checkbox" checked={zones.includes(z.slug)} onChange={() => toggle(zones, z.slug, setZones)} className="accent-brand-blue" />
                  All of {z.name}
                </label>
                <div className="mt-1 max-h-40 overflow-y-auto pl-1">
                  {z.localities.map((name) => {
                    const v = localitySlug(name);
                    return (
                      <label key={v} className="flex items-center gap-2 text-slate-700">
                        <input type="checkbox" checked={localities.includes(v)} onChange={() => toggle(localities, v, setLocalities)} className="accent-brand-blue" />
                        {name}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {errors.serveZones && <p className="mt-1 text-sm font-medium text-red-700">{errors.serveZones}</p>}
          <div className="mt-2">{text("otherAreaText", "Other areas")}</div>
        </fieldset>
        <div className="sm:col-span-2">
          <ErrorNote error={error} />
          {Object.keys(errors).length > 0 && <p className="text-sm font-medium text-red-700">Please check the highlighted fields.</p>}
          <button type="submit" disabled={busy} className={`${buttonClass} mt-2 bg-brand-blue text-white hover:bg-brand-navy`}>
            Save changes
          </button>
        </div>
      </form>
    </Card>
  );
}
