"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, Phone, Share2 } from "lucide-react";
import { ApiError } from "@/lib/admin-session";
import { CONTACT_WAIT_SECONDS, contactReveal, contactStart, telHref } from "@/lib/market-api";

// Contact buttons on a listing. WhatsApp is a plain link with the client's prefilled message. Call Seller follows the
// API's cooldown flow: the first call returns a token, the number is asked for again after 10 seconds. Nothing about
// the visitor is stored. Share uses the Web Share API, with a copied link as the fallback.

const btn = "press touch-manipulation select-none inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-base font-semibold disabled:opacity-60";
const solid = `${btn} bg-bc-bar text-white hover:bg-bc-shell`;
const outline = `${btn} border border-slate-300 bg-white text-bc-shell hover:border-bc-bar`;

type CallState = { phase: "idle" } | { phase: "wait"; left: number } | { phase: "ready"; phone: string } | { phase: "error"; message: string };

export default function ListingActions({ apiBase, slug, title, whatsappHref, canContact }: { apiBase: string; slug: string; title: string; whatsappHref: string | null; canContact: boolean }) {
  const [call, setCall] = useState<CallState>({ phase: "idle" });
  const [shareNote, setShareNote] = useState("");
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
      </div>
      <p role="status" aria-live="polite" className="min-h-5 text-sm text-slate-600">
        {call.phase === "error" ? <span className="text-red-700">{call.message}</span> : call.phase === "wait" ? "The number is shown after a short wait to stop automated copying." : shareNote}
      </p>
    </div>
  );
}
