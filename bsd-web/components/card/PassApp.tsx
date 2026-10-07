"use client";

import Link from "next/link";
import { useEffect } from "react";
import { NEW_LABELS as T } from "@/lib/card-labels";
import PassCard from "./PassCard";
import PassOffers from "./PassOffers";
import { ClaimPanel, ConflictPanel, DriftNote, ErrorLine, JoinPanel, OfflineNote, outlineBtn, Panel, SignInPanel, SuspendedPanel, solidBtn } from "./PassPanels";
import { usePass } from "./usePass";

const ACCOUNT = "https://bsd.wales/account";

/**
 * The pass page body. `fallback` is shown to visitors who are not signed in (the home page passes the marketing
 * placeholder). Everything else is the member flow: join, claim, live pass, conflict, suspended, offline.
 */
export default function PassApp({ apiBase, fallback }: { apiBase: string; fallback?: React.ReactNode }) {
  const p = usePass(apiBase);

  // Register the app shell worker. It never sees a token (see public/sw.js).
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  if (p.loadFailed && p.view === "loading") {
    return (
      <Panel title={T.loadFailed}>
        <button type="button" className={solidBtn} onClick={() => void p.reload()}>
          {T.retry}
        </button>
      </Panel>
    );
  }

  switch (p.view) {
    case "loading":
      return <div role="status" aria-label={T.loading} className="h-72 motion-safe:animate-pulse rounded-3xl bg-white/10" />;
    case "signin":
      return fallback ?? <SignInPanel href={ACCOUNT} />;
    case "join":
      return <JoinPanel busy={p.busy} failed={p.joinFailed} onJoin={() => void p.join()} />;
    case "claim":
      return <ClaimPanel busy={p.busy} error={p.error} onClaim={() => void p.claim()} />;
    case "suspended":
      return <SuspendedPanel />;
    default:
      break;
  }

  const ready = p.view === "ready";
  return (
    <div className="space-y-5">
      {p.view === "conflict" && <ConflictPanel busy={p.busy} error={p.error} onMove={() => void p.move()} />}
      {p.view === "offline" && <OfflineNote />}
      {ready && p.drifted && <DriftNote />}
      {p.pass && p.view !== "conflict" && (
        <PassCard pass={p.pass} now={p.now} token={ready ? p.token : null} secondsLeft={p.secondsLeft} interval={p.interval} offline={p.view === "offline"} />
      )}
      {p.error && p.view !== "conflict" && <ErrorLine>{p.error}</ErrorLine>}
      <div className="flex flex-wrap gap-3">
        <Link href="/savings" className={outlineBtn}>
          {T.savingsLink}
        </Link>
      </div>
      <PassOffers apiBase={apiBase} device={p.device} canReveal={ready} />
    </div>
  );
}
