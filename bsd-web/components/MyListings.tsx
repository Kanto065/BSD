"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { FieldError, helpClass, inputClass, labelClass } from "@/components/BusinessFields";
import { ZONES, zoneShortLabel } from "@/lib/content";
import { descriptionStatus } from "@/lib/description";
import { HIDE_ADDRESS_LABEL, serviceList } from "@/lib/business-profile";
import { ApiError } from "@/lib/admin-session";
import { getOwnListing, getOwnListings, memberCall, patchOwnListing, type OwnListing, type OwnListingSummary } from "@/lib/member-api";

// The member's own listings, with a form to change the contact and descriptive fields. Name, category, postcode and
// zone stay with the BSD team (they change moderation or the zone), so the owner is pointed to the update request form.

const STATUS_WORDS: Record<OwnListingSummary["status"], { text: string; style: string }> = {
  PENDING: { text: "Waiting for review", style: "bg-amber-50 text-amber-900 border-amber-300" },
  APPROVED: { text: "Live", style: "bg-green-50 text-green-900 border-green-300" },
  REJECTED: { text: "Not accepted", style: "bg-red-50 text-red-900 border-red-300" },
  REMOVED: { text: "Removed", style: "bg-slate-100 text-slate-700 border-slate-300" },
};

const dateText = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

type View = "checking" | "out" | "list" | { edit: string };

export default function MyListings({ apiBase }: { apiBase: string }) {
  const [view, setView] = useState<View>("checking");
  const [items, setItems] = useState<OwnListingSummary[]>([]);
  const [failed, setFailed] = useState(false);

  async function load() {
    try {
      setItems((await getOwnListings(apiBase)).items);
      setFailed(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return setView("out");
      setFailed(true);
    }
    setView("list");
  }

  useEffect(() => {
    memberCall(apiBase, "me")
      .then((r) => (r.user ? load() : setView("out")))
      .catch(() => setView("out"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase]);

  if (view === "checking") return <div aria-busy="true" className="h-40 animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none" />;
  if (view === "out") {
    return (
      <p className="text-slate-600">
        Please{" "}
        <Link href="/account" className="font-semibold text-brand-teal-dark underline">
          sign in
        </Link>{" "}
        to see your listings.
      </p>
    );
  }
  if (typeof view === "object") {
    return (
      <EditListing
        apiBase={apiBase}
        id={view.edit}
        onBack={() => {
          void load();
          setView("list");
        }}
      />
    );
  }

  if (failed) return <p className="text-red-700">We could not load your listings. Please try again in a few minutes.</p>;
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-slate-200 p-6">
        <p className="text-slate-700">You have not submitted a listing yet.</p>
        <Link href="/submit" className="mt-4 inline-flex min-h-11 items-center rounded-md bg-brand-navy px-6 font-semibold text-white hover:bg-brand-blue">
          Submit your listing
        </Link>
      </div>
    );
  }
  return (
    <ul className="space-y-4">
      {items.map((l) => {
        const status = STATUS_WORDS[l.status];
        return (
          <li key={l.id} className="rounded-2xl border border-slate-200 p-5 shadow-[0_1px_2px_rgba(12,46,66,0.05)]">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-heading text-lg font-bold text-brand-navy">{l.name}</h2>
              <span className={`rounded-full border px-3 py-0.5 text-xs font-semibold ${status.style}`}>{status.text}</span>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {l.category.name}. Submitted {dateText(l.submittedAt)}.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {l.status === "APPROVED" && (
                <Link href={`/businesses/${l.slug}`} className="inline-flex min-h-11 items-center rounded-md border border-slate-300 px-5 text-sm font-semibold text-brand-navy hover:border-brand-blue">
                  View
                </Link>
              )}
              {(l.status === "PENDING" || l.status === "APPROVED") && (
                <button type="button" onClick={() => setView({ edit: l.id })} className="inline-flex min-h-11 items-center rounded-md bg-brand-navy px-5 text-sm font-semibold text-white hover:bg-brand-blue">
                  Edit
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

type Draft = {
  description: string;
  services: string;
  ownerName: string;
  phone: string;
  whatsapp: string;
  email: string;
  showEmail: boolean;
  website: string;
  address: string;
  hideFullAddress: boolean;
  openingHours: string;
  specialNotes: string;
  serveZones: string[];
  otherAreaText: string;
};

const toDraft = (l: OwnListing): Draft => ({
  description: l.description,
  services: l.servicesOffered.join("\n"),
  ownerName: l.ownerName ?? "",
  phone: l.phone,
  whatsapp: l.whatsapp ?? "",
  email: l.email ?? "",
  showEmail: l.showEmail,
  website: l.websiteOrSocial ?? "",
  address: l.address ?? "",
  hideFullAddress: l.hideFullAddress,
  openingHours: l.openingHours ?? "",
  specialNotes: l.specialNotes ?? "",
  serveZones: l.serveZones,
  otherAreaText: l.otherAreaText ?? "",
});

function EditListing({ apiBase, id, onBack }: { apiBase: string; id: string; onBack: () => void }) {
  const [listing, setListing] = useState<OwnListing | null>(null);
  const [d, setD] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getOwnListing(apiBase, id)
      .then((r) => {
        setListing(r.listing);
        setD(toDraft(r.listing));
      })
      .catch(() => setMessage({ ok: false, text: "We could not load this listing." }));
  }, [apiBase, id]);

  if (!listing || !d) {
    return message ? <p className="text-red-700">{message.text}</p> : <div aria-busy="true" className="h-40 animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none" />;
  }
  const set = (patch: Partial<Draft>) => {
    setD({ ...d, ...patch });
    setMessage(null);
  };
  const desc = descriptionStatus(d.description);
  const ownerRequired = listing.category.requiresOwnerName;
  const err = (key: string) => (errors[key] ? { "aria-invalid": true, "aria-describedby": `${key}-error` } : {});

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!d) return;
    setBusy(true);
    setMessage(null);
    setErrors({});
    try {
      const r = await patchOwnListing(apiBase, id, {
        description: d.description.trim(),
        servicesOffered: serviceList(d.services),
        ownerName: d.ownerName.trim(),
        phone: d.phone.trim(),
        whatsapp: d.whatsapp.trim(),
        email: d.email.trim(),
        showEmail: d.showEmail,
        websiteOrSocial: d.website.trim(),
        address: d.address.trim(),
        hideFullAddress: d.hideFullAddress,
        openingHours: d.openingHours.trim(),
        specialNotes: d.specialNotes.trim(),
        serveZones: d.serveZones,
        otherAreaText: d.otherAreaText.trim(),
      });
      setListing(r.listing);
      setD(toDraft(r.listing));
      setMessage({ ok: true, text: "Saved. Changes appear on your public listing within a minute." });
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length) {
        setErrors(error.fieldErrors);
        setMessage({ ok: false, text: "Please check the highlighted fields." });
        requestAnimationFrame(() => document.getElementById(Object.keys(error.fieldErrors)[0]!)?.focus());
      } else setMessage({ ok: false, text: error instanceof ApiError ? error.message : "Could not save your changes. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form noValidate onSubmit={onSave} className="space-y-6">
      <div>
        <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand-teal-dark hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Your listings
        </button>
        <h2 className="font-heading text-xl font-bold text-brand-navy">{listing.name}</h2>
        <p className="mt-1 text-sm text-slate-600">To change the name, category or postcode, use Request an update on your listing page.</p>
      </div>

      <div>
        <label htmlFor="description" className={labelClass}>
          Short Description (at least 150 characters)
        </label>
        <textarea id="description" rows={6} value={d.description} onChange={(e) => set({ description: e.target.value })} maxLength={2000} className={inputClass} {...err("description")} />
        <p className={`mt-1 text-xs font-medium ${desc.chars === 0 || desc.ok ? "text-slate-500" : "text-red-700"}`} aria-live="polite">
          {desc.counter}
        </p>
        <FieldError id="description" message={errors.description} />
      </div>
      <div>
        <label htmlFor="servicesOffered" className={labelClass}>
          Services Offered
        </label>
        <p className={helpClass}>One service per line.</p>
        <textarea id="servicesOffered" rows={4} value={d.services} onChange={(e) => set({ services: e.target.value })} className={inputClass} {...err("servicesOffered")} />
        <FieldError id="servicesOffered" message={errors.servicesOffered} />
      </div>
      <div>
        <label htmlFor="ownerName" className={labelClass}>
          Owner / Service Provider Name <span className="font-normal text-slate-500">{ownerRequired ? "(required for this category)" : "(optional)"}</span>
        </label>
        <p className={helpClass}>Required for personal services. It is not shown on your public listing.</p>
        <input id="ownerName" value={d.ownerName} onChange={(e) => set({ ownerName: e.target.value })} maxLength={120} className={inputClass} {...err("ownerName")} />
        <FieldError id="ownerName" message={errors.ownerName} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="phone" className={labelClass}>
            Phone Number
          </label>
          <p className={helpClass}>Will be publicly displayed.</p>
          <input id="phone" type="tel" autoComplete="tel" value={d.phone} onChange={(e) => set({ phone: e.target.value })} maxLength={25} className={inputClass} {...err("phone")} />
          <FieldError id="phone" message={errors.phone} />
        </div>
        <div>
          <label htmlFor="whatsapp" className={labelClass}>
            WhatsApp Number <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <p className={helpClass}>Will be publicly displayed.</p>
          <input id="whatsapp" type="tel" value={d.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} maxLength={25} className={inputClass} {...err("whatsapp")} />
          <FieldError id="whatsapp" message={errors.whatsapp} />
        </div>
      </div>
      <div>
        <label htmlFor="email" className={labelClass}>
          Email Address <span className="font-normal text-slate-500">(optional)</span>
        </label>
        <input id="email" type="email" autoComplete="email" value={d.email} onChange={(e) => set({ email: e.target.value })} maxLength={200} className={inputClass} {...err("email")} />
        <FieldError id="email" message={errors.email} />
        <label htmlFor="showEmail" className="mt-2 flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-brand-navy">
          <input id="showEmail" type="checkbox" checked={d.showEmail} onChange={(e) => set({ showEmail: e.target.checked })} className="h-5 w-5 shrink-0 accent-brand-blue" {...err("showEmail")} />
          Show my email address on my public listing
        </label>
        <FieldError id="showEmail" message={errors.showEmail} />
        <p className={helpClass}>Leave this off to keep your email private. We will still use it to contact you.</p>
      </div>
      <div>
        <label htmlFor="websiteOrSocial" className={labelClass}>
          Website / Facebook Page / Social Media <span className="font-normal text-slate-500">(optional)</span>
        </label>
        <input id="websiteOrSocial" value={d.website} onChange={(e) => set({ website: e.target.value })} maxLength={300} className={inputClass} {...err("websiteOrSocial")} />
        <FieldError id="websiteOrSocial" message={errors.websiteOrSocial} />
      </div>
      <div>
        <label htmlFor="address" className={labelClass}>
          Address
        </label>
        <p className={helpClass}>If you have no office, write &quot;HomeBased&quot;.</p>
        <input id="address" autoComplete="street-address" value={d.address} onChange={(e) => set({ address: e.target.value })} maxLength={300} className={inputClass} {...err("address")} />
        <FieldError id="address" message={errors.address} />
        <label htmlFor="hideFullAddress" className="mt-2 flex min-h-11 cursor-pointer items-start gap-3 py-2 text-sm font-semibold text-brand-navy">
          <input id="hideFullAddress" type="checkbox" checked={d.hideFullAddress} onChange={(e) => set({ hideFullAddress: e.target.checked })} className="mt-0.5 h-5 w-5 shrink-0 accent-brand-blue" {...err("hideFullAddress")} />
          {HIDE_ADDRESS_LABEL}
        </label>
      </div>

      <fieldset id="serveZones" tabIndex={-1} {...err("serveZones")}>
        <legend className={labelClass}>Areas you serve</legend>
        <div className="mt-1">
          {ZONES.map((z) => (
            <label key={z.slug} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-brand-navy">
              <input
                type="checkbox"
                checked={d.serveZones.includes(z.slug)}
                onChange={() => set({ serveZones: d.serveZones.includes(z.slug) ? d.serveZones.filter((s) => s !== z.slug) : [...d.serveZones, z.slug] })}
                className="h-5 w-5 shrink-0 accent-brand-blue"
              />
              {zoneShortLabel(z)}
            </label>
          ))}
        </div>
        <label htmlFor="otherAreaText" className="mt-2 block text-sm text-slate-700">
          Other areas you serve
        </label>
        <input id="otherAreaText" value={d.otherAreaText} onChange={(e) => set({ otherAreaText: e.target.value })} maxLength={300} className={inputClass} {...err("otherAreaText")} />
        <FieldError id="serveZones" message={errors.serveZones} />
        <FieldError id="otherAreaText" message={errors.otherAreaText} />
        <FieldError id="localities" message={errors.localities} />
      </fieldset>

      <div>
        <label htmlFor="openingHours" className={labelClass}>
          Opening Hours <span className="font-normal text-slate-500">(optional)</span>
        </label>
        <textarea id="openingHours" rows={3} value={d.openingHours} onChange={(e) => set({ openingHours: e.target.value })} maxLength={500} className={inputClass} />
      </div>
      <div>
        <label htmlFor="specialNotes" className={labelClass}>
          Special Notes <span className="font-normal text-slate-500">(optional)</span>
        </label>
        <textarea id="specialNotes" rows={3} value={d.specialNotes} onChange={(e) => set({ specialNotes: e.target.value })} maxLength={500} className={inputClass} />
      </div>

      <div className="space-y-3">
        <button type="submit" disabled={busy} className="press inline-flex min-h-11 items-center gap-2 rounded-md bg-brand-navy px-8 text-base font-semibold text-white hover:bg-brand-blue disabled:opacity-70">
          {busy && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
          Save changes
        </button>
        <p role="status" aria-live="polite" className={`min-h-5 text-sm font-medium ${message?.ok === false ? "text-red-700" : "text-green-800"}`}>
          {message?.text}
        </p>
      </div>
    </form>
  );
}
