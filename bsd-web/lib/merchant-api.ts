import { ApiError } from "@/lib/admin-session";
import { apiCall } from "@/lib/member-api";
import type { VerifyReply } from "@/lib/scan";

// Merchant calls for the Privilege Pass (bsd-api pass.merchant.ts mounted at /auth, pass.verify.ts at /pass).

export type OfferStatus = "PENDING" | "ACTIVE" | "PAUSED" | "REJECTED";
export type MerchantOffer = { id: string; title: string; percent: number | null; terms: string; status: OfferStatus; rejectionReason: string | null };
export type Today = { scans: number; confirmed: number; savingsPence: number; lastScanAt: string | null };

const offerPath = (id: string) => `auth/listings/${encodeURIComponent(id)}/offer`;

export const getOffer = (api: string, listingId: string) => apiCall<{ offer: MerchantOffer | null }>(api, offerPath(listingId));
export const saveOffer = (api: string, listingId: string, body: { title: string; percent: number | null; terms: string }) =>
  apiCall<{ offer: MerchantOffer }>(api, offerPath(listingId), { method: "PUT", body });
export const flipOffer = (api: string, listingId: string, action: "pause" | "resume") =>
  apiCall<{ offer: MerchantOffer }>(api, `${offerPath(listingId)}/${action}`, { method: "POST", body: {} });

export const verifyScan = (api: string, businessId: string, scanned: { type: "qr"; token: string } | { type: "code"; code: string }) =>
  apiCall<VerifyReply & { serverTime: number }>(api, "pass/verify", { body: { businessId, ...scanned } });
export const confirmRedemption = (api: string, redemptionId: string, billPence?: number) =>
  apiCall<{ ok: true; billPence: number | null; savingPence: number | null }>(api, `pass/redemptions/${encodeURIComponent(redemptionId)}/confirm`, { body: billPence === undefined ? {} : { billPence } });
export const getToday = (api: string, businessId: string) => apiCall<Today>(api, `pass/terminal/today?businessId=${encodeURIComponent(businessId)}`);

export const messageOf = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);
