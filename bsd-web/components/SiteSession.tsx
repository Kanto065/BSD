"use client";

import { useEffect, useState } from "react";
import { joinModule, memberCall, type Member } from "@/lib/member-api";
import { MODULE_FOR_SITE, sessionView } from "@/lib/member-session";
import { SITES } from "@/lib/site";

// Shows who is signed in on the Pass and Marketplace placeholders. Signing in itself happens on bsd.wales/account.

const ACCOUNT = "https://bsd.wales/account";
const press = "touch-manipulation select-none motion-safe:transition-transform motion-safe:duration-150 active:scale-[0.98]";
// The panel sits on the dark shell, so the focus ring is white and the solid buttons carry a thin light ring to stay visible against it.
const solid = `min-h-[44px] rounded-full px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/25 focus-visible:outline-white disabled:opacity-60 ${press}`;
const outline = `inline-flex min-h-[44px] items-center rounded-full border border-white/30 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 focus-visible:outline-white ${press}`;
// Darker shade of the site colour so white button text passes AA (teal #0D9488 is only 3.7:1 on white).
const BUTTON = { card: "#0F766E", market: "#005A8C" } as const;

export default function SiteSession({ site, apiBase }: { site: "card" | "market"; apiBase: string }) {
  const info = SITES[site];
  const [member, setMember] = useState<Member | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    memberCall(apiBase, "me")
      .then((r) => setMember(r.user ?? null))
      .catch(() => setMember(null))
      .finally(() => setChecking(false));
  }, [apiBase]);

  async function join() {
    setBusy(true);
    setFailed(false);
    try {
      const r = await joinModule(apiBase, MODULE_FOR_SITE[site]);
      setMember(r.user ?? member);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await memberCall(apiBase, "logout", {}).catch(() => undefined);
    setMember(null);
  }

  const view = sessionView(member, site);

  return (
    <div className="flex min-h-[88px] flex-col justify-center" aria-live="polite">
      {checking ? (
        <div className="h-4 w-48 animate-pulse rounded bg-white/15" aria-hidden="true" />
      ) : (
        // Keyed by state so each change (join, signed in, signed out) fades in. The live region above stays mounted.
        <div key={view} className="motion-safe:animate-swap-in">
          {view === "out" && (
            <a href={ACCOUNT} className={`${solid} inline-flex items-center`} style={{ background: BUTTON[site] }}>
              Sign in
            </a>
          )}
          {view === "join" && member && (
            <>
              <p className="text-slate-200">
                Hello, {member.name}. You have not joined {info.name} yet.
              </p>
              <button type="button" onClick={join} disabled={busy} className={`${solid} mt-3`} style={{ background: BUTTON[site] }}>
                {busy ? "Joining..." : `Join ${info.shortName}`}
              </button>
              {failed && <p className="mt-2 text-sm text-red-300 motion-safe:animate-swap-in">Could not join. Please try again.</p>}
            </>
          )}
          {view === "in" && member && (
            <>
              <p className="text-slate-200">Signed in as {member.name}.</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button type="button" onClick={signOut} className={outline}>
                  Sign out
                </button>
                <a href={ACCOUNT} className={outline}>
                  Your account
                </a>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
