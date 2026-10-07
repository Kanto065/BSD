import crypto from "node:crypto";

// M11-A rotating Privilege Pass token (the QR content).
//   token = base64url(cardId) "." slot "." base64url(first 16 bytes of HMAC-SHA256(key, cardId "." slot "." deviceHash))
//   slot  = floor(unixSeconds / PASS_QR_SECONDS)
//   key   = HMAC-SHA256(PASS_TOKEN_SECRET, card.secret)  (a database leak alone cannot forge, nor can the env alone)
// The token holds no personal data, only the card id. The device hash is mixed into the MAC, so after a move the old
// phone's tokens stop verifying. A token is accepted for its slot and the one before (so up to twice the interval,
// which also absorbs clock skew between the phone and the server).

export const DEFAULT_QR_SECONDS = 30;

/** Seconds per slot, from PASS_QR_SECONDS (5 to 600, anything else falls back to 30). */
export function qrSeconds(): number {
  const n = Number(process.env.PASS_QR_SECONDS);
  return Number.isInteger(n) && n >= 5 && n <= 600 ? n : DEFAULT_QR_SECONDS;
}

/** Null when the server secret is missing. Production never falls back to a default, so the pass fails closed. */
function serverSecret(): string | null {
  const s = process.env.PASS_TOKEN_SECRET;
  if (s && s.length >= 32) return s;
  return process.env.NODE_ENV === "production" ? null : "dev-only-pass-token-secret-not-for-production";
}

export const passSecretConfigured = () => serverSecret() !== null;

export type PassCardKey = { id: string; secret: string; deviceHash: string | null };

export const slotAt = (nowMs: number) => Math.floor(nowMs / 1000 / qrSeconds());

function mac(card: PassCardKey, slot: number): Buffer | null {
  const server = serverSecret();
  if (!server) return null;
  const key = crypto.createHmac("sha256", server).update(card.secret).digest();
  return crypto.createHmac("sha256", key).update(`${card.id}.${slot}.${card.deviceHash ?? ""}`).digest().subarray(0, 16);
}

/** Null when the server secret is missing. */
export function makePassToken(card: PassCardKey, nowMs = Date.now()): string | null {
  const slot = slotAt(nowMs);
  const m = mac(card, slot);
  if (!m) return null;
  return `${Buffer.from(card.id).toString("base64url")}.${slot}.${m.toString("base64url")}`;
}

/** The card id a token claims to be for, so the caller can load that card. Not proof of anything yet. */
export function passTokenCardId(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3 || token.length > 200) return null;
  const id = Buffer.from(parts[0]!, "base64url").toString();
  return /^[A-Za-z0-9]{10,40}$/.test(id) ? id : null;
}

/** True when the token was made for this card and device state, in the current or previous slot. */
export function verifyPassToken(token: string, card: PassCardKey, nowMs = Date.now()): boolean {
  const parts = token.split(".");
  if (parts.length !== 3 || token.length > 200) return false;
  const [idPart, slotPart, macPart] = parts as [string, string, string];
  if (Buffer.from(idPart, "base64url").toString() !== card.id) return false;
  if (!/^\d{1,12}$/.test(slotPart)) return false;
  const slot = Number(slotPart);
  const now = slotAt(nowMs);
  if (slot !== now && slot !== now - 1) return false;
  const expected = mac(card, slot);
  const given = Buffer.from(macPart, "base64url");
  if (!expected || given.length !== expected.length) return false;
  return crypto.timingSafeEqual(expected, given);
}

/** What is stored for a device: never the raw id. */
export const deviceHashOf = (deviceId: string, cardId: string) => crypto.createHash("sha256").update(deviceId + cardId).digest("hex");

export const newCardSecret = () => crypto.randomBytes(32).toString("base64");
