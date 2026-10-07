import { ApiError } from "@/lib/admin-session";

// Calls for the Privilege Pass (bsd-api members.pass.ts and pass.verify.ts). Pass calls send the x-device header.

export type PassSummary = {
  name: string;
  initials: string;
  cardNumber: string;
  levelLabel: string;
  district: string;
  status: "ACTIVE" | "SUSPENDED";
  joinedAt: string;
};
export type PassToken = { token: string; expiresInSeconds: number; serverTime: number };
export type Savings = { totalPence: number; count: number; shops: number; thisYearPence: number };
/** `id` is needed to reveal a code. The public API does not send it yet (see the M11-C report). */
export type PartnerOffer = { id?: string; title: string; percent: number | null; terms: string };
export type Partner = { slug: string; name: string; areaLabel: string | null; postcodeDistrict: string; offer: PartnerOffer | null };
export type PartnerPage = { items: Partner[]; page: number; totalPages: number };
export type OfferCode = { code: string; expiresAt: string; expiresInSeconds: number };

/** An ApiError that also carries the API's canMove flag (device conflict). */
export class PassApiError extends ApiError {
  constructor(status: number, message: string, public canMove = false) {
    super(status, message);
  }
}

async function call<T>(apiBase: string, path: string, opts: { body?: unknown; device?: string } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.device) headers["x-device"] = opts.device;
  const res = await fetch(`${apiBase}/pass/${path}`, {
    method: opts.body === undefined ? "GET" : "POST",
    credentials: "include",
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new PassApiError(res.status, data.fieldErrors?.agreeShare ?? data.error ?? "Something went wrong.", data.canMove === true);
  return data as T;
}

export const getPass = (apiBase: string) => call<PassSummary>(apiBase, "me");
export const claimPass = (apiBase: string) => call<PassSummary>(apiBase, "claim", { body: { agreeShare: true } });
export const getPassToken = (apiBase: string, device: string) => call<PassToken>(apiBase, "token", { device });
export const movePass = (apiBase: string, device: string) => call<{ ok: true }>(apiBase, "move", { body: {}, device });
export const getSavings = (apiBase: string) => call<Savings>(apiBase, "savings");
export const getPartners = (apiBase: string, page = 1) => call<PartnerPage>(apiBase, `partners?page=${page}`);
export const revealCode = (apiBase: string, device: string, offerId: string) => call<OfferCode>(apiBase, "code", { body: { offerId }, device });

/** True for a failed fetch (no network), as opposed to an answer from the API. */
export const isNetworkError = (e: unknown) => !(e instanceof ApiError);
