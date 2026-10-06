"use client";

import { useEffect, useState } from "react";
import { joinModule, memberCall, type Member } from "@/lib/member-api";
import { MODULE_FOR_SITE, sessionView } from "@/lib/member-session";
import { SITES } from "@/lib/site";

// Shows who is signed in on the Pass and Marketplace placeholders. Signing in itself happens on bsd.wales/account.

const ACCOUNT = "https://bsd.wales/account";
const solid = "min-h-[44px] rounded-md px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60";
const outline = "inline-flex min-h-[44px] items-center rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50";

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
    <div className="min-h-[88px]">
      {checking ? (
        <div className="h-4 w-48 animate-pulse rounded bg-slate-200" aria-hidden="true" />
      ) : (
        <div aria-live="polite">
          {view === "out" && (
            <a href={ACCOUNT} className={`${solid} inline-flex items-center`} style={{ background: info.themeColor }}>
              Sign in
            </a>
          )}
          {view === "join" && member && (
            <>
              <p className="text-slate-700">
                Hello, {member.name}. You have not joined {info.name} yet.
              </p>
              <button type="button" onClick={join} disabled={busy} className={`${solid} mt-3`} style={{ background: info.themeColor }}>
                {busy ? "Joining..." : `Join ${info.shortName}`}
              </button>
              {failed && <p className="mt-2 text-sm text-red-700">Could not join. Please try again.</p>}
            </>
          )}
          {view === "in" && member && (
            <>
              <p className="text-slate-700">Signed in as {member.name}.</p>
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
