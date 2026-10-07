"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/admin-session";
import { claimPass, getPass, getPassToken, isNetworkError, movePass, PassApiError, type PassSummary } from "@/lib/card-api";
import { RESET_ASK } from "@/lib/card-labels";
import { joinModule, memberCall, type Member } from "@/lib/member-api";
import { sessionView } from "@/lib/member-session";
import { browserStores, clockDrifted, clockOffset, deviceId, passView, qrFresh, refreshDelayMs, slotCountdown, type PassState } from "@/lib/pass-client";

// All the state of the live pass in one place. Nothing here is written to storage except the device id.

type Tok = { token: string; expiresAt: number };
const GRACE_MS = 3000; // the API still accepts the previous slot, this only bridges the refresh call

export function usePass(apiBase: string) {
  const [member, setMember] = useState<Member | null | undefined>(undefined);
  const [pass, setPass] = useState<PassSummary | null | undefined>(undefined);
  const [suspended, setSuspended] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [online, setOnline] = useState(true);
  const [tok, setTok] = useState<Tok | null>(null);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [joinFailed, setJoinFailed] = useState(false);
  const device = useRef<string | null>(null);
  const [deviceStr, setDeviceStr] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // The API sends seconds left, not the interval. Right after a boundary the answer is the whole interval, so keep the largest.
  const [interval, setIntervalSeconds] = useState(0);

  // Session, then the pass summary.
  const load = useCallback(async () => {
    setLoadFailed(false);
    try {
      const m = (await memberCall(apiBase, "me")).user ?? null;
      setMember(m);
      if (m && sessionView(m, "card") === "in") {
        try {
          setPass(await getPass(apiBase));
        } catch (e) {
          if (e instanceof ApiError && e.status === 404) setPass(null);
          else throw e;
        }
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return setMember(null);
      if (isNetworkError(e)) setOnline(false);
      setLoadFailed(true);
    }
  }, [apiBase]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // One clock tick a second feeds the clock, the countdown and the expiry check.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const active = !!pass && pass.status === "ACTIVE" && !suspended;

  const fetchToken = useCallback(async () => {
    clearTimeout(timer.current);
    try {
      device.current ??= await deviceId(browserStores());
      setDeviceStr(device.current);
      const r = await getPassToken(apiBase, device.current);
      const client = Date.now();
      setOffset(clockOffset(r.serverTime, client));
      setConflict(false);
      setOnline(true);
      setIntervalSeconds((i) => Math.max(i, r.expiresInSeconds));
      setTok({ token: r.token, expiresAt: r.serverTime + r.expiresInSeconds * 1000 });
      timer.current = setTimeout(() => void fetchToken(), refreshDelayMs(r.expiresInSeconds));
    } catch (e) {
      setTok(null);
      if (e instanceof PassApiError && e.status === 409) return setConflict(true);
      if (e instanceof ApiError && e.status === 403) return setSuspended(true);
      if (isNetworkError(e)) setOnline(false);
      // Rate limited or a hiccup: try again shortly. Offline waits for the online event below.
      if (!isNetworkError(e)) timer.current = setTimeout(() => void fetchToken(), 5000);
    }
  }, [apiBase]);

  useEffect(() => {
    if (!active || conflict || !online) {
      clearTimeout(timer.current);
      return;
    }
    void fetchToken();
    const visible = () => document.visibilityState === "visible" && void fetchToken();
    document.addEventListener("visibilitychange", visible);
    return () => {
      document.removeEventListener("visibilitychange", visible);
      clearTimeout(timer.current);
    };
  }, [active, conflict, online, fetchToken]);

  // Offline: drop the token at once so no QR is left on screen.
  useEffect(() => {
    if (!online) setTok(null);
  }, [online]);

  const corrected = now + offset;
  const fresh = tok && qrFresh(tok.expiresAt + GRACE_MS, corrected) ? tok : null;

  const state: PassState = {
    member: member === undefined ? "loading" : member === null ? "out" : sessionView(member, "card"),
    card: pass === undefined ? "unknown" : pass === null ? "none" : active ? "active" : "suspended",
    device: conflict ? "conflict" : "ok",
    online,
  };

  async function join() {
    setBusy(true);
    setJoinFailed(false);
    try {
      const r = await joinModule(apiBase, "CARD");
      setMember(r.user ?? member ?? null);
      await load();
    } catch {
      setJoinFailed(true);
    } finally {
      setBusy(false);
    }
  }

  async function claim() {
    setBusy(true);
    setError(null);
    try {
      setPass(await claimPass(apiBase));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function move() {
    setBusy(true);
    setError(null);
    try {
      device.current ??= await deviceId(browserStores());
      setDeviceStr(device.current);
      await movePass(apiBase, device.current);
      setConflict(false);
    } catch (e) {
      setError(e instanceof PassApiError && e.status === 429 ? RESET_ASK : e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return {
    view: passView(state),
    pass: pass ?? null,
    member: member ?? null,
    token: fresh?.token ?? null,
    secondsLeft: fresh && corrected < fresh.expiresAt ? slotCountdown(corrected, interval || 30) : 0,
    interval: interval || 30,
    now: corrected,
    drifted: clockDrifted(offset),
    online,
    busy,
    error,
    loadFailed,
    joinFailed,
    device: deviceStr,
    reload: load,
    join,
    claim,
    move,
  };
}
