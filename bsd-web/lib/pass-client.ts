// Pure helpers for the live pass. No React here so each one can be tested alone.

export const DEVICE_ID = /^[A-Za-z0-9-]{16,64}$/;
export const DRIFT_LIMIT_MS = 120_000;
export const DEVICE_KEY = "bsd-pass-device";

export type Store = { get(): Promise<string | null>; set(v: string): Promise<void> };

/** The device id: read from the first store that holds a valid one, else make one. Every store is then filled. */
export async function deviceId(stores: Store[], make: () => string = () => crypto.randomUUID()): Promise<string> {
  let id: string | null = null;
  for (const s of stores) {
    const v = await s.get().catch(() => null);
    if (v && DEVICE_ID.test(v)) {
      id = v;
      break;
    }
  }
  const final = id ?? make();
  await Promise.all(stores.map((s) => s.set(final).catch(() => undefined)));
  return final;
}

/** Browser stores: localStorage and IndexedDB. Either may be blocked, the other still holds the id. */
export function browserStores(): Store[] {
  const ls: Store = {
    get: async () => localStorage.getItem(DEVICE_KEY),
    set: async (v) => localStorage.setItem(DEVICE_KEY, v),
  };
  const open = () =>
    new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("bsd-pass", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  const idb: Store = {
    get: async () => {
      const db = await open();
      return new Promise<string | null>((resolve, reject) => {
        const q = db.transaction("kv").objectStore("kv").get(DEVICE_KEY);
        q.onsuccess = () => resolve((q.result as string | undefined) ?? null);
        q.onerror = () => reject(q.error);
      });
    },
    set: async (v) => {
      const db = await open();
      return new Promise<void>((resolve, reject) => {
        const t = db.transaction("kv", "readwrite");
        t.objectStore("kv").put(v, DEVICE_KEY);
        t.oncomplete = () => resolve();
        t.onerror = () => reject(t.error);
      });
    },
  };
  return [ls, idb];
}

/** Seconds left in the current QR slot. Same maths as the API (interval - unixSeconds % interval), so 1..interval. */
export function slotCountdown(serverTimeMs: number, intervalSeconds: number): number {
  return intervalSeconds - (Math.floor(serverTimeMs / 1000) % intervalSeconds);
}

/** When to ask for the next token: just after this one's slot ends (the API only hands out the current slot). */
export const refreshDelayMs = (expiresInSeconds: number) => Math.max(1, expiresInSeconds) * 1000 + 300;

/** The QR may only be drawn from a token that is still inside its slot by the (server corrected) clock. */
export const qrFresh = (expiresAtMs: number | null, nowMs: number) => expiresAtMs !== null && nowMs < expiresAtMs;

export const clockOffset = (serverTimeMs: number, clientNowMs: number) => serverTimeMs - clientNowMs;
export const clockDrifted = (offsetMs: number) => Math.abs(offsetMs) > DRIFT_LIMIT_MS;

/** UK wall clock with its zone name (GMT or BST). */
export function ukClock(ms: number): { time: string; zone: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hourCycle: "h23", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short" })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value])
  );
  return { time: `${parts.hour}:${parts.minute}:${parts.second}`, zone: parts.timeZoneName ?? "" };
}

export type PassState = {
  member: "loading" | "out" | "join" | "in";
  card: "unknown" | "none" | "active" | "suspended";
  device: "ok" | "conflict";
  online: boolean;
};
export type PassView = "loading" | "signin" | "join" | "claim" | "suspended" | "offline" | "conflict" | "ready";

export function passView(s: PassState): PassView {
  if (s.member === "loading") return "loading";
  if (s.member === "out") return "signin";
  if (s.member === "join") return "join";
  if (s.card === "unknown") return "loading";
  if (s.card === "none") return "claim";
  if (s.card === "suspended") return "suspended";
  if (!s.online) return "offline";
  if (s.device === "conflict") return "conflict";
  return "ready";
}

/** Copies text. Returns false when the browser refuses, so the caller can say so. */
export async function copyText(text: string, clip: Pick<Clipboard, "writeText"> | undefined = typeof navigator === "undefined" ? undefined : navigator.clipboard): Promise<boolean> {
  try {
    if (!clip) return false;
    await clip.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export const formatPence = (p: number) => `£${(p / 100).toFixed(2)}`;

/** m:ss for the one time code countdown. */
export function mmss(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
