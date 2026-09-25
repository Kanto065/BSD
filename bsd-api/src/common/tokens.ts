import jwt from "jsonwebtoken";

// Admin sessions use two tokens:
//   access token   15 minutes, sent as "Authorization: Bearer", kept only in the page's memory.
//   refresh token  7 days, in an httpOnly cookie that scripts cannot read, used only to get a new access token.
// Both carry the admin's tokenVersion. Bumping it in the database (password change, logout, account disabled)
// ends every session at once.

export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;
export const REFRESH_COOKIE = "bsd_refresh";

export type TokenClaims = { sub: string; tv: number; typ: "access" | "refresh" };

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error("JWT_SECRET must be set to at least 32 characters");
  return s;
}

export function signToken(typ: TokenClaims["typ"], adminId: string, tokenVersion: number): string {
  return jwt.sign({ tv: tokenVersion, typ }, secret(), {
    subject: adminId,
    expiresIn: typ === "access" ? ACCESS_TTL_SECONDS : REFRESH_TTL_SECONDS,
    algorithm: "HS256",
    issuer: "bsd-api",
  });
}

/** Verifies signature, expiry, issuer and type. Returns null for anything that is not a valid token of that type. */
export function verifyToken(token: string, typ: TokenClaims["typ"]): TokenClaims | null {
  try {
    const payload = jwt.verify(token, secret(), { algorithms: ["HS256"], issuer: "bsd-api" }) as jwt.JwtPayload;
    if (payload.typ !== typ || typeof payload.sub !== "string" || typeof payload.tv !== "number") return null;
    return { sub: payload.sub, tv: payload.tv, typ };
  } catch {
    return null;
  }
}
