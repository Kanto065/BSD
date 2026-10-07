import { ApiError } from "@/lib/admin-session";

// Calls to the shared member login in the API. The session is an httpOnly cookie, so every call sends credentials.

export type Member = {
  id: string;
  name: string;
  email: string;
  postcode: string;
  phone: string | null;
  accountType: "GENERAL" | "STUDENT";
  /** True only after the BSD team has checked a student document. The account type alone is a claim. */
  studentVerified: boolean;
  listingCount: number;
  modules: string[];
  badges: string[];
};

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** One call to the API. Pass a path under the API root (for example "auth/me"). Throws ApiError on a non 2xx answer. */
export async function apiCall<T = unknown>(apiBase: string, path: string, opts: { method?: Method; body?: unknown } = {}): Promise<T> {
  const method = opts.method ?? (opts.body === undefined ? "GET" : "POST");
  const res = await fetch(`${apiBase}/${path}`, {
    method,
    credentials: "include",
    headers: opts.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? "Something went wrong.", data.fieldErrors ?? {});
  return data as T;
}

export async function memberCall(apiBase: string, path: string, body?: unknown): Promise<{ user?: Member }> {
  return apiCall(apiBase, `auth/${path}`, { method: body === undefined && path === "me" ? "GET" : "POST", body });
}

export const joinModule = (apiBase: string, module: "DIRECTORY" | "CARD" | "MARKETPLACE") =>
  memberCall(apiBase, "modules", { module });

export const updateProfile = (apiBase: string, body: Partial<Pick<Member, "name" | "phone" | "postcode" | "accountType">>) =>
  apiCall<{ user: Member }>(apiBase, "auth/me", { method: "PATCH", body });

/** Deletes the signed in account after the password is checked again. The API clears the session cookie. */
export const deleteAccount = (apiBase: string, password: string) => apiCall<{ ok: true }>(apiBase, "auth/me", { method: "DELETE", body: { password } });

export const changePassword = (apiBase: string, body: { currentPassword: string; newPassword: string }) =>
  apiCall<{ ok: true }>(apiBase, "auth/password", { method: "POST", body });

// Saved business details (one per account). The data keys are listed in bsd-api members.business.ts.
export type SavedProfile = { data: Record<string, unknown>; step: number };

export const getBusinessProfile = (apiBase: string) => apiCall<SavedProfile>(apiBase, "auth/business-profile");
export const saveBusinessProfile = (apiBase: string, data: Record<string, unknown>, step: number) =>
  apiCall<SavedProfile>(apiBase, "auth/business-profile", { method: "PUT", body: { data, step } });
export const clearBusinessProfile = (apiBase: string) => apiCall<SavedProfile>(apiBase, "auth/business-profile", { method: "DELETE" });

// The member's own listings.
export type OwnListingSummary = {
  id: string;
  slug: string;
  name: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "REMOVED";
  verificationStatus: string;
  submittedAt: string;
  showEmail: boolean;
  category: { name: string };
};

export type OwnListing = OwnListingSummary & {
  description: string;
  servicesOffered: string[];
  ownerName: string | null;
  phone: string;
  whatsapp: string | null;
  email: string | null;
  websiteOrSocial: string | null;
  address: string | null;
  hideFullAddress: boolean;
  postcode: string;
  openingHours: string | null;
  specialNotes: string | null;
  otherAreaText: string | null;
  serveZones: string[];
  localities: string[];
  category: { name: string; status: string; requiresOwnerName: boolean };
};

export const getOwnListings = (apiBase: string) => apiCall<{ items: OwnListingSummary[] }>(apiBase, "auth/listings");
export const getOwnListing = (apiBase: string, id: string) => apiCall<{ listing: OwnListing }>(apiBase, `auth/listings/${encodeURIComponent(id)}`);
export const patchOwnListing = (apiBase: string, id: string, body: Record<string, unknown>) =>
  apiCall<{ ok: true; listing: OwnListing }>(apiBase, `auth/listings/${encodeURIComponent(id)}`, { method: "PATCH", body });
