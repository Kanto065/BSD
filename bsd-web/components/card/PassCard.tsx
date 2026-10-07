"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { NEW_LABELS as T } from "@/lib/card-labels";
import type { PassSummary } from "@/lib/card-api";
import { ukClock } from "@/lib/pass-client";

// The pass itself: level badge, name, member ID, district, UK clock and the rotating QR. It only draws the QR when
// `token` is set, and the parent clears the token the moment it expires, so a stale code is never shown.

type Props = {
  pass: PassSummary;
  /** Corrected clock (device time plus the server offset), ticked every second by the parent. */
  now: number;
  /** Null when there is no fresh token (loading, expired, offline). */
  token: string | null;
  secondsLeft: number;
  interval: number;
  /** Offline hides the refresh wording, the offline note is shown by the parent. */
  offline?: boolean;
};

function Ring({ left, total }: { left: number; total: number }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, left / total));
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true" className="shrink-0 -rotate-90">
      <circle cx="26" cy="26" r={r} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
      <circle cx="26" cy="26" r={r} fill="none" stroke="#5EEAD4" strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} />
    </svg>
  );
}

function Qr({ token }: { token: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    QRCode.toString(token, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#FFFFFF" } })
      .then((s) => alive && setSvg(s))
      .catch(() => alive && setSvg(null));
    return () => {
      alive = false;
    };
  }, [token]);
  // The svg is made here by the qrcode library from our own token, never from user input.
  return svg ? (
    <div role="img" aria-label="Your pass QR code" className="mx-auto aspect-square w-full max-w-[260px] rounded-xl bg-white p-2 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
  ) : (
    <div className="mx-auto aspect-square w-full max-w-[260px] rounded-xl bg-white" aria-hidden="true" />
  );
}

export default function PassCard({ pass, now, token, secondsLeft, interval, offline }: Props) {
  const clock = ukClock(now);
  return (
    <article aria-label="Your BSD Privilege Pass" className="overflow-hidden rounded-3xl bg-gradient-to-br from-teal-600 to-teal-900 p-5 shadow-xl ring-1 ring-white/20 motion-safe:animate-rise">
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/25">{pass.levelLabel}</span>
        <p className="text-right font-mono text-sm tabular-nums text-teal-50">
          <span className="sr-only">{T.clockLabel} </span>
          <span aria-hidden={false}>{clock.time}</span> <span className="text-xs">{clock.zone}</span>
        </p>
      </div>
      <h2 className="mt-5 font-heading text-2xl font-bold text-white">{pass.name}</h2>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-teal-50">
        <div>
          <dt className="text-xs uppercase tracking-wide text-teal-100">{T.memberId}</dt>
          <dd className="font-mono text-sm font-semibold text-white">{pass.cardNumber}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-teal-100">{T.postcodeArea}</dt>
          <dd className="font-mono text-sm font-semibold text-white">{pass.district}</dd>
        </div>
      </dl>
      <div className="mt-5">
        {token ? (
          <>
            <Qr token={token} />
            <div className="mt-3 flex items-center justify-center gap-3 text-sm text-white">
              <Ring left={secondsLeft} total={interval} />
              <span aria-hidden="true">
                {T.refreshesIn} {secondsLeft}s
              </span>
            </div>
          </>
        ) : (
          <div className="mx-auto flex aspect-square w-full max-w-[260px] items-center justify-center rounded-xl bg-white/10 p-4 text-center text-sm text-teal-50 ring-1 ring-white/20">
            {offline ? null : <span role="status">{T.refreshing}</span>}
          </div>
        )}
      </div>
    </article>
  );
}
