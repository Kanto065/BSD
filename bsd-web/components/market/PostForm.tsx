"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import MarketGate from "@/components/market/MarketGate";
import Stepper from "@/components/Stepper";
import { ApiError } from "@/lib/admin-session";
import { getBusinessProfile, type Member } from "@/lib/member-api";
import {
  CONDITIONS, CONDITION_LABEL, KIND_OPTIONS, LEGAL_TEXT, MAX_IMAGES, POST_STEPS, SPOT_FALLBACK, createMarketListing, emptyPost, hasErrors,
  priceLabel, earliestStep, validatePostStep, type Errors, type MarketCategory, type MarketCondition, type MarketKind, type PostValues, type SafeSpot,
} from "@/lib/market-api";

// The 4 step post flow. Signed out visitors see the sign in gate. Account phone and the saved business profile give the
// starting values. The browser checks each step, the API checks everything again and its field errors are shown on the
// step that owns the field.

const input = "mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base";
const btn = "press touch-manipulation select-none inline-flex min-h-11 items-center justify-center rounded-full px-6 text-base font-semibold";

function Err({ id, msg }: { id: string; msg?: string }) {
  return msg ? <p id={id} role="alert" className="mt-1 text-sm text-red-700">{msg}</p> : null;
}

export default function PostForm({ apiBase, categories, spots }: { apiBase: string; categories: MarketCategory[]; spots: SafeSpot[] }) {
  return (
    <MarketGate apiBase={apiBase} title="Sign in or create an account to post a listing">
      {(member) => <Flow apiBase={apiBase} member={member} categories={categories} spots={spots} />}
    </MarketGate>
  );
}

function Flow({ apiBase, member, categories, spots }: { apiBase: string; member: Member; categories: MarketCategory[]; spots: SafeSpot[] }) {
  const [v, setV] = useState<PostValues>({ ...emptyPost, whatsapp: member.phone ?? "", phone: member.phone ?? "", postcode: member.postcode ?? "" });
  const [files, setFiles] = useState<File[]>([]);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ slug: string; held: boolean } | null>(null);
  const [formError, setFormError] = useState("");

  // A saved business profile gives a better phone and postcode than the account.
  useEffect(() => {
    getBusinessProfile(apiBase)
      .then(({ data }) => {
        const s = (k: string) => (typeof data[k] === "string" ? (data[k] as string) : "");
        setV((p) => ({ ...p, whatsapp: s("whatsapp") || p.whatsapp, phone: s("phone") || p.phone, postcode: s("postcode") || p.postcode }));
      })
      .catch(() => undefined);
  }, [apiBase]);

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const set = <K extends keyof PostValues>(k: K, val: PostValues[K]) => setV((p) => ({ ...p, [k]: val }));

  function next() {
    const e = validatePostStep(step, v, files);
    setErrors(e);
    if (!hasErrors(e)) setStep(step + 1);
  }

  async function submit() {
    // Re-check every step so a bad value cannot slip past a skipped Next.
    for (let s = 0; s <= 3; s++) {
      const e = validatePostStep(s, v, files);
      if (hasErrors(e)) {
        setErrors(e);
        setStep(s);
        return;
      }
    }
    setBusy(true);
    setFormError("");
    try {
      const r = await createMarketListing(apiBase, v, files);
      setDone({ slug: r.listing.slug, held: r.held });
    } catch (err) {
      if (err instanceof ApiError) {
        const fe = Object.fromEntries(Object.entries(err.fieldErrors ?? {}).map(([k, m]) => [k, String(m)]));
        const step = earliestStep(Object.keys(fe));
        setErrors(fe);
        if (step !== null) setStep(step);
        setFormError(step !== null ? "Please check the highlighted fields." : err.message);
      } else setFormError("Could not post the listing. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <section role="status" className="max-w-xl rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <CheckCircle2 className="h-8 w-8 text-green-700" aria-hidden="true" />
        <h2 className="mt-3 font-heading text-xl font-bold text-bc-shell">{done.held ? "Your listing is waiting for review" : "Your listing is live"}</h2>
        <p className="mt-2 text-slate-700">{done.held ? "The team checks it before it appears on the Marketplace." : "People can find it now."}</p>
        <Link href={done.held ? "/" : `/listing/${done.slug}`} className={`${btn} mt-5 bg-bc-bar text-white hover:bg-bc-shell`}>{done.held ? "Back to the Marketplace" : "View your listing"}</Link>
      </section>
    );
  }

  const isGive = v.kind === "GIVEAWAY";
  const kindLabel = KIND_OPTIONS.find((k) => k.kind === v.kind)?.label ?? "";
  const catName = categories.find((c) => c.slug === v.category)?.name ?? "";

  return (
    <div className="max-w-2xl space-y-6">
      <Stepper steps={POST_STEPS} current={step} />
      <form noValidate onSubmit={(e) => { e.preventDefault(); if (step === 3) void submit(); else next(); }} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        {step === 0 && (
          <fieldset>
            <legend className="font-heading text-lg font-bold text-bc-shell">What are you posting?</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {KIND_OPTIONS.map((k) => (
                <label key={k.kind} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 ${v.kind === k.kind ? "border-bc-bar bg-sky-50" : "border-slate-300"}`}>
                  <input type="radio" name="kind" checked={v.kind === k.kind} onChange={() => { set("kind", k.kind as MarketKind); setErrors((p) => ({ ...p, kind: undefined })); }} className="h-5 w-5" />
                  {k.label}
                </label>
              ))}
            </div>
            <Err id="kind-err" msg={errors.kind} />
            <fieldset className="mt-5">
              <legend className="text-sm font-medium text-slate-800">Who is posting?</legend>
              <div className="mt-2 flex flex-wrap gap-x-6">
                <label className="inline-flex min-h-11 items-center gap-2"><input type="radio" name="b2b" checked={!v.isB2B} onChange={() => set("isB2B", false)} className="h-5 w-5" />Individual (P2P)</label>
                <label className="inline-flex min-h-11 items-center gap-2"><input type="radio" name="b2b" checked={v.isB2B} onChange={() => set("isB2B", true)} className="h-5 w-5" />Business (B2B)</label>
              </div>
            </fieldset>
          </fieldset>
        )}

        {step === 1 && (
          <>
            <div>
              <label htmlFor="category" className="font-heading text-lg font-bold text-bc-shell">Category</label>
              <select id="category" value={v.category} onChange={(e) => set("category", e.target.value)} aria-invalid={Boolean(errors.category)} className={input}>
                <option value="">Choose a category</option>
                {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </select>
              <Err id="category-err" msg={errors.category} />
            </div>
            <label className="flex min-h-11 items-center gap-3">
              <input type="checkbox" checked={v.offerPassDiscount} onChange={(e) => set("offerPassDiscount", e.target.checked)} className="h-5 w-5" />
              Offer Discount to Privilege Pass Holders
            </label>
            {v.offerPassDiscount && (
              <div>
                <label htmlFor="pdn" className="text-sm font-medium text-slate-800">Discount details (optional)</label>
                <input id="pdn" value={v.passDiscountNote} maxLength={200} onChange={(e) => set("passDiscountNote", e.target.value)} className={input} />
                <Err id="pdn-err" msg={errors.passDiscountNote} />
              </div>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <label htmlFor="title" className="text-sm font-medium text-slate-800">Title</label>
              <input id="title" value={v.title} maxLength={120} onChange={(e) => set("title", e.target.value)} aria-invalid={Boolean(errors.title)} className={input} />
              <Err id="title-err" msg={errors.title} />
            </div>
            <div>
              <label htmlFor="desc" className="text-sm font-medium text-slate-800">Description</label>
              <textarea id="desc" rows={5} value={v.description} maxLength={2000} onChange={(e) => set("description", e.target.value)} aria-invalid={Boolean(errors.description)} className={`${input} py-2`} />
              <Err id="desc-err" msg={errors.description} />
            </div>
            {!isGive && (
              <div>
                <label htmlFor="price" className="text-sm font-medium text-slate-800">Price in pounds{v.kind === "BUY" ? " (budget, optional)" : ""}</label>
                <input id="price" inputMode="decimal" value={v.price} onChange={(e) => set("price", e.target.value)} aria-invalid={Boolean(errors.price)} className={input} />
                <Err id="price-err" msg={errors.price} />
                <label className="mt-1 flex min-h-11 items-center gap-3"><input type="checkbox" checked={v.negotiable} onChange={(e) => set("negotiable", e.target.checked)} className="h-5 w-5" />Or nearest offer</label>
              </div>
            )}
            {(v.kind === "SELL" || v.kind === "GIVEAWAY") && (
              <div>
                <label htmlFor="cond" className="text-sm font-medium text-slate-800">Condition</label>
                <select id="cond" value={v.condition} onChange={(e) => set("condition", e.target.value as MarketCondition | "")} className={input}>
                  <option value="">Not stated</option>
                  {CONDITIONS.map((c) => <option key={c} value={c}>{CONDITION_LABEL[c]}</option>)}
                </select>
              </div>
            )}
            {v.isB2B && (
              <>
                <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={v.vatInvoice} onChange={(e) => set("vatInvoice", e.target.checked)} className="h-5 w-5" />VAT invoice available</label>
                <div>
                  <label htmlFor="bulk" className="text-sm font-medium text-slate-800">Bulk terms (optional)</label>
                  <input id="bulk" value={v.bulkTerms} maxLength={300} onChange={(e) => set("bulkTerms", e.target.value)} className={input} />
                  <Err id="bulk-err" msg={errors.bulkTerms} />
                </div>
              </>
            )}
            <div>
              <label htmlFor="photos" className="text-sm font-medium text-slate-800">Photos (up to {MAX_IMAGES}, JPG, PNG or WebP)</label>
              <input id="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => { const all = Array.from(e.target.files ?? []); setFiles(all); setErrors((p) => ({ ...p, images: all.length > MAX_IMAGES ? `Upload up to ${MAX_IMAGES} images.` : undefined })); }} className="mt-1 block min-h-11 w-full text-sm" />
              <Err id="photos-err" msg={errors.images} />
              {previews.length > 0 && (
                <ul role="list" className="mt-2 flex flex-wrap gap-2">
                  {previews.map((u, i) => (
                    <li key={u}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt={`Selected photo ${i + 1}`} className="h-16 w-16 rounded-lg object-cover" />
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <label htmlFor="pc" className="text-sm font-medium text-slate-800">Postcode</label>
              <input id="pc" value={v.postcode} autoCapitalize="characters" onChange={(e) => set("postcode", e.target.value)} aria-invalid={Boolean(errors.postcode)} className={input} />
              <Err id="pc-err" msg={errors.postcode} />
            </div>
            <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={v.hideFullAddress} onChange={(e) => set("hideFullAddress", e.target.checked)} className="h-5 w-5" />Hide Full Address (only the area is shown)</label>
            {v.hideFullAddress && spots.length > 0 && (
              <div>
                <label htmlFor="spot" className="text-sm font-medium text-slate-800">Safe meeting spot</label>
                <select id="spot" value={v.spotId} onChange={(e) => set("spotId", e.target.value)} className={input}>
                  <option value="">{SPOT_FALLBACK}</option>
                  {spots.map((s) => <option key={s.id} value={s.id}>{s.name}, {s.address}</option>)}
                </select>
                <Err id="spot-err" msg={errors.spotId} />
              </div>
            )}
            <div>
              <label htmlFor="wa" className="text-sm font-medium text-slate-800">WhatsApp number</label>
              <input id="wa" type="tel" value={v.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} aria-invalid={Boolean(errors.whatsapp)} className={input} />
              <Err id="wa-err" msg={errors.whatsapp} />
            </div>
            <div>
              <label htmlFor="ph" className="text-sm font-medium text-slate-800">Phone for Call Seller (optional)</label>
              <input id="ph" type="tel" value={v.phone} onChange={(e) => set("phone", e.target.value)} aria-invalid={Boolean(errors.phone)} className={input} />
              <Err id="ph-err" msg={errors.phone} />
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="font-heading text-lg font-bold text-bc-shell">Preview</h2>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-600">{kindLabel}{v.isB2B ? ", B2B" : ""}{catName ? `, ${catName}` : ""}</p>
              <p className="mt-1 font-semibold">{v.title}</p>
              <p className="mt-1 font-bold text-bc-shell">{priceLabel({ free: isGive, kind: v.kind || "SELL", pricePence: v.price.trim() ? Math.round(parseFloat(v.price) * 100) : null })}</p>
              <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{v.description}</p>
              {previews.length > 0 && (
                <ul role="list" className="mt-2 flex flex-wrap gap-2">
                  {previews.map((u, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <li key={u}><img src={u} alt={`Photo ${i + 1}`} className="h-16 w-16 rounded-lg object-cover" /></li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-sm text-slate-600">{files.length} {files.length === 1 ? "photo" : "photos"}. {v.hideFullAddress ? "The full address will be hidden." : "The full postcode will be shown."}</p>
            </div>
            <label className="flex min-h-11 items-start gap-3">
              <input type="checkbox" checked={v.legalAcknowledged} onChange={(e) => set("legalAcknowledged", e.target.checked)} aria-invalid={Boolean(errors.legalAcknowledged)} className="mt-1 h-5 w-5 shrink-0" />
              <span>{LEGAL_TEXT}</span>
            </label>
            <Err id="legal-err" msg={errors.legalAcknowledged} />
          </>
        )}

        {formError && <p role="alert" className="text-sm font-medium text-red-700">{formError}</p>}

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => { setErrors({}); setStep(step - 1); }} disabled={step === 0 || busy} className={`${btn} border border-slate-300 text-bc-shell disabled:opacity-50`}>Back</button>
          {step < 3 ? (
            <button type="submit" className={`${btn} bg-bc-bar text-white hover:bg-bc-shell`}>Next</button>
          ) : (
            <button type="submit" disabled={busy} className={`${btn} gap-2 bg-bc-bar text-white hover:bg-bc-shell disabled:opacity-60`}>
              {busy && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
              {busy ? "Posting..." : "Post Listing"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
