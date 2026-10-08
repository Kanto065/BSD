"use client";

import { createPortal } from "react-dom";
import { ALREADY_SCANNED, CONFIRM_DISCOUNT, MERCHANT_LABELS as T, SCAN_NEXT } from "@/lib/card-labels";
import { formatPence } from "@/lib/pass-client";
import { BILL_PRESETS, billToPence, overlayFor, savingFor, type VerifyReply } from "@/lib/scan";

// The result sheet shown over the scanner. Full screen on phones, a centred card on a dimmed page from sm up.
// Plain props only, so the parent client component owns all state and behaviour.

const TONE = {
  valid: { head: "bg-green-700 text-white", icon: "M5 13l4 4L19 7" },
  duplicate: { head: "bg-yellow-400 text-slate-900", icon: "M12 7v6m0 4v.01" },
  expired: { head: "bg-red-700 text-white", icon: "M12 7v5l3 2" },
  invalid: { head: "bg-red-700 text-white", icon: "M7 7l10 10M17 7L7 17" },
} as const;

export default function ScanResult({ result, bill, setBill, done, busy, error, onConfirm, onNext }: {
  result: VerifyReply;
  bill: string;
  setBill: (v: string) => void;
  done: { saving: number | null } | null;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onNext: () => void;
}) {
  const overlay = overlayFor(result);
  const tone = TONE[overlay];
  const full = result.valid && "member" in result ? result : null;
  const title = done ? T.confirmed : overlay === "valid" ? T.validTitle : overlay === "duplicate" ? ALREADY_SCANNED : overlay === "expired" ? T.expiredTitle : T.invalid;
  const hint = overlay === "expired" ? T.expiredHint : overlay === "duplicate" ? T.duplicateAgo : null;
  const pence = bill.trim() ? billToPence(bill) : null;
  const percent = full?.offer.percent ?? null;

  // A portal, so no ancestor stacking context can put the bottom nav above the sheet.
  return createPortal(
    <div className={`fixed inset-0 z-50 flex justify-center bg-black/70 backdrop-blur-sm ${full ? "items-stretch sm:items-center sm:p-6" : "items-center p-6"}`}>
      <div role="alertdialog" aria-modal="true" aria-label={title} className={`flex w-full flex-col overflow-y-auto bg-white shadow-2xl ${full ? "sm:max-h-full sm:max-w-md sm:rounded-3xl" : "max-w-md rounded-3xl"}`}>
        <div className={`flex flex-col items-center gap-3 px-6 pb-5 pt-8 text-center sm:pb-7 ${tone.head}`}>
          <span aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 ring-2 ring-white/40">
            <svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              {overlay === "expired" && <circle cx="12" cy="12" r="9" />}
              <path d={tone.icon} />
            </svg>
          </span>
          <h2 className="font-heading text-2xl font-bold">{title}</h2>
          {hint && <p className="text-sm opacity-90">{hint}</p>}
        </div>

        {full ? (
          <div className="flex flex-1 flex-col gap-4 px-6 py-5 text-slate-900">
            <div className="text-center">
              <p className="font-heading text-3xl font-bold">{full.member.name}</p>
              <p className="mt-1 text-sm text-slate-600">{full.member.memberId} &middot; {full.member.postcodeDistrict}</p>
            </div>
            <p className="mx-auto rounded-full bg-green-50 px-4 py-2 text-center text-base font-semibold text-green-900 ring-1 ring-green-600/30">
              {full.offer.title}{full.offer.percent !== null && ` (${full.offer.percent}%)`}
            </p>
            {done ? (
              <p className="text-center text-3xl font-bold text-green-800">{done.saving !== null ? `${T.discount} ${formatPence(done.saving)}` : T.confirmed}</p>
            ) : (
              <>
                <label className="block text-sm font-medium text-slate-700">
                  {T.billLabel}
                  <span className="relative mt-1.5 block">
                    <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-2xl font-semibold text-slate-500">&pound;</span>
                    <input value={bill} onChange={(e) => setBill(e.target.value)} inputMode="decimal" placeholder="0.00" className="block min-h-[56px] w-full rounded-xl border border-slate-300 bg-white pl-9 pr-4 text-2xl font-semibold text-slate-900 focus-visible:outline-green-700" />
                  </span>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {BILL_PRESETS.map((p) => (
                    <button key={p} type="button" onClick={() => setBill(String(p / 100))} className="min-h-[48px] rounded-xl bg-slate-100 text-base font-semibold text-slate-900 ring-1 ring-slate-300 active:bg-slate-200">&pound;{p / 100}</button>
                  ))}
                </div>
                <p aria-live="polite" className="min-h-[2.25rem] text-center text-2xl font-bold text-green-800">
                  {pence !== null && percent !== null && `${T.discountToGive} ${formatPence(savingFor(pence, percent))}`}
                </p>
                <button type="button" disabled={busy} onClick={onConfirm} className="min-h-[56px] rounded-full bg-green-700 px-4 text-base font-bold text-white sm:text-lg disabled:opacity-60 active:bg-green-800">{CONFIRM_DISCOUNT}</button>
              </>
            )}
            {error && <p role="alert" className="text-center text-sm font-semibold text-red-700">{error}</p>}
            <button type="button" onClick={onNext} className="min-h-[56px] rounded-full px-4 text-base font-bold text-slate-800 sm:text-lg ring-2 ring-slate-300 active:bg-slate-100">{SCAN_NEXT}</button>
          </div>
        ) : (
          <div aria-hidden="true" className="h-1.5 bg-slate-200">
            <div className={`h-full origin-left bg-slate-500 motion-safe:animate-dismiss`} />
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
