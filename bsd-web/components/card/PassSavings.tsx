"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/admin-session";
import { getSavings, type Savings } from "@/lib/card-api";
import { NEW_LABELS as T } from "@/lib/card-labels";
import { formatPence } from "@/lib/pass-client";
import { ErrorLine, outlineBtn, SignInPanel } from "./PassPanels";

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl bg-white/[0.06] px-4 py-4 ring-1 ring-white/15">
    <dt className="text-xs uppercase tracking-wide text-slate-300">{label}</dt>
    <dd className="mt-1 font-heading text-2xl font-bold text-white">{value}</dd>
  </div>
);

export default function PassSavings({ apiBase }: { apiBase: string }) {
  const [s, setS] = useState<Savings | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "out" | "failed">("loading");

  useEffect(() => {
    getSavings(apiBase)
      .then((r) => {
        setS(r);
        setState("ok");
      })
      .catch((e) => setState(e instanceof ApiError && e.status === 401 ? "out" : "failed"));
  }, [apiBase]);

  return (
    <div className="space-y-5">
      <h1 className="font-heading text-2xl font-bold text-white">{T.savingsTitle}</h1>
      {state === "loading" && <div role="status" aria-label="Loading" className="h-40 motion-safe:animate-pulse rounded-2xl bg-white/10" />}
      {state === "out" && <SignInPanel href="https://bsd.wales/account" />}
      {state === "failed" && <ErrorLine>{T.loadFailed}</ErrorLine>}
      {state === "ok" && s && (
        <>
          <dl className="grid grid-cols-2 gap-3 motion-safe:animate-swap-in">
            <Stat label={T.savingsTotal} value={formatPence(s.totalPence)} />
            <Stat label={T.savingsThisYear} value={formatPence(s.thisYearPence)} />
            <Stat label={T.savingsCount} value={String(s.count)} />
            <Stat label={T.savingsShops} value={String(s.shops)} />
          </dl>
          {s.count === 0 && <p className="text-sm text-slate-300">{T.savingsEmpty}</p>}
        </>
      )}
      <Link href="/pass" className={outlineBtn}>
        {T.backToPass}
      </Link>
    </div>
  );
}
