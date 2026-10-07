"use client";

import { useEffect, useState } from "react";
import AccountForm from "@/components/AccountForm";
import { joinModule, memberCall, type Member } from "@/lib/member-api";
import { sessionView } from "@/lib/member-session";
import { SITES } from "@/lib/site";

// Sign in gate for member only screens (same pattern as Submit): signed out shows the sign in form, signed in without
// the Marketplace shows the join button, otherwise the screen is rendered with the member.

const press = "press touch-manipulation select-none";

export default function MarketGate({ apiBase, title, children }: { apiBase: string; title: string; children: (member: Member, onSignedOut: () => void) => React.ReactNode }) {
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
      const r = await joinModule(apiBase, "MARKETPLACE");
      setMember(r.user ?? member);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  if (checking) return <div aria-busy="true" className="h-64 rounded-2xl bg-slate-200/60 motion-safe:animate-pulse" />;

  const view = sessionView(member, "market");
  if (view === "in" && member) return <>{children(member, () => setMember(null))}</>;

  return (
    <section className="max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(12,46,66,0.05)] sm:p-8" aria-live="polite">
      {view === "join" && member ? (
        <>
          <h2 className="font-heading text-xl font-bold text-bc-shell">Hello, {member.name}</h2>
          <p className="mt-2 text-slate-600">You have not joined {SITES.market.name} yet.</p>
          <button type="button" onClick={join} disabled={busy} className={`${press} mt-5 min-h-11 rounded-full bg-bc-bar px-6 text-base font-semibold text-white hover:bg-bc-shell disabled:opacity-60`}>
            {busy ? "Joining..." : `Join ${SITES.market.shortName}`}
          </button>
          {failed && <p role="alert" className="mt-2 text-sm text-red-700">Could not join. Please try again.</p>}
        </>
      ) : (
        <>
          <h2 className="font-heading text-xl font-bold text-bc-shell">{title}</h2>
          <p className="mt-2 text-slate-600">One account works on the directory, the Privilege Pass and the Marketplace.</p>
          <div className="mt-6 max-w-md">
            <AccountForm apiBase={apiBase} compact onSignedIn={(u) => setMember(u)} />
          </div>
        </>
      )}
    </section>
  );
}
