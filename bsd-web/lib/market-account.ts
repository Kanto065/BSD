import { apiCall } from "@/lib/member-api";
import type { MarketDetail, MarketListItem } from "@/lib/market-api";

// Marketplace account, contact and help (M12-D). Pure helpers first so they can be tested without a browser.

export type MineListing = Omit<MarketDetail, "status"> & {
  status: "PENDING" | "ACTIVE" | "RESERVED" | "SOLD" | "ARCHIVED" | "REMOVED";
  phone: string | null;
  removalReason: string | null;
  reportCount: number;
  expiresAt: string;
};

export type Ticket = {
  id: string;
  number: string;
  category: string;
  message: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  adminReply: string | null;
  createdAt: string;
};

export const TABS = ["active", "saved", "archived", "tickets", "pass"] as const;
export type AccountTab = (typeof TABS)[number];
export const TAB_LABEL: Record<AccountTab, string> = {
  active: "My Active Listings",
  saved: "Saved",
  archived: "Expired / Archived",
  tickets: "My Support Tickets",
  pass: "Privilege Pass",
};

/** Which tab a listing lives in. Listings held for review stay with the active ones so the member sees `Under review`. */
export function tabFor(l: Pick<MineListing, "status" | "expiresAt">, now = Date.now()): "active" | "archived" {
  if (l.status === "PENDING") return "active";
  if (l.status === "ACTIVE" || l.status === "RESERVED") return new Date(l.expiresAt).getTime() > now ? "active" : "archived";
  return "archived";
}

const DAY = 24 * 60 * 60_000;

/** The API allows a relist once every 24 hours, and never for a held, sold or removed listing. */
export function canRelist(l: Pick<MineListing, "status" | "bumpedAt">, now = Date.now()): boolean {
  return (l.status === "ACTIVE" || l.status === "RESERVED" || l.status === "ARCHIVED") && now - new Date(l.bumpedAt).getTime() >= DAY;
}

export function statusNote(l: Pick<MineListing, "status" | "reportCount" | "expiresAt">, now = Date.now()): string | null {
  if (l.status === "PENDING") return l.reportCount > 0 ? "Under review" : "Waiting for review";
  if (l.status === "REMOVED") return "Removed";
  if (l.status === "SOLD") return "Sold";
  if (l.status === "RESERVED") return "Reserved";
  if (l.status === "ARCHIVED" || new Date(l.expiresAt).getTime() <= now) return "Expired";
  return null;
}

export const TICKET_STATUS_LABEL: Record<Ticket["status"], string> = { OPEN: "Open", IN_PROGRESS: "In progress", RESOLVED: "Resolved", CLOSED: "Closed" };
/** Same list as the API (market.safety.ts). */
export const TICKET_CATEGORIES = ["Listing problem", "My account", "Safety concern", "Privilege Pass", "Other"] as const;

export const mineListings = (apiBase: string) => apiCall<{ items: MineListing[] }>(apiBase, "market/mine");
export const savedListings = (apiBase: string) => apiCall<{ items: (MarketListItem & { id: string })[] }>(apiBase, "market/saves");
export const myTickets = (apiBase: string) => apiCall<{ items: Ticket[] }>(apiBase, "market/tickets");
export const sendTicket = (apiBase: string, category: string, message: string) =>
  apiCall<{ ticket: Ticket }>(apiBase, "market/tickets", { method: "POST", body: { category, message } });
export const listingAction = (apiBase: string, id: string, action: "sold" | "relist") =>
  apiCall<{ listing: MineListing }>(apiBase, `market/listings/${encodeURIComponent(id)}/${action}`, { method: "POST" });
export const editMine = (apiBase: string, id: string, body: { title: string; description: string; price?: number | null }) =>
  apiCall<{ listing: MineListing }>(apiBase, `market/listings/${encodeURIComponent(id)}`, { method: "PATCH", body });
export const deleteMine = (apiBase: string, id: string) => apiCall(apiBase, `market/listings/${encodeURIComponent(id)}`, { method: "DELETE" });

// ---------------------------------------------------------------------------
// Words on the new pages. The page structure ships now. Terms, Safe Trading Rules and the Help articles are legal or
// support text the client supplies (Q-M12-3), so the pages show a plain holding line until it arrives.
// ---------------------------------------------------------------------------

export const LEGAL_PENDING = "This page will be published here soon.";
export const HELP_CATEGORIES = ["Buying", "Selling", "Staying Safe", "Your Account"] as const;
export type HelpArticle = { category: (typeof HELP_CATEGORIES)[number]; title: string; body: string };
/** Empty until the client supplies the articles. */
export const HELP_ARTICLES: HelpArticle[] = [];

export function helpSearch(articles: HelpArticle[], q: string): HelpArticle[] {
  const t = q.trim().toLowerCase();
  return t ? articles.filter((a) => `${a.title} ${a.body}`.toLowerCase().includes(t)) : articles;
}
