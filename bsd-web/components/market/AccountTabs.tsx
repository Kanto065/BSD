"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/admin-session";
import { priceLabel } from "@/lib/market-api";
import {
  TABS, TAB_LABEL, TICKET_STATUS_LABEL, canRelist, deleteMine, editMine, listingAction, mineListings, myTickets, savedListings, statusNote, tabFor,
  type AccountTab, type MineListing, type Ticket,
} from "@/lib/market-account";
import { ListingGrid } from "@/components/market/ListingCard";
import type { MarketListItem } from "@/lib/market-api";
import { SITES } from "@/lib/site";

// The signed in member's account (M12-D): their listings, saved listings, support tickets and a link to the Pass.

const btn = "press touch-manipulation min-h-11 rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60";
const field = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900";
const box = "rounded-xl border border-slate-200 bg-white p-4";

function Row({ l, apiBase, onChanged }: { l: MineListing; apiBase: string; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState("");
  const [title, setTitle] = useState(l.title);
  const [description, setDescription] = useState(l.description);
  const [price, setPrice] = useState(l.pricePence === null ? "" : String(l.pricePence / 100));
  const note = statusNote(l);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setErr("");
    try {
      await fn();
      setEditing(false);
      onChanged();
    } catch (e) {
      setErr(e instanceof ApiError ? Object.values(e.fieldErrors)[0] ?? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const live = l.status === "ACTIVE" || l.status === "RESERVED";
  return (
    <li className={box}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Link href={`/listing/${l.slug}`} className="font-semibold text-bc-shell hover:text-bc-bar">{l.title}</Link>
        <span className="text-sm font-bold text-bc-shell">{priceLabel(l)}</span>
      </div>
      {note && <p className="mt-1 text-sm font-medium text-amber-800">{note}</p>}
      {l.status === "REMOVED" && l.removalReason && <p className="text-sm text-slate-700">{l.removalReason}</p>}
      {editing ? (
        <form
          className="mt-3 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const p = price.trim();
            void run(() => editMine(apiBase, l.id, { title, description, ...(l.kind === "GIVEAWAY" ? {} : { price: p === "" ? null : Number(p) }) }));
          }}
        >
          <label className="block text-sm font-medium">Title<input className={field} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <label className="block text-sm font-medium">Description<textarea className={field} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
          {l.kind !== "GIVEAWAY" && <label className="block text-sm font-medium">Price in pounds<input className={field} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></label>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className={`${btn} border-bc-bar bg-bc-bar text-white hover:bg-bc-shell`}>Save</button>
            <button type="button" onClick={() => setEditing(false)} className={btn}>Cancel</button>
          </div>
        </form>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {canRelist(l) && <button type="button" disabled={busy} onClick={() => run(() => listingAction(apiBase, l.id, "relist"))} className={btn}>{l.status === "ARCHIVED" ? "Relist" : "Bump Up"}</button>}
          {l.status !== "REMOVED" && <button type="button" disabled={busy} onClick={() => setEditing(true)} className={btn}>Edit</button>}
          {live && <button type="button" disabled={busy} onClick={() => run(() => listingAction(apiBase, l.id, "sold"))} className={btn}>Mark as Sold</button>}
          <button
            type="button"
            disabled={busy}
            onClick={() => { if (window.confirm("Delete this listing? This cannot be undone.")) void run(() => deleteMine(apiBase, l.id)); }}
            className={`${btn} text-red-800`}
          >
            Delete
          </button>
        </div>
      )}
      {err && <p role="alert" className="mt-2 text-sm text-red-700">{err}</p>}
    </li>
  );
}

function Tickets({ items }: { items: Ticket[] }) {
  if (items.length === 0) return <p className={box}>You have no support tickets. <Link href="/contact" className="font-semibold text-bc-bar underline">Contact Support</Link></p>;
  return (
    <ul role="list" className="space-y-3">
      {items.map((t) => (
        <li key={t.id} className={box}>
          <p className="flex flex-wrap justify-between gap-2 text-sm"><span className="font-semibold">{t.number} · {t.category}</span><span>{TICKET_STATUS_LABEL[t.status]}</span></p>
          <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{t.message}</p>
          {t.adminReply && <p className="mt-3 rounded-lg bg-sky-50 p-3 text-sm text-slate-800"><span className="font-semibold">Reply from the BSD team. </span>{t.adminReply}</p>}
        </li>
      ))}
    </ul>
  );
}

export default function AccountTabs({ apiBase }: { apiBase: string }) {
  const [tab, setTab] = useState<AccountTab>("active");
  const [mine, setMine] = useState<MineListing[] | null>(null);
  const [saved, setSaved] = useState<MarketListItem[] | null>(null);
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    Promise.all([mineListings(apiBase), savedListings(apiBase), myTickets(apiBase)])
      .then(([m, s, t]) => { setMine(m.items); setSaved(s.items); setTickets(t.items); })
      .catch(() => setFailed(true));
  }, [apiBase]);
  useEffect(load, [load]);

  if (failed) return <p role="alert" className={box}>Your account could not be loaded. Please try again shortly.</p>;
  if (!mine || !saved || !tickets) return <div aria-busy="true" className="h-48 rounded-2xl bg-slate-200/60 motion-safe:animate-pulse" />;

  const rows = (which: "active" | "archived") => mine.filter((l) => tabFor(l) === which);
  const list = (items: MineListing[], empty: string) =>
    items.length === 0 ? <p className={box}>{empty}</p> : <ul role="list" className="space-y-3">{items.map((l) => <Row key={l.id} l={l} apiBase={apiBase} onChanged={load} />)}</ul>;

  return (
    <div>
      <div role="tablist" aria-label="My account" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={`tab-${t}`}
            aria-selected={tab === t}
            aria-controls="account-panel"
            onClick={() => setTab(t)}
            className={`press min-h-11 rounded-full px-4 text-sm font-semibold ${tab === t ? "bg-bc-bar text-white" : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"}`}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>
      <div id="account-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="mt-5">
        {tab === "active" && list(rows("active"), "You have no active listings.")}
        {tab === "archived" && list(rows("archived"), "You have no expired or archived listings.")}
        {tab === "saved" && (saved.length === 0 ? <p className={box}>You have not saved any listings.</p> : <ListingGrid items={saved} />)}
        {tab === "tickets" && <Tickets items={tickets} />}
        {tab === "pass" && (
          <p className={box}>
            Your Privilege Pass lives on its own site.{" "}
            <a href={SITES.card.origin} className="font-semibold text-bc-bar underline">Open the Privilege Pass</a>
          </p>
        )}
      </div>
    </div>
  );
}
