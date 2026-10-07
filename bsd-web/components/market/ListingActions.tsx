"use client";

import { useEffect, useRef, useState } from "react";
import { Bookmark, Flag, MessageCircle, Phone, Share2 } from "lucide-react";
import MarketGate from "@/components/market/MarketGate";
import { ApiError } from "@/lib/admin-session";
import { CONTACT_WAIT_SECONDS, REPORT_REASONS, contactReveal, contactStart, reportListing, saveListing, telHref, unsaveListing } from "@/lib/market-api";

// Contact buttons on a listing. WhatsApp is a plain link with the client's prefilled message. Call Seller follows the
// API's cooldown flow: the first call returns a token, the number is asked for again after 10 seconds. Nothing about
// the visitor is stored. Share uses the Web Share API, with a copied link as the fallback.

const btn = "press touch-manipulation select-none inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-base font-semibold disabled:opacity-60";
const solid = `${btn} bg-bc-bar text-white hover:bg-bc-shell`;
const outline = `${btn} border border-slate-300 bg-white text-bc-shell hover:border-bc-bar`;

type CallState = { phase: "idle" } | { phase: "wait"; left: number } | { phase: "ready"; phone: string } | { phase: "error"; message: string };

export default function ListingActions({ apiBase, id, slug, title, whatsappHref, canContact }: { apiBase: string; id: string; slug: string; title: string; whatsappHref: string | null; canContact: boolean }) {
  const [call, setCall] = useState<CallState>({ phase: "idle" });
  const [shareNote, setShareNote] = useState("");
  const [panel, setPanel] = useState<"save" | "report" | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  async function startCall() {
    setCall({ phase: "wait", left: CONTACT_WAIT_SECONDS });
    try {
      const { token, retryAfterSeconds } = await contactStart(apiBase, slug);
      let left = retryAfterSeconds;
      setCall({ phase: "wait", left });
      timer.current = setInterval(async () => {
        left -= 1;
        if (left > 0) return setCall({ phase: "wait", left });
        if (timer.current) clearInterval(timer.current);
        timer.current = null;
        setCall({ phase: "wait", left: 0 });
        // The server clock may be a moment behind: a 425 answer means try once more shortly.
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const r = await contactReveal(apiBase, slug, token);
            return setCall({ phase: "ready", phone: r.phone });
          } catch (err) {
            if (!(err instanceof ApiError) || err.status !== 425) return setCall({ phase: "error", message: err instanceof ApiError && err.status !== 400 ? err.message : "Please try again." });
            await new Promise((res) => setTimeout(res, 1500));
          }
        }
        setCall({ phase: "error", message: "Please try again." });
      }, 1000);
    } catch (err) {
      setCall({ phase: "error", message: err instanceof ApiError && err.status === 429 ? "Too many requests. Please wait a minute." : "Please try again." });
    }
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else {
        await navigator.clipboard.writeText(url);
        setShareNote("Link copied.");
      }
    } catch {
      // The person closed the share sheet, nothing to report.
    }
  }

  return (
    <div className="space-y-3">
      {canContact && (
        <div className="flex flex-wrap gap-3">
          {whatsappHref && (
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={`${btn} bg-green-700 text-white hover:bg-green-800`}>
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
              Chat on WhatsApp
            </a>
          )}
          {call.phase === "ready" ? (
            <a href={telHref(call.phone)} className={solid}>
              <Phone className="h-5 w-5" aria-hidden="true" />
              {call.phone}
            </a>
          ) : (
            <button type="button" onClick={startCall} disabled={call.phase === "wait"} className={outline}>
              <Phone className="h-5 w-5" aria-hidden="true" />
              {call.phase === "wait" ? `Number ready in ${call.left}s` : "Call Seller"}
            </button>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={share} className={outline}>
          <Share2 className="h-5 w-5" aria-hidden="true" />
          Share
        </button>
        <button type="button" onClick={() => setPanel(panel === "save" ? null : "save")} aria-expanded={panel === "save"} className={outline}>
          <Bookmark className="h-5 w-5" aria-hidden="true" />
          Save
        </button>
        <button type="button" onClick={() => setPanel(panel === "report" ? null : "report")} aria-expanded={panel === "report"} className={outline}>
          <Flag className="h-5 w-5" aria-hidden="true" />
          Report
        </button>
      </div>
      <p role="status" aria-live="polite" className="min-h-5 text-sm text-slate-600">
        {call.phase === "error" ? <span className="text-red-700">{call.message}</span> : call.phase === "wait" ? "The number is shown after a short wait to stop automated copying." : shareNote}
      </p>
      {panel && (
        <MarketGate apiBase={apiBase} title={panel === "save" ? "Sign in to save this listing" : "Sign in to report this listing"}>
          {() => (panel === "save" ? <SavePanel apiBase={apiBase} id={id} /> : <ReportPanel apiBase={apiBase} id={id} onDone={() => setPanel(null)} />)}
        </MarketGate>
      )}
    </div>
  );
}

const box = "rounded-2xl border border-slate-200 bg-white p-4 sm:p-5";

// Opening the panel while signed in saves the listing (the API call is idempotent). The button then toggles it.
function SavePanel({ apiBase, id }: { apiBase: string; id: string }) {
  const [saved, setSaved] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function set(next: boolean) {
    setBusy(true);
    setError("");
    try {
      const r = await (next ? saveListing(apiBase, id) : unsaveListing(apiBase, id));
      setSaved(r.saved);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 404 ? "This listing is no longer available." : "Could not update your saved listings. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    set(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={box}>
      <p role="status" aria-live="polite" className={`text-sm ${error ? "text-red-700" : "text-slate-700"}`}>
        {error || (saved === null ? "Saving..." : saved ? "Saved to your listings." : "Removed from your saved listings.")}
      </p>
      {saved !== null && (
        <button type="button" onClick={() => set(!saved)} disabled={busy} className={`${outline} mt-3`}>
          {saved ? "Remove from saved" : "Save again"}
        </button>
      )}
    </div>
  );
}

function ReportPanel({ apiBase, id, onDone }: { apiBase: string; id: string; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) return setMessage({ ok: false, text: "Choose a reason." });
    setBusy(true);
    setMessage(null);
    try {
      const r = await reportListing(apiBase, id, reason, note);
      setMessage({ ok: true, text: r.already ? "You have already reported this listing. Our team will review it." : "Thank you. Our team will review this listing." });
    } catch (err) {
      const text =
        err instanceof ApiError && err.status === 400 ? "You cannot report your own listing."
        : err instanceof ApiError && err.status === 404 ? "This listing is no longer available."
        : err instanceof ApiError && err.status === 429 ? "Too many reports. Please try again later."
        : "Could not send your report. Please try again.";
      setMessage({ ok: false, text });
    } finally {
      setBusy(false);
    }
  }

  const done = message?.ok;
  return (
    <form onSubmit={submit} className={`${box} space-y-3`}>
      {!done && (
        <>
          <div>
            <label htmlFor="report-reason" className="block text-sm font-semibold text-bc-shell">Reason</label>
            <select id="report-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base">
              <option value="">Choose a reason</option>
              {REPORT_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="report-note" className="block text-sm font-semibold text-bc-shell">Details (optional)</label>
            <textarea id="report-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base" />
          </div>
          <button type="submit" disabled={busy} className={solid}>{busy ? "Sending..." : "Send report"}</button>
        </>
      )}
      {done && <button type="button" onClick={onDone} className={outline}>Close</button>}
      <p role="status" aria-live="polite" className={`min-h-5 text-sm ${message?.ok === false ? "text-red-700" : "text-slate-700"}`}>{message?.text}</p>
    </form>
  );
}
