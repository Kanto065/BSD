"use client";

import Link from "next/link";
import { useState } from "react";
import MarketGate from "@/components/market/MarketGate";
import { ApiError } from "@/lib/admin-session";
import { TICKET_CATEGORIES, sendTicket } from "@/lib/market-account";

// The support ticket form (M12-D). No chat and no email: the member sees the answer under My Support Tickets.

const field = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900";

export default function AccountContact({ apiBase, title }: { apiBase: string; title: string }) {
  return <MarketGate apiBase={apiBase} title={title}>{() => <ContactBody apiBase={apiBase} />}</MarketGate>;
}

function ContactBody({ apiBase }: { apiBase: string }) {
  const [category, setCategory] = useState<string>(TICKET_CATEGORIES[0]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [number, setNumber] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < 10) return setError("Write at least 10 characters.");
    setBusy(true);
    setError("");
    try {
      setNumber((await sendTicket(apiBase, category, message)).ticket.number);
      setMessage("");
    } catch (err) {
      setError(err instanceof ApiError ? Object.values(err.fieldErrors)[0] ?? err.message : "Could not send your ticket. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (number) {
    return (
      <p role="status" className="max-w-xl rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-slate-800">
        Your ticket {number} has been sent. The BSD team will reply under{" "}
        <Link href="/my-account" className="font-semibold text-bc-bar underline">My Account</Link>.
      </p>
    );
  }
  return (
    <form onSubmit={submit} className="max-w-xl space-y-4 rounded-xl border border-slate-200 bg-white p-5" noValidate>
      <label className="block text-sm font-medium">What is it about?
        <select className={field} value={category} onChange={(e) => setCategory(e.target.value)}>
          {TICKET_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <label className="block text-sm font-medium">Message
        <textarea className={field} rows={6} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} />
      </label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={busy} className="press min-h-11 rounded-full bg-bc-bar px-6 text-base font-semibold text-white hover:bg-bc-shell disabled:opacity-60">
        {busy ? "Sending..." : "Send Ticket"}
      </button>
    </form>
  );
}
