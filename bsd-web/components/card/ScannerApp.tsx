"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ALREADY_SCANNED, CONFIRM_DISCOUNT, LIVE_CAMERA, MANUAL_CODE, MERCHANT_LABELS as T, NEW_LABELS, SCAN_NEXT } from "@/lib/card-labels";
import { ApiError } from "@/lib/admin-session";
import { confirmRedemption, getOffer, getToday, messageOf, verifyScan, type Today } from "@/lib/merchant-api";
import { getOwnListings, memberCall, type OwnListingSummary } from "@/lib/member-api";
import { formatPence } from "@/lib/pass-client";
import { BILL_PRESETS, MUTE_KEY, billToPence, formatCode, overlayFor, parseScanned, savingFor, type VerifyReply } from "@/lib/scan";
import ScannerCamera, { type CameraProblem } from "./ScannerCamera";
import { Panel, solidBtn } from "./PassPanels";

const ACCOUNT = "https://bsd.wales/account";
const AUTO_DISMISS_MS = 4000;

type Result = VerifyReply;
type Phase = "loading" | "signin" | "none" | "ready";

// Sounds are made with Web Audio so there are no files to load. Safe where audio or vibration is missing.
let audio: AudioContext | null = null;
function tone(freq: number, start: number, len: number, type: OscillatorType = "sine") {
  try {
    audio ??= new AudioContext();
    void audio.resume();
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.2, audio.currentTime + start);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + start + len);
    o.connect(g).connect(audio.destination);
    o.start(audio.currentTime + start);
    o.stop(audio.currentTime + start + len + 0.02);
  } catch {
    /* no audio */
  }
}
function feedback(ok: boolean, muted: boolean) {
  if (!muted) {
    if (ok) {
      tone(880, 0, 0.12);
      tone(880, 0.18, 0.12);
    } else tone(160, 0, 0.4, "sawtooth");
  }
  try {
    navigator.vibrate?.(ok ? [60, 40, 60] : [250]);
  } catch {
    /* no vibration */
  }
}

export default function ScannerApp({ apiBase }: { apiBase: string }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [listings, setListings] = useState<OwnListingSummary[]>([]);
  const [bizId, setBizId] = useState("");
  const [live, setLive] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"camera" | "code">("camera");
  const [problem, setProblem] = useState<CameraProblem | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [bill, setBill] = useState("");
  const [done, setDone] = useState<{ saving: number | null } | null>(null);
  const [today, setToday] = useState<Today | null>(null);
  const [muted, setMuted] = useState(false);
  const last = useRef({ text: "", at: 0 });
  const mutedRef = useRef(false);
  mutedRef.current = muted;

  useEffect(() => {
    try {
      setMuted(localStorage.getItem(MUTE_KEY) === "1");
    } catch {
      /* storage blocked */
    }
    (async () => {
      try {
        const me = await memberCall(apiBase, "me");
        if (!me.user) return setPhase("signin");
        const approved = (await getOwnListings(apiBase)).items.filter((l) => l.status === "APPROVED");
        setListings(approved);
        setBizId(approved[0]?.id ?? "");
        setPhase(approved.length ? "ready" : "none");
      } catch (e) {
        setPhase(e instanceof ApiError && e.status === 401 ? "signin" : "none");
      }
    })();
  }, [apiBase]);

  const refreshToday = useCallback(() => {
    if (bizId) getToday(apiBase, bizId).then(setToday).catch(() => undefined);
  }, [apiBase, bizId]);

  useEffect(() => {
    if (!bizId) return;
    setLive(null);
    setToday(null);
    getOffer(apiBase, bizId)
      .then((r) => setLive(r.offer?.status === "ACTIVE"))
      .catch(() => setLive(false));
    refreshToday();
  }, [apiBase, bizId, refreshToday]);

  const reset = useCallback(() => {
    setResult(null);
    setDone(null);
    setBill("");
    setError(null);
    setCode("");
  }, []);

  // Red and yellow clear themselves. Green waits for the cashier.
  const overlay = result ? overlayFor(result) : null;
  useEffect(() => {
    if (!overlay || overlay === "valid") return;
    const t = setTimeout(reset, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [overlay, reset]);

  async function check(text: string) {
    const scanned = parseScanned(text);
    const now = Date.now();
    if (busy || result || !bizId) return;
    if (!scanned) {
      if (tab === "code") setError(T.invalid);
      return;
    }
    if (last.current.text === text && now - last.current.at < 3000) return;
    last.current = { text, at: now };
    setBusy(true);
    setError(null);
    try {
      const r = await verifyScan(apiBase, bizId, scanned);
      setResult(r);
      feedback(r.valid && !("duplicate" in r), mutedRef.current);
      if (r.valid && !("duplicate" in r)) refreshToday();
    } catch (e) {
      feedback(false, mutedRef.current);
      setError(e instanceof ApiError ? e.message : T.networkError);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!result || !result.valid || "duplicate" in result) return;
    const pence = bill.trim() ? billToPence(bill) : undefined;
    if (pence === null) return setError(T.billInvalid);
    setBusy(true);
    setError(null);
    try {
      const r = await confirmRedemption(apiBase, result.redemptionId, pence);
      setDone({ saving: r.savingPence });
      refreshToday();
    } catch (e) {
      setError(messageOf(e, T.confirmFailed));
    } finally {
      setBusy(false);
    }
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    try {
      localStorage.setItem(MUTE_KEY, next ? "1" : "0");
    } catch {
      /* storage blocked */
    }
  }

  if (phase === "loading") return <div role="status" aria-label={T.checking} className="h-72 motion-safe:animate-pulse rounded-3xl bg-white/10" />;
  if (phase === "signin") {
    return (
      <Panel title={T.scanSignIn}>
        <a href={ACCOUNT} className={solidBtn}>
          {NEW_LABELS.signIn}
        </a>
      </Panel>
    );
  }
  if (phase === "none") return <Panel title={T.noListing}>{null}</Panel>;

  const name = listings.find((l) => l.id === bizId)?.name ?? "";
  const tabBtn = (on: boolean) => `min-h-[44px] flex-1 rounded-full px-4 text-sm font-semibold ${on ? "bg-white text-slate-900" : "text-white ring-1 ring-white/30"}`;
  const pence = bill.trim() ? billToPence(bill) : null;
  const percent = result && result.valid && "offer" in result ? result.offer.percent : null;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.06] px-4 py-3 ring-1 ring-white/15">
        {listings.length > 1 ? (
          <label className="min-w-0 flex-1 text-xs text-slate-300">
            {T.listing}
            <select value={bizId} onChange={(e) => { reset(); setBizId(e.target.value); }} className="mt-1 block min-h-[44px] w-full rounded-lg bg-slate-900 px-2 text-base text-white">
              {listings.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </label>
        ) : (
          <h2 className="min-w-0 flex-1 truncate font-heading text-lg font-semibold text-white">{name}</h2>
        )}
        <button type="button" onClick={toggleMute} aria-pressed={muted} className="min-h-[44px] shrink-0 rounded-full px-4 text-sm font-semibold text-white ring-1 ring-white/30">
          {muted ? T.soundOff : T.soundOn}
        </button>
      </header>

      {live === false ? (
        <Panel title={T.noLiveOffer} tone="warn">{null}</Panel>
      ) : (
        <>
          <div role="tablist" className="flex gap-2">
            <button role="tab" aria-selected={tab === "camera"} className={tabBtn(tab === "camera")} onClick={() => setTab("camera")}>{LIVE_CAMERA}</button>
            <button role="tab" aria-selected={tab === "code"} className={tabBtn(tab === "code")} onClick={() => setTab("code")}>{MANUAL_CODE}</button>
          </div>

          {tab === "camera" && !problem && (cameraOn ? (
            <ScannerCamera paused={busy || result !== null} onRead={(t) => void check(t)} onProblem={setProblem} />
          ) : (
            <button type="button" className={`${solidBtn} w-full`} onClick={() => setCameraOn(true)}>{T.startCamera}</button>
          ))}
          {tab === "camera" && problem && <p role="alert" className="text-sm text-amber-200">{problem === "denied" ? T.cameraDenied : T.cameraMissing}</p>}

          {tab === "code" && (
            <form onSubmit={(e) => { e.preventDefault(); void check(code); }} className="space-y-3">
              <label className="block text-xs text-slate-300">
                {T.codeLabel}
                <input value={code} onChange={(e) => setCode(formatCode(e.target.value))} autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="BC-9821-SA11" className="mt-1 block min-h-[56px] w-full rounded-xl bg-slate-900 px-4 text-center font-mono text-2xl tracking-wider text-white" />
              </label>
              <div className="grid grid-cols-3 gap-2">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                  <button key={d} type="button" onClick={() => setCode(formatCode(code + d))} className="min-h-[60px] rounded-xl bg-white/10 text-2xl font-semibold text-white active:bg-white/20">{d}</button>
                ))}
                <span />
                <button type="button" onClick={() => setCode(formatCode(code + "0"))} className="min-h-[60px] rounded-xl bg-white/10 text-2xl font-semibold text-white active:bg-white/20">0</button>
                <button type="button" aria-label={T.backspace} onClick={() => setCode(formatCode(code.replace(/[^A-Za-z0-9]/g, "").slice(0, -1)))} className="min-h-[60px] rounded-xl bg-white/10 text-lg font-semibold text-white active:bg-white/20">&larr;</button>
              </div>
              <button type="submit" disabled={busy} className={`${solidBtn} w-full`}>{busy ? T.checking : T.checkCode}</button>
            </form>
          )}
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        </>
      )}

      {today && (
        <dl className="grid grid-cols-3 gap-2 rounded-2xl bg-white/[0.06] p-3 text-center text-white ring-1 ring-white/15" aria-label={T.todayTitle}>
          <div><dt className="text-xs text-slate-300">{T.todayScans}</dt><dd className="text-lg font-semibold">{today.scans}</dd></div>
          <div><dt className="text-xs text-slate-300">{T.todayConfirmed}</dt><dd className="text-lg font-semibold">{today.confirmed}</dd></div>
          <div><dt className="text-xs text-slate-300">{T.todaySaved}</dt><dd className="text-lg font-semibold">{formatPence(today.savingsPence)}</dd></div>
        </dl>
      )}

      {result && overlay && (
        <div role="alertdialog" aria-modal="true" aria-label={overlay} className={`fixed inset-0 z-50 flex flex-col justify-center gap-4 overflow-y-auto p-6 text-white ${overlay === "valid" ? "bg-green-700" : overlay === "duplicate" ? "bg-yellow-500 text-slate-900" : "bg-red-700"}`}>
          {result.valid && "member" in result && (
            <>
              <p className="text-sm font-semibold uppercase tracking-wide">{done ? T.confirmed : T.memberId}</p>
              <p className="font-heading text-3xl font-bold">{result.member.name}</p>
              <p>{result.member.memberId} &middot; {result.member.postcodeDistrict}</p>
              <p className="text-lg">{result.offer.title}{result.offer.percent !== null && ` (${result.offer.percent}%)`}</p>
              {done ? (
                <p className="text-2xl font-bold">{done.saving !== null ? `${T.discount} ${formatPence(done.saving)}` : T.confirmed}</p>
              ) : (
                <>
                  <label className="block text-sm">
                    {T.billLabel}
                    <input value={bill} onChange={(e) => setBill(e.target.value)} inputMode="decimal" className="mt-1 block min-h-[56px] w-full rounded-xl px-4 text-2xl text-slate-900" />
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {BILL_PRESETS.map((p) => (
                      <button key={p} type="button" onClick={() => setBill(String(p / 100))} className="min-h-[48px] rounded-xl bg-white/20 text-lg font-semibold">&pound;{p / 100}</button>
                    ))}
                  </div>
                  {pence !== null && percent !== null && <p className="text-lg">{T.discount} {formatPence(savingFor(pence, percent))}</p>}
                  <button type="button" disabled={busy} onClick={() => void confirm()} className="min-h-[56px] rounded-full bg-white px-6 text-lg font-bold text-green-800 disabled:opacity-60">{CONFIRM_DISCOUNT}</button>
                </>
              )}
              {error && <p role="alert" className="font-semibold">{error}</p>}
              <button type="button" onClick={reset} className="min-h-[56px] rounded-full px-6 text-lg font-bold ring-2 ring-white">{SCAN_NEXT}</button>
            </>
          )}
          {overlay === "duplicate" && <p className="font-heading text-3xl font-bold">{ALREADY_SCANNED}</p>}
          {overlay === "expired" && <p className="font-heading text-3xl font-bold">{T.expired}</p>}
          {overlay === "invalid" && <p className="font-heading text-3xl font-bold">{T.invalid}</p>}
          {overlay !== "valid" && (
            <div aria-hidden="true" className="h-1 overflow-hidden rounded bg-black/20">
              <div className="h-full origin-left bg-white motion-safe:animate-dismiss" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
