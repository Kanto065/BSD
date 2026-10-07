import { ApiError } from "@/lib/admin-session";

// Student verification (R-11), member side. The session is an httpOnly cookie, so every call sends credentials.

export type StudentStatus = "NONE" | "PENDING" | "VERIFIED" | "REJECTED" | "EXPIRED";
export type StudentState = {
  status: StudentStatus;
  verified: boolean;
  submittedAt?: string;
  decidedAt?: string | null;
  rejectionReason?: string | null;
};
export type StudentView = "none" | "pending" | "verified" | "rejected" | "expired";

export const MAX_PROOF_BYTES = 5 * 1024 * 1024;
export const PROOF_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const PROOF_ACCEPT = PROOF_TYPES.join(",");

/** Same checks as the API (type and size), so a bad file is explained before it is sent. Null means fine. */
export function proofProblem(file: { type: string; size: number }): string | null {
  if (!PROOF_TYPES.includes(file.type)) return "Upload a JPG, PNG, WebP or PDF file.";
  if (file.size === 0) return "That file is empty. Choose another file.";
  if (file.size > MAX_PROOF_BYTES) return "That file is larger than 5 MB. Choose a smaller file.";
  return null;
}

/** Which block of the panel shows. A verified badge wins over the latest request. */
export function studentView(state: StudentState): StudentView {
  if (state.verified || state.status === "VERIFIED") return "verified";
  if (state.status === "PENDING") return "pending";
  if (state.status === "REJECTED") return "rejected";
  if (state.status === "EXPIRED") return "expired";
  return "none";
}

async function call(apiBase: string, method: "GET" | "POST" | "DELETE", path: string, body?: FormData): Promise<StudentState> {
  const res = await fetch(`${apiBase}/student${path}`, { method, credentials: "include", body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? "Something went wrong.", data.fieldErrors ?? {});
  return data;
}

export const getStudent = (apiBase: string) => call(apiBase, "GET", "");
export const withdrawStudent = (apiBase: string) => call(apiBase, "DELETE", "/proof");
export function sendProof(apiBase: string, file: File, note: string) {
  const form = new FormData();
  if (note.trim()) form.append("note", note.trim());
  form.append("proof", file);
  return call(apiBase, "POST", "/proof", form);
}
