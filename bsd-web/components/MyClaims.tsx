"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/admin-session";
import { claimStatusText, getMyClaims, type MyClaim } from "@/lib/claims-api";

// The member's own claims on /account/claims, with the plain status and the note when a claim is not approved.

const STYLE: Record<MyClaim["status"], string> = {
  PENDING: "border-amber-300 bg-amber-50 text-amber-900",
  APPROVED: "border-green-300 bg-green-50 text-green-900",
  REJECTED: "border-red-300 bg-red-50 text-red-900",
};
const dateText = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

export default function MyClaims({ apiBase }: { apiBase: string }) {
  const [state, setState] = useState<"checking" | "out" | "failed" | MyClaim[]>("checking");

  useEffect(() => {
    getMyClaims(apiBase)
      .then((r) => setState(r.items))
      .catch((err) => setState(err instanceof ApiError && err.status === 401 ? "out" : "failed"));
  }, [apiBase]);

  if (state === "checking") return <div aria-busy="true" className="h-32 animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none" />;
  if (state === "out") {
    return (
      <p className="text-slate-600">
        Please{" "}
        <Link href="/account" className="inline-flex min-h-11 items-center font-semibold text-brand-teal-dark underline">
          sign in
        </Link>{" "}
        to see your claims.
      </p>
    );
  }
  if (state === "failed") return <p role="alert" className="text-red-700">We could not load your claims. Please try again.</p>;
  if (state.length === 0) return <p className="text-slate-600">You have not claimed a listing yet. Open a business page and choose Claim This Listing.</p>;

  return (
    <ul className="space-y-3">
      {state.map((c) => (
        <li key={c.id} className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="font-semibold text-brand-navy">
            <Link href={`/businesses/${c.business.slug}`} className="inline-flex min-h-11 items-center hover:underline">
              {c.business.name}
            </Link>
          </p>
          <p className="text-xs text-slate-500">Sent {dateText(c.createdAt)}</p>
          <p className={`mt-2 inline-block rounded-md border px-3 py-1 text-sm font-semibold ${STYLE[c.status]}`}>{claimStatusText(c)}</p>
          {c.status === "REJECTED" && c.decisionNote && <p className="mt-2 break-words text-sm text-slate-700">{c.decisionNote}</p>}
          {c.status === "APPROVED" && c.linkedOwner && (
            <p className="mt-2">
              <Link href="/account/listings" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-teal-dark underline">
                Your listings
              </Link>
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
