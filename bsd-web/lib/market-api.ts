import { apiGet, whatsappLink as waLink } from "@/lib/api";
import { ApiError } from "@/lib/admin-session";
import { apiCall } from "@/lib/member-api";
import { zoneForPostcode } from "@/lib/business-profile";
import { SITES } from "@/lib/site";

// Marketplace client (M12-C). Server pages read the public /market routes through apiGet. The post flow and the
// contact reveal run in the browser. Text here that comes from the client's layout is copied exactly.

export type MarketKind = "SELL" | "BUY" | "GIVEAWAY" | "SERVICE";
export type MarketCondition = "BRAND_NEW" | "LIKE_NEW" | "USED_GOOD" | "FOR_PARTS";
export type MarketImage = { url: string; thumbUrl: string; width: number; height: number };

export type MarketListItem = {
  slug: string;
  title: string;
  kind: MarketKind;
  isB2B: boolean;
  free: boolean;
  pricePence: number | null;
  negotiable: boolean;
  condition: MarketCondition | null;
  category: { name: string; slug: string };
  postcodeDistrict: string;
  /** Null when the seller hides the full address. */
  postcode: string | null;
  /** "Location: SA5" when the address is hidden, otherwise null. */
  areaLabel: string | null;
  hideFullAddress: boolean;
  verifiedBusiness: { name: string; slug: string } | null;
  bumpedAt: string;
  createdAt: string;
  image: MarketImage | null;
};

export type MarketDetail = Omit<MarketListItem, "image"> & {
  id: string;
  status: "ACTIVE" | "RESERVED" | "SOLD";
  description: string;
  whatsapp: string;
  offerPassDiscount: boolean;
  passDiscountNote: string | null;
  vatInvoice: boolean;
  bulkTerms: string | null;
  spot: { name: string; address: string; postcodeDistrict: string } | null;
  images: MarketImage[];
};

export type MarketPage = { total: number; page: number; pageSize: number; items: MarketListItem[] };
export type MarketCategory = { name: string; slug: string };
export type SafeSpot = { id: string; name: string; address: string; postcodeDistrict: string };

// ---------------------------------------------------------------------------
// Client wording
// ---------------------------------------------------------------------------

export const LEGAL_TEXT = "I agree that BayConnect is a neutral platform and holds no liability for transactions, payments, item condition, quality, or returns.";
export const SAFETY_WARNING = "Always inspect items in person. Meet in safe, well lit public places in Swansea/Neath/Carmarthenshire. Do not send upfront bank transfers.";
export const HERO_SUBTITLE = "Buy, Sell, Share and Connect locally across Swansea, Swansea Bay, and South Wales.";
export const B2B_BANNER = "Are you a Local Business or Merchant on SA1 to SA34 ? Trade Commercial Equipment directly on BayConnect B2B.";
export const BUYER_DEMAND = { title: "Can't Find What You Need?", text: "Looking for a specific item, plumber, or tutor in Swansea?" };
export const WANTED_BOARD = { title: "Community Wanted Board", text: "Post what you need and local sellers or service providers will reach out to you." };
export const COPYRIGHT = "© 2026 BSD Wales. Powered by BayConnect";

export const CONDITION_LABEL: Record<MarketCondition, string> = {
  BRAND_NEW: "New",
  LIKE_NEW: "Like New",
  USED_GOOD: "Used Good",
  FOR_PARTS: "For Parts",
};
export const CONDITIONS = Object.keys(CONDITION_LABEL) as MarketCondition[];

/** Step 1 module select, in the client's order. Housing is reserved and not offered (Q-M12-2). */
export const KIND_OPTIONS: { kind: MarketKind; label: string }[] = [
  { kind: "SELL", label: "Sell Item" },
  { kind: "BUY", label: "Buy Request" },
  { kind: "GIVEAWAY", label: "Give Away" },
  { kind: "SERVICE", label: "Service Offered" },
];

export const POST_STEPS = ["Listing type", "Category", "Details", "Review"] as const;
export const SPOT_FALLBACK = "A public place we agree by WhatsApp";

/** Categories shown if the API cannot be reached, so the home page always has its grid. Staged ones are left out. */
export const FALLBACK_CATEGORIES: MarketCategory[] = [
  { name: "Buy & Sell", slug: "buy-and-sell" },
  { name: "B2B Equipment", slug: "b2b-equipment" },
  { name: "Home Cooks & Halal Goods", slug: "home-cooks-and-halal-goods" },
  { name: "Vehicles", slug: "vehicles" },
  { name: "Cultural Goods", slug: "cultural-goods" },
  { name: "Give Away", slug: "give-away" },
  { name: "Wanted Items / Gigs", slug: "wanted-items-gigs" },
  { name: "Local Services", slug: "local-services" },
  { name: "Student Essentials", slug: "student-essentials" },
];

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

/** "FREE" for a giveaway, otherwise pounds ("£12", "£12.50"). A listing without a price says so. */
export function priceLabel(l: Pick<MarketListItem, "free" | "kind" | "pricePence">): string {
  if (l.free || l.kind === "GIVEAWAY") return "FREE";
  if (l.pricePence === null) return l.kind === "BUY" ? "Budget not stated" : "Ask for price";
  const pounds = l.pricePence / 100;
  return `£${Number.isInteger(pounds) ? pounds : pounds.toFixed(2)}`;
}

/** Where the item is. A listing that hides its address shows only the API's area label, never a postcode. */
export function placeLabel(l: Pick<MarketListItem, "hideFullAddress" | "areaLabel" | "postcode" | "postcodeDistrict">): string {
  if (l.hideFullAddress) return l.areaLabel ?? `Location: ${l.postcodeDistrict}`;
  return l.postcode ?? l.postcodeDistrict;
}

export const HIDDEN_ADDRESS_NOTICE = "The seller has hidden the full address. Only the area is shown.";

/** Uploaded images live on bsd.wales. The marketplace host does not proxy /uploads, so live pages use the absolute address. */
export function mediaUrl(url: string): string {
  return url.startsWith("/") && process.env.NODE_ENV === "production" ? SITES.bsd.origin + url : url;
}

export const whatsappMessage = (title: string) =>
  `Hi, I am interested in your item: ${title} listed on BayConnect Marketplace. Is it still available?`;

/** The wa.me address with the client's prefilled message, or null when the number is not usable. */
export function whatsappLink(l: Pick<MarketDetail, "whatsapp" | "title">): string | null {
  const base = waLink(l.whatsapp);
  return base ? `${base}?text=${encodeURIComponent(whatsappMessage(l.title))}` : null;
}

/** What the listing page shows, decided in one place so the page and the tests agree. */
export function listingView(l: MarketDetail) {
  const closed = l.status === "SOLD";
  return {
    price: priceLabel(l),
    free: l.free,
    showNegotiable: l.negotiable && !l.free,
    place: placeLabel(l),
    hiddenNotice: l.hideFullAddress,
    condition: l.condition ? CONDITION_LABEL[l.condition] : null,
    b2b: l.isB2B ? { vatInvoice: l.vatInvoice, bulkTerms: l.bulkTerms } : null,
    verifiedBusiness: l.verifiedBusiness,
    contactOpen: !closed,
    statusNote: l.status === "SOLD" ? "This item has been sold." : l.status === "RESERVED" ? "This item is reserved." : null,
  };
}

export function searchHref(p: { q?: string; kind?: string; category?: string; zone?: string; free?: boolean; b2b?: boolean; page?: number }): string {
  const qs = new URLSearchParams();
  if (p.q) qs.set("q", p.q);
  if (p.kind) qs.set("kind", p.kind);
  if (p.category) qs.set("category", p.category);
  if (p.zone) qs.set("zone", p.zone);
  if (p.free) qs.set("free", "true");
  if (p.b2b) qs.set("b2b", "true");
  if (p.page && p.page > 1) qs.set("page", String(p.page));
  const s = qs.toString();
  return s ? `/search?${s}` : "/search";
}

// ---------------------------------------------------------------------------
// Server reads (public, never cached)
// ---------------------------------------------------------------------------

export function marketListings(params: Record<string, string | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
  return apiGet<MarketPage>(`/market/listings?${qs.toString()}`);
}
export const marketListing = (slug: string) => apiGet<MarketDetail>(`/market/listings/${encodeURIComponent(slug)}`);
export const marketCategories = () => apiGet<{ categories: MarketCategory[] }>("/market/categories");
export const marketSpots = () => apiGet<{ spots: SafeSpot[] }>("/market/spots");

// ---------------------------------------------------------------------------
// Post flow
// ---------------------------------------------------------------------------

export type PostValues = {
  kind: MarketKind | "";
  isB2B: boolean;
  category: string;
  offerPassDiscount: boolean;
  passDiscountNote: string;
  title: string;
  description: string;
  price: string;
  negotiable: boolean;
  condition: MarketCondition | "";
  postcode: string;
  hideFullAddress: boolean;
  spotId: string;
  whatsapp: string;
  phone: string;
  vatInvoice: boolean;
  bulkTerms: string;
  legalAcknowledged: boolean;
};

export const emptyPost: PostValues = {
  kind: "", isB2B: false, category: "", offerPassDiscount: false, passDiscountNote: "", title: "", description: "", price: "",
  negotiable: false, condition: "", postcode: "", hideFullAddress: true, spotId: "", whatsapp: "", phone: "", vatInvoice: false,
  bulkTerms: "", legalAcknowledged: false,
};

export const MAX_IMAGES = 5;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export type Errors = Record<string, string | undefined>;

const validPhone = (v: string) => {
  const digits = v.replace(/\D/g, "");
  return /^[+()\d\s-]+$/.test(v.trim()) && digits.length >= 10 && digits.length <= 15;
};

/** Browser side checks for one step (0 to 3). The API checks everything again. */
export function validatePostStep(step: number, v: PostValues, files: { size: number; type: string }[] = []): Errors {
  const e: Errors = {};
  if (step === 0 && !v.kind) e.kind = "Choose what you are posting.";
  if (step === 1 && !v.category) e.category = "Choose a category from the list.";
  if (step === 2) {
    if (v.title.trim().length < 5) e.title = "The title must be at least 5 characters.";
    else if (v.title.trim().length > 120) e.title = "Keep this under 120 characters.";
    if (v.description.trim().length < 20) e.description = "The description must be at least 20 characters.";
    else if (v.description.trim().length > 2000) e.description = "Keep this under 2000 characters.";
    const price = v.price.trim();
    if (v.kind !== "GIVEAWAY") {
      if (price === "") {
        if (v.kind === "SELL") e.price = "Enter a price.";
      } else if (!/^\d{1,7}(\.\d{1,2})?$/.test(price)) e.price = "Enter a price in pounds, for example 12.50.";
      else if (parseFloat(price) > 1_000_000) e.price = "The price can be at most 1,000,000 pounds.";
    }
    const pc = zoneForPostcode(v.postcode);
    if (!v.postcode.trim()) e.postcode = "Enter the postcode.";
    else if (pc?.problem) e.postcode = pc.problem;
    if (!validPhone(v.whatsapp)) e.whatsapp = "Enter a valid phone number.";
    if (v.phone.trim() && !validPhone(v.phone)) e.phone = "Enter a valid phone number.";
    if (files.length > MAX_IMAGES) e.images = `Upload up to ${MAX_IMAGES} images.`;
    const bad = files.find((f) => !IMAGE_TYPES.includes(f.type) || f.size > MAX_IMAGE_BYTES);
    if (bad) e.images = IMAGE_TYPES.includes(bad.type) ? `Each image must be ${MAX_IMAGE_BYTES / 1024 / 1024} MB or smaller.` : "Use JPG, PNG or WebP images.";
  }
  if (step === 3 && !v.legalAcknowledged) e.legalAcknowledged = "Please tick this box to continue.";
  return e;
}

export const hasErrors = (e: Errors) => Object.values(e).some(Boolean);

/** The step that holds the first field the API complained about. */
export function stepForField(field: string): number {
  if (field === "kind") return 0;
  if (field === "category" || field === "offerPassDiscount" || field === "passDiscountNote") return 1;
  if (field === "legalAcknowledged") return 3;
  return 2;
}

/** The earliest step that owns any of the fields the API complained about, or null when there are none. */
export const earliestStep = (fields: string[]): number | null => (fields.length ? Math.min(...fields.map(stepForField)) : null);

/** The multipart body the API expects. Giveaways send no price. B2B fields go only on business listings. */
export function buildPostForm(v: PostValues, files: File[]): FormData {
  const f = new FormData();
  const put = (k: string, val: string | boolean) => f.append(k, String(val));
  put("kind", v.kind);
  put("isB2B", v.isB2B);
  put("title", v.title.trim());
  put("description", v.description.trim());
  if (v.kind !== "GIVEAWAY" && v.price.trim()) put("price", v.price.trim());
  put("negotiable", v.negotiable && v.kind !== "GIVEAWAY");
  if (v.condition) put("condition", v.condition);
  put("category", v.category);
  put("postcode", v.postcode.trim());
  put("hideFullAddress", v.hideFullAddress);
  if (v.spotId) put("spotId", v.spotId);
  put("whatsapp", v.whatsapp.trim());
  if (v.phone.trim()) put("phone", v.phone.trim());
  put("offerPassDiscount", v.offerPassDiscount);
  if (v.offerPassDiscount && v.passDiscountNote.trim()) put("passDiscountNote", v.passDiscountNote.trim());
  put("vatInvoice", v.isB2B && v.vatInvoice);
  if (v.isB2B && v.bulkTerms.trim()) put("bulkTerms", v.bulkTerms.trim());
  put("legalAcknowledged", v.legalAcknowledged);
  for (const file of files.slice(0, MAX_IMAGES)) f.append("images", file);
  return f;
}

export type CreatedListing = { slug: string; status: string; title: string };

export async function createMarketListing(apiBase: string, v: PostValues, files: File[]): Promise<{ listing: CreatedListing; held: boolean }> {
  const res = await fetch(`${apiBase}/market/listings`, { method: "POST", credentials: "include", body: buildPostForm(v, files) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? "Could not post the listing. Please try again.", data.fieldErrors ?? {});
  return { listing: data.listing, held: Boolean(data.held) };
}

// ---------------------------------------------------------------------------
// Contact reveal: the first call hands out a token, the number comes after the 10 second wait.
// ---------------------------------------------------------------------------

export const CONTACT_WAIT_SECONDS = 10;

export const contactStart = (apiBase: string, slug: string) =>
  apiCall<{ ready: false; retryAfterSeconds: number; token: string }>(apiBase, `market/listings/${encodeURIComponent(slug)}/contact`);
export const contactReveal = (apiBase: string, slug: string, token: string) =>
  apiCall<{ ready: true; phone: string }>(apiBase, `market/listings/${encodeURIComponent(slug)}/contact?token=${encodeURIComponent(token)}`);

/** Digits only, for a tel: link. */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

export const REPORT_REASONS = ["Scam or fraud", "Prohibited item", "Wrong category", "Offensive content", "Duplicate listing", "Other"] as const;
export const saveListing = (apiBase: string, id: string) => apiCall<{ saved: boolean }>(apiBase, `market/saves/${encodeURIComponent(id)}`, { method: "PUT" });
export const unsaveListing = (apiBase: string, id: string) => apiCall<{ saved: boolean }>(apiBase, `market/saves/${encodeURIComponent(id)}`, { method: "DELETE" });
export const reportListing = (apiBase: string, id: string, reason: string, note?: string) =>
  apiCall<{ ok: true; already?: boolean; underReview?: boolean }>(apiBase, `market/listings/${encodeURIComponent(id)}/report`, { method: "POST", body: { reason, ...(note?.trim() ? { note: note.trim() } : {}) } });

/** True when a page of the member's saved listings holds this listing. */
export const isSavedIn = (items: { id: string }[], id: string) => items.some((i) => i.id === id);
/** The button's state after a click: a saved listing is removed, anything else is saved. */
export const toggleSaved = (saved: boolean) => ({ saved: !saved, method: saved ? ("DELETE" as const) : ("PUT" as const) });
const SAVES_PAGE = 24;
const SAVES_PAGES_CHECKED = 5;
/** Whether the signed in member has saved this listing. Reads their saved pages, up to 120 listings. */
export async function loadSaved(apiBase: string, id: string): Promise<boolean> {
  for (let page = 1; page <= SAVES_PAGES_CHECKED; page++) {
    const r = await apiCall<{ items: { id: string }[] }>(apiBase, `market/saves?page=${page}`);
    if (isSavedIn(r.items, id)) return true;
    if (r.items.length < SAVES_PAGE) return false;
  }
  return false;
}
