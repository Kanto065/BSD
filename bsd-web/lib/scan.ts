// Pure helpers for the till scanner (M11-D). No React here so each one can be tested alone.

export type Scanned = { type: "qr"; token: string } | { type: "code"; code: string };

/** What a camera read or typed text is: a pass token, a one time code, or nothing we know. */
export function parseScanned(text: string): Scanned | null {
  const t = text.trim();
  if (!t) return null;
  if (t.length <= 200 && /^[A-Za-z0-9_-]+\.\d{1,12}\.[A-Za-z0-9_-]+$/.test(t)) return { type: "qr", token: t };
  const code = formatCode(t);
  return /^BC-\d{4}-[A-Z0-9]{2,5}$/.test(code) ? { type: "code", code } : null;
}

/** Pence saved. Same integer maths as the API (percent in hundredths), so the till shows what is stored. */
export const savingFor = (billPence: number, percent: number) => Math.round((billPence * Math.round(percent * 100)) / 10_000);

/** Turns what was typed or tapped into BC-9821-SA11 shape. Digits typed first get the BC prefix. */
export function formatCode(raw: string): string {
  let s = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (/^\d/.test(s)) s = "BC" + s;
  s = s.slice(0, 12);
  if (s.length <= 2) return s;
  const digits = s.slice(2, 6);
  const rest = s.slice(6);
  return ["BC", digits, rest].filter(Boolean).join("-");
}

/** A bill typed as pounds ("12", "12.5", "12.50") in pence, or null when it is not a usable amount (0 to 1000 pounds). */
export function billToPence(text: string): number | null {
  const m = /^(\d{1,4})(?:\.(\d{1,2}))?$/.exec(text.trim());
  if (!m) return null;
  const pence = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  return pence <= 100_000 ? pence : null;
}

export type VerifyReply =
  | { valid: false; reason: "invalid" | "expired" | "used" }
  | { valid: true; duplicate: true; secondsAgo: number }
  | { valid: true; member: { memberId: string; name: string; postcodeDistrict: string }; offer: { title: string; percent: number | null; terms: string }; redemptionId: string };

export type Overlay = "valid" | "expired" | "invalid" | "duplicate";

export function overlayFor(r: VerifyReply): Overlay {
  if (!r.valid) return r.reason === "expired" ? "expired" : "invalid";
  return "duplicate" in r ? "duplicate" : "valid";
}

export const BILL_PRESETS = [500, 1000, 2000, 5000] as const;

/** Mute choice is kept per phone. */
export const MUTE_KEY = "bsd-scan-muted";
