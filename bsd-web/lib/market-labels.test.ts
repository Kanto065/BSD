import { describe, it, expect } from "vitest";
import {
  B2B_BANNER, BUYER_DEMAND, COPYRIGHT, FALLBACK_CATEGORIES, HERO_SUBTITLE, KIND_OPTIONS, LEGAL_TEXT, SAFETY_WARNING, WANTED_BOARD,
  emptyPost, listingView, placeLabel, priceLabel, searchHref, validatePostStep, whatsappLink, buildPostForm, type MarketDetail,
} from "./market-api";

// Locks the client's Marketplace wording (layout 3.2 and the post flow). Do not edit a string here to make the test
// pass. A change to client wording needs the PM's approval first.

const detail = (o: Partial<MarketDetail> = {}): MarketDetail => ({
  slug: "x", title: "Prayer mat", kind: "SELL", isB2B: false, free: false, pricePence: 1250, negotiable: true, condition: "USED_GOOD",
  category: { name: "Buy & Sell", slug: "buy-and-sell" }, postcodeDistrict: "SA5", postcode: "SA5 4AB", areaLabel: null, hideFullAddress: false,
  verifiedBusiness: null, bumpedAt: "", createdAt: "", status: "ACTIVE", description: "d", whatsapp: "07700 900123", offerPassDiscount: false,
  passDiscountNote: null, vatInvoice: false, bulkTerms: null, spot: null, images: [], ...o,
});

describe("client wording", () => {
  it("keeps the exact strings", () => {
    expect(LEGAL_TEXT).toBe("I agree that BayConnect is a neutral platform and holds no liability for transactions, payments, item condition, quality, or returns.");
    expect(SAFETY_WARNING).toBe("Always inspect items in person. Meet in safe, well lit public places in Swansea/Neath/Carmarthenshire. Do not send upfront bank transfers.");
    expect(HERO_SUBTITLE).toBe("Buy, Sell, Share and Connect locally across Swansea, Swansea Bay, and South Wales.");
    expect(B2B_BANNER).toBe("Are you a Local Business or Merchant on SA1 to SA34 ? Trade Commercial Equipment directly on BayConnect B2B.");
    expect(BUYER_DEMAND).toEqual({ title: "Can't Find What You Need?", text: "Looking for a specific item, plumber, or tutor in Swansea?" });
    expect(WANTED_BOARD.title).toBe("Community Wanted Board");
    expect(COPYRIGHT).toBe("© 2026 BSD Wales. Powered by BayConnect");
    expect(KIND_OPTIONS.map((k) => k.label)).toEqual(["Sell Item", "Buy Request", "Give Away", "Service Offered"]);
  });
  it("home grid has no staged categories", () => {
    expect(FALLBACK_CATEGORIES.map((c) => c.name)).not.toContain("Housing");
  });
});

describe("display helpers", () => {
  it("prices", () => {
    expect(priceLabel({ free: false, kind: "SELL", pricePence: 1250 })).toBe("£12.50");
    expect(priceLabel({ free: false, kind: "SELL", pricePence: 1200 })).toBe("£12");
    expect(priceLabel({ free: true, kind: "GIVEAWAY", pricePence: null })).toBe("FREE");
  });
  it("whatsapp carries the client's prefilled message", () => {
    const href = whatsappLink(detail())!;
    expect(href).toContain("https://wa.me/");
    expect(decodeURIComponent(href)).toContain("Hi, I am interested in your item: Prayer mat listed on BayConnect Marketplace. Is it still available?");
    expect(whatsappLink(detail({ whatsapp: "nope" }))).toBeNull();
  });
  it("hidden address never shows the postcode", () => {
    const hidden = detail({ hideFullAddress: true, postcode: null, areaLabel: "Location: SA5" });
    expect(placeLabel(hidden)).toBe("Location: SA5");
    expect(JSON.stringify(listingView(hidden))).not.toContain("SA5 4AB");
    expect(listingView(hidden).hiddenNotice).toBe(true);
    expect(placeLabel(detail())).toBe("SA5 4AB");
  });
  it("sold listing closes contact", () => {
    expect(listingView(detail({ status: "SOLD" })).contactOpen).toBe(false);
    expect(listingView(detail({ isB2B: true, vatInvoice: true })).b2b).toEqual({ vatInvoice: true, bulkTerms: null });
  });
  it("search links", () => {
    expect(searchHref({})).toBe("/search");
    expect(searchHref({ q: "mat", free: true, page: 2 })).toBe("/search?q=mat&free=true&page=2");
  });
});

describe("post validators", () => {
  const ok = { ...emptyPost, kind: "SELL" as const, category: "vehicles", title: "Good bike", description: "A very good bike for sale", price: "50", postcode: "SA1 1AA", whatsapp: "07700 900123", legalAcknowledged: true };
  it("step 0 to 3", () => {
    expect(validatePostStep(0, emptyPost).kind).toBeTruthy();
    expect(validatePostStep(1, emptyPost).category).toBeTruthy();
    expect(validatePostStep(2, ok)).toEqual({});
    expect(validatePostStep(3, { ...ok, legalAcknowledged: false }).legalAcknowledged).toBeTruthy();
    expect(validatePostStep(3, ok)).toEqual({});
  });
  it("price rules", () => {
    expect(validatePostStep(2, { ...ok, price: "" }).price).toBeTruthy();
    expect(validatePostStep(2, { ...ok, price: "12.505" }).price).toBeTruthy();
    expect(validatePostStep(2, { ...ok, kind: "GIVEAWAY", price: "" }).price).toBeUndefined();
  });
  it("images", () => {
    expect(validatePostStep(2, ok, [{ size: 1, type: "image/gif" }]).images).toBeTruthy();
    expect(validatePostStep(2, ok, [{ size: 11 * 1024 * 1024, type: "image/png" }]).images).toBeTruthy();
    expect(validatePostStep(2, ok, Array(6).fill({ size: 1, type: "image/png" })).images).toBeTruthy();
  });
  it("giveaway sends no price", () => {
    const f = buildPostForm({ ...ok, kind: "GIVEAWAY", price: "5" }, []);
    expect(f.has("price")).toBe(false);
    expect(f.get("hideFullAddress")).toBe("true");
  });
});
