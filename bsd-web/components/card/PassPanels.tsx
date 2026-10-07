"use client";

import { useId, useState } from "react";
import { CLOCK_DRIFT, CONFLICT, CONSENT, MOVE_PASS, NEW_LABELS as T, OFFLINE, SUSPENDED } from "@/lib/card-labels";

// Small screens of the pass flow: sign in, join, claim, suspended, offline, conflict. Pure presentation.

const press = "touch-manipulation select-none motion-safe:transition-transform motion-safe:duration-150 active:scale-[0.98]";
export const solidBtn = `inline-flex min-h-[44px] items-center justify-center rounded-full bg-[#0F766E] px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/25 focus-visible:outline-white disabled:opacity-60 ${press}`;
export const outlineBtn = `inline-flex min-h-[44px] items-center justify-center rounded-full border border-white/30 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 focus-visible:outline-white ${press}`;

export function Panel({ title, children, tone = "default" }: { title: string; children: React.ReactNode; tone?: "default" | "warn" }) {
  return (
    <section className={`rounded-2xl px-5 py-5 ring-1 motion-safe:animate-swap-in ${tone === "warn" ? "bg-amber-500/10 ring-amber-300/40" : "bg-white/[0.06] ring-white/15"}`}>
      <h2 className="font-heading text-lg font-semibold text-white">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-slate-200">{children}</div>
    </section>
  );
}

export const ErrorLine = ({ children }: { children: React.ReactNode }) => (
  <p role="alert" className="text-sm text-red-300">
    {children}
  </p>
);

export function SignInPanel({ href }: { href: string }) {
  return (
    <Panel title={T.signInTitle}>
      <a href={href} className={solidBtn}>
        {T.signIn}
      </a>
    </Panel>
  );
}

export function JoinPanel({ busy, failed, onJoin }: { busy: boolean; failed: boolean; onJoin: () => void }) {
  return (
    <Panel title={T.joinTitle}>
      <button type="button" onClick={onJoin} disabled={busy} className={solidBtn}>
        {busy ? T.joining : T.joinButton}
      </button>
      {failed && <ErrorLine>{T.joinFailed}</ErrorLine>}
    </Panel>
  );
}

export function ClaimPanel({ busy, error, onClaim }: { busy: boolean; error: string | null; onClaim: () => void }) {
  const id = useId();
  const [agree, setAgree] = useState(false);
  const [touched, setTouched] = useState(false);
  const showError = touched && !agree;
  return (
    <Panel title={T.claimTitle}>
      <p>{T.claimBody}</p>
      <label htmlFor={id} className="flex min-h-[44px] cursor-pointer items-start gap-3 text-white">
        <input
          id={id}
          type="checkbox"
          checked={agree}
          onChange={(e) => setAgree(e.target.checked)}
          aria-describedby={showError ? `${id}-err` : undefined}
          aria-invalid={showError}
          className="mt-0.5 h-6 w-6 shrink-0 accent-teal-500"
        />
        <span>{CONSENT}</span>
      </label>
      {showError && (
        <p id={`${id}-err`} role="alert" className="text-sm text-red-300">
          {T.consentError}
        </p>
      )}
      {error && <ErrorLine>{error}</ErrorLine>}
      <button
        type="button"
        disabled={busy}
        onClick={() => (agree ? onClaim() : setTouched(true))}
        className={solidBtn}
      >
        {busy ? T.claiming : T.claimButton}
      </button>
    </Panel>
  );
}

export function SuspendedPanel() {
  return (
    <Panel title="Pass suspended" tone="warn">
      <p>{SUSPENDED}</p>
    </Panel>
  );
}

export function OfflineNote() {
  return (
    <p role="status" className="rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-100 ring-1 ring-amber-300/40">
      {OFFLINE}
    </p>
  );
}

export function ConflictPanel({ busy, error, onMove }: { busy: boolean; error: string | null; onMove: () => void }) {
  return (
    <Panel title={CONFLICT} tone="warn">
      <p>{T.conflictBody}</p>
      {error && <ErrorLine>{error}</ErrorLine>}
      <button type="button" onClick={onMove} disabled={busy} className={solidBtn}>
        {busy ? T.moving : MOVE_PASS}
      </button>
    </Panel>
  );
}

export function DriftNote() {
  return (
    <p role="status" className="rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-100 ring-1 ring-amber-300/40">
      {CLOCK_DRIFT}
    </p>
  );
}
