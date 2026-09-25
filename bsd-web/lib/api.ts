import type { VerificationStatus } from "@/components/VerificationBadge";

// Server-side client for the public BSD API. Pages call it while rendering on the server, never from the browser.

export type NameSlug = { name: string; slug: string };

export type PublicListItem = {
  slug: string;
  name: string;
  summary: string;
  category: NameSlug;
  subcategory: NameSlug | null;
  zone: NameSlug;
  localities: NameSlug[];
  postcodeDistrict: string;
  /** Null for home-based listings, which show only the district. */
  postcode: string | null;
  address: string | null;
  phone: string;
  whatsapp: string | null;
  verificationStatus: VerificationStatus;
  verifiedAt: string | null;
  logoUrl: string | null;
};

export type PublicDetail = Omit<PublicListItem, "summary"> & {
  description: string;
  email: string | null;
  websiteOrSocial: string | null;
  servicesOffered: string[];
  openingHours: string | null;
  specialNotes: string | null;
  otherAreaText: string | null;
  servedZones: NameSlug[];
  photos: { url: string; thumbUrl: string | null; isLogo: boolean; width: number | null; height: number | null }[];
};

export type Page<T> = { items: T[]; page: number; pageSize: number; total: number; totalPages: number };

export type ApiResult<T> =
  | { ok: true; data: T }
  // "build" means the call was skipped because the site is being built. It renders like an empty result.
  | { ok: false; reason: "not_found" | "unavailable" | "build" };

// Read at runtime through bracket access so the value is not inlined at build time (the compose file sets it on
// the running container, not on the image build).
function apiBase(): string {
  const env = process.env;
  const configured = env["API_URL"] ?? env["NEXT_PUBLIC_API_URL"];
  if (configured) return configured.replace(/\/$/, "");
  return env["NODE_ENV"] === "production" ? "https://api.bsd.wales" : "http://localhost:4000";
}

/**
 * The API address the visitor's browser uses (for the submission form). The page reads it on the server at request
 * time and passes it down, because NEXT_PUBLIC_ values would otherwise be fixed when the image is built.
 */
export function publicApiBase(): string {
  const env = process.env;
  const configured = env["NEXT_PUBLIC_API_URL"];
  if (configured) return configured.replace(/\/$/, "");
  return env["NODE_ENV"] === "production" ? "https://api.bsd.wales" : "http://localhost:4000";
}

type Options = {
  /** Seconds the response may be reused. Omit for no caching: listings are always fetched fresh. */
  revalidate?: number;
};

export async function apiGet<T>(path: string, opts: Options = {}): Promise<ApiResult<T>> {
  // Never call the API while `next build` prerenders pages. The API may not be up yet on the server, and the
  // page revalidates and fills in real data after deploy.
  if (process.env["NEXT_PHASE"] === "phase-production-build") return { ok: false, reason: "build" };
  try {
    const res = await fetch(`${apiBase()}${path}`, {
      headers: { accept: "application/json" },
      ...(opts.revalidate === undefined ? { cache: "no-store" as const } : { next: { revalidate: opts.revalidate } }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) return { ok: false, reason: "not_found" };
    if (!res.ok) return { ok: false, reason: "unavailable" };
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export const featured = (limit = 8) => apiGet<Page<PublicListItem>>(`/businesses/featured?limit=${limit}`);

export const listingsForCategory = (slug: string, pageSize = 12) =>
  apiGet<{ businesses: Page<PublicListItem> }>(`/categories/${encodeURIComponent(slug)}?pageSize=${pageSize}`);

export const listingsForZone = (slug: string, pageSize = 12) =>
  apiGet<{ businesses: Page<PublicListItem> }>(`/zones/${encodeURIComponent(slug)}?pageSize=${pageSize}`);

export const businessBySlug = (slug: string) => apiGet<PublicDetail>(`/businesses/${encodeURIComponent(slug)}`);

export function searchListings(params: { q?: string; zone?: string; category?: string; page?: number }) {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.zone) qs.set("zone", params.zone);
  if (params.category) qs.set("category", params.category);
  if (params.page && params.page > 1) qs.set("page", String(params.page));
  qs.set("pageSize", "12");
  // No caching: search text is never stored by the web server.
  return apiGet<Page<PublicListItem>>(`/businesses/search?${qs.toString()}`);
}

// ---------------------------------------------------------------------------
// Link helpers for contact details supplied by business owners
// ---------------------------------------------------------------------------

/** wa.me wants the number in international format with no plus sign. A leading 0 is treated as a UK number. */
export function whatsappLink(number: string): string | null {
  let digits = number.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = `44${digits.slice(1)}`;
  return digits.length >= 8 && digits.length <= 15 ? `https://wa.me/${digits}` : null;
}

/** The website field is free text. Only a real http(s) URL becomes a link, so a value like javascript:... never does. */
export function safeExternalUrl(value: string | null): string | null {
  if (!value) return null;
  const text = value.trim();
  const candidate = /^https?:\/\//i.test(text) ? text : /^[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(text) ? `https://${text}` : null;
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}
