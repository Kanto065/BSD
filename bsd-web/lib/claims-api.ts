import { ApiError } from "@/lib/admin-session";
import { apiCall } from "@/lib/member-api";
import { MAX_PROOF_BYTES, PROOF_TYPES } from "@/lib/student-api";

// Owner claims (M9-D), member side. The session is an httpOnly cookie, so every call sends credentials.

export type ClaimStatus = "PENDING" | "APPROVED" | "REJECTED";
export type MyClaim = {
  id: string;
  status: ClaimStatus;
  createdAt: string;
  reviewedAt: string | null;
  decisionNote: string | null;
  linkedOwner: boolean;
  hasProof: boolean;
  business: { name: string; slug: string };
};

export const CLAIM_TEXT_MIN = 20;
export const CLAIM_TEXT_MAX = 1000;
export const CLAIM_SIGN_IN = "Sign in to claim this listing";
export const CLAIM_CONSENT = "I agree that BSD can look at this file to check that I own this business. The file is deleted within 24 hours after the decision.";

/** The plain words a member sees for a claim. */
export function claimStatusText(c: Pick<MyClaim, "status" | "linkedOwner">): string {
  if (c.status === "PENDING") return "Waiting for review";
  if (c.status === "REJECTED") return "Not approved";
  return c.linkedOwner ? "Approved, this listing is now in your account" : "Approved";
}

/** Same checks as the API, so a bad file or short text is explained before it is sent. Null means fine. */
export function claimProblem(text: string, file: { type: string; size: number } | null): { proofText?: string; file?: string } | null {
  const out: { proofText?: string; file?: string } = {};
  const len = text.trim().length;
  if (len < CLAIM_TEXT_MIN) out.proofText = `Tell us briefly how you can show this is your business (at least ${CLAIM_TEXT_MIN} characters).`;
  else if (len > CLAIM_TEXT_MAX) out.proofText = `Keep this to ${CLAIM_TEXT_MAX} characters or fewer.`;
  if (file) {
    if (!PROOF_TYPES.includes(file.type)) out.file = "Upload a JPG, PNG, WebP or PDF file.";
    else if (file.size === 0) out.file = "That file is empty. Choose another file.";
    else if (file.size > MAX_PROOF_BYTES) out.file = "That file is larger than 5 MB. Choose a smaller file.";
  }
  return out.proofText || out.file ? out : null;
}

export const getMyClaims = (apiBase: string) => apiCall<{ items: MyClaim[] }>(apiBase, "auth/claims");

/** Sends a claim. The browser sets the multipart boundary, so no content type is given. */
export async function sendClaim(apiBase: string, slug: string, proofText: string, file: File | null): Promise<string> {
  const form = new FormData();
  form.append("proofText", proofText.trim());
  if (file) form.append("proof", file);
  const res = await fetch(`${apiBase}/businesses/${encodeURIComponent(slug)}/claim`, { method: "POST", credentials: "include", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? "Something went wrong.", data.fieldErrors ?? {});
  return data.message ?? "Thank you. The BSD team will check your claim. The result will show on your account page.";
}
