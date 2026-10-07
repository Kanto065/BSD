"use client";

import { useEffect, useState } from "react";
import { inputClass, labelClass } from "@/components/BusinessFields";
import { MERCHANT_LABELS as T, OFFER_CHIPS } from "@/lib/card-labels";
import { flipOffer, getOffer, messageOf, saveOffer, type MerchantOffer, type OfferStatus } from "@/lib/merchant-api";
import { SITES } from "@/lib/site";

// The owner's Privilege Pass offer for one APPROVED listing. Saving always sends it back for approval (the API does that).

const CHIP: Record<OfferStatus, string> = {
  PENDING: "bg-amber-50 text-amber-900 border-amber-300",
  ACTIVE: "bg-green-50 text-green-900 border-green-300",
  PAUSED: "bg-slate-100 text-slate-700 border-slate-300",
  REJECTED: "bg-red-50 text-red-900 border-red-300",
};
const btn = "inline-flex min-h-11 items-center rounded-md px-5 text-sm font-semibold disabled:opacity-60";

export default function OfferEditor({ apiBase, listingId }: { apiBase: string; listingId: string }) {
  const [offer, setOffer] = useState<MerchantOffer | null>(null);
  const [ready, setReady] = useState(false);
  const [title, setTitle] = useState("");
  const [percent, setPercent] = useState("");
  const [terms, setTerms] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const fill = (o: MerchantOffer | null) => {
    setOffer(o);
    setTitle(o?.title ?? "");
    setPercent(o?.percent == null ? "" : String(o.percent));
    setTerms(o?.terms ?? "");
  };

  useEffect(() => {
    getOffer(apiBase, listingId)
      .then((r) => fill(r.offer))
      .catch(() => setNote({ ok: false, text: T.saveFailed }))
      .finally(() => setReady(true));
  }, [apiBase, listingId]);

  async function run(job: () => Promise<{ offer: MerchantOffer }>, done: string | null) {
    setBusy(true);
    setNote(null);
    try {
      fill((await job()).offer);
      setNote(done ? { ok: true, text: done } : null);
    } catch (e) {
      setNote({ ok: false, text: messageOf(e, T.saveFailed) });
    } finally {
      setBusy(false);
    }
  }

  const n = percent.trim() === "" ? null : Number(percent);
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (n !== null && !Number.isFinite(n)) return setNote({ ok: false, text: T.offerPercentInvalid });
    void run(() => saveOffer(apiBase, listingId, { title, percent: n, terms }), T.saved);
  };

  if (!ready) return <div aria-busy="true" className="mt-4 h-20 animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none" />;
  const id = `offer-${listingId}`;
  return (
    <section aria-labelledby={`${id}-h`} className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h3 id={`${id}-h`} className="font-heading text-base font-bold text-brand-navy">
          {T.offerTitle}
        </h3>
        {offer && <span className={`rounded-full border px-3 py-0.5 text-xs font-semibold ${CHIP[offer.status]}`}>{OFFER_CHIPS[offer.status]}</span>}
      </div>
      <p className="mt-1 text-sm text-slate-700">{T.offerIntro}</p>
      {offer?.status === "REJECTED" && offer.rejectionReason && (
        <p className="mt-2 text-sm text-red-800">
          {T.reasonPrefix} {offer.rejectionReason}
        </p>
      )}
      <form onSubmit={save} className="mt-3 space-y-3">
        <div>
          <label htmlFor={`${id}-t`} className={labelClass}>
            {T.fieldTitle}
          </label>
          <input id={`${id}-t`} className={inputClass} value={title} maxLength={150} required onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label htmlFor={`${id}-p`} className={labelClass}>
            {T.fieldPercent}
          </label>
          <input id={`${id}-p`} className={inputClass} inputMode="decimal" value={percent} onChange={(e) => setPercent(e.target.value)} />
        </div>
        <div>
          <label htmlFor={`${id}-r`} className={labelClass}>
            {T.fieldTerms}
          </label>
          <textarea id={`${id}-r`} className={inputClass} rows={3} value={terms} maxLength={500} required onChange={(e) => setTerms(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={busy} className={`${btn} bg-brand-navy text-white hover:bg-brand-blue`}>
            {busy ? T.saving : T.save}
          </button>
          {offer?.status === "ACTIVE" && (
            <button type="button" disabled={busy} onClick={() => void run(() => flipOffer(apiBase, listingId, "pause"), null)} className={`${btn} border border-slate-300 text-brand-navy hover:border-brand-blue`}>
              {T.pause}
            </button>
          )}
          {offer?.status === "PAUSED" && (
            <button type="button" disabled={busy} onClick={() => void run(() => flipOffer(apiBase, listingId, "resume"), null)} className={`${btn} border border-slate-300 text-brand-navy hover:border-brand-blue`}>
              {T.resume}
            </button>
          )}
          {offer?.status === "ACTIVE" && (
            <a href={`${SITES.card.origin}/verify`} className={`${btn} border border-slate-300 text-brand-navy hover:border-brand-blue`}>
              {T.openScanner}
            </a>
          )}
        </div>
        {note && (
          <p role={note.ok ? "status" : "alert"} className={`text-sm ${note.ok ? "text-green-800" : "text-red-700"}`}>
            {note.text}
          </p>
        )}
      </form>
    </section>
  );
}
