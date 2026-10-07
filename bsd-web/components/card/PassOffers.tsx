"use client";

import { useEffect, useRef, useState } from "react";
import { getPartners, PassApiError, revealCode, type OfferCode, type Partner } from "@/lib/card-api";
import { COPIED, CONFLICT, NEW_LABELS as T, REVEAL } from "@/lib/card-labels";
import { copyText, mmss } from "@/lib/pass-client";
import { ErrorLine, outlineBtn, solidBtn } from "./PassPanels";

// Partner offers under the pass. "Reveal Instant Discount Code" is for phone or online redemption: one single use
// code, valid 10 minutes, made by the API per member and offer.

function Reveal({ apiBase, device, offerId }: { apiBase: string; device: string; offerId: string }) {
  const [code, setCode] = useState<OfferCode | null>(null);
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const endsAt = useRef(0);

  useEffect(() => {
    if (!code) return;
    const tick = () => setLeft(Math.max(0, Math.ceil((endsAt.current - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [code]);

  async function reveal() {
    setBusy(true);
    setError(null);
    try {
      const r = await revealCode(apiBase, device, offerId);
      endsAt.current = Date.now() + r.expiresInSeconds * 1000;
      setCode(r);
    } catch (e) {
      setError(e instanceof PassApiError && e.status === 409 ? CONFLICT : e instanceof PassApiError && e.status === 429 ? "You have asked for a lot of codes. Please try again later." : T.codeFailed);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!code) return;
    if (await copyText(code.code)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  if (code && left > 0) {
    return (
      <div className="mt-3 rounded-xl bg-white p-4 text-center text-slate-900 motion-safe:animate-swap-in">
        <p className="select-all font-mono text-2xl font-bold tracking-wider">{code.code}</p>
        <p className="mt-1 text-sm text-slate-600">
          {T.codeValidFor} {mmss(left)}
        </p>
        <button type="button" onClick={copy} className={`${solidBtn} mt-3`}>
          {T.copyCode}
        </button>
        <p role="status" className="mt-2 min-h-5 text-sm font-semibold text-teal-800">
          {copied ? COPIED : ""}
        </p>
      </div>
    );
  }
  return (
    <div className="mt-3">
      <button type="button" onClick={reveal} disabled={busy} className={solidBtn}>
        {REVEAL}
      </button>
      {error && <ErrorLine>{error}</ErrorLine>}
    </div>
  );
}

export function OfferRow({ p, apiBase, device, canReveal }: { p: Partner; apiBase: string; device: string | null; canReveal: boolean }) {
  const { name, areaLabel, postcodeDistrict, offer } = p;
  return (
    <li className="rounded-2xl bg-white/[0.06] px-4 py-4 ring-1 ring-white/15">
      <p className="font-heading font-semibold text-white">{name}</p>
      <p className="text-xs text-slate-300">{areaLabel ?? postcodeDistrict}</p>
      {offer && (
        <>
          <p className="mt-2 text-sm font-semibold text-teal-200">
            {offer.title}
            {offer.percent !== null ? ` (${offer.percent}% off)` : ""}
          </p>
          <p className="text-sm text-slate-300">{offer.terms}</p>
          {canReveal && device && offer.id && <Reveal apiBase={apiBase} device={device} offerId={offer.id} />}
        </>
      )}
    </li>
  );
}

export default function PassOffers({ apiBase, device, canReveal }: { apiBase: string; device: string | null; canReveal: boolean }) {
  const [items, setItems] = useState<Partner[]>([]);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);
  const [state, setState] = useState<"loading" | "ok" | "failed">("loading");

  async function more() {
    try {
      const r = await getPartners(apiBase, page + 1);
      setItems((x) => [...x, ...r.items.filter((i) => i.offer)]);
      setPage(r.page);
      setPages(r.totalPages);
      setState("ok");
    } catch {
      setState("failed");
    }
  }

  useEffect(() => {
    void more();
    // Loads the first page once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section aria-labelledby="offers-h" className="space-y-3">
      <h2 id="offers-h" className="font-heading text-lg font-semibold text-white">
        {T.offersTitle}
      </h2>
      {state === "loading" && <div className="h-20 motion-safe:animate-pulse rounded-2xl bg-white/10" aria-hidden="true" />}
      {state === "failed" && <ErrorLine>{T.loadFailed}</ErrorLine>}
      {state === "ok" && items.length === 0 && <p className="text-sm text-slate-300">{T.offersEmpty}</p>}
      <ul className="space-y-3">
        {items.map((p) => (
          <OfferRow key={p.slug} p={p} apiBase={apiBase} device={device} canReveal={canReveal} />
        ))}
      </ul>
      {state === "ok" && page < pages && (
        <button type="button" onClick={more} className={outlineBtn}>
          {T.moreOffers}
        </button>
      )}
    </section>
  );
}
