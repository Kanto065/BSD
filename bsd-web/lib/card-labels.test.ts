import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, it, expect } from "vitest";
import * as L from "./card-labels";
import { ClaimPanel } from "@/components/card/PassPanels";
import { OfferRow } from "@/components/card/PassOffers";

// The client and spec strings below are locked. Do not edit one to make the test pass, ask the PM first.
describe("locked Pass wording", () => {
  it("keeps the client and spec strings", () => {
    expect(L.CONSENT).toBe("I agree that shops I show my pass to can see my name, member ID and postcode area.");
    expect(L.MOVE_PASS).toBe("Move my pass to this phone");
    expect(L.OFFLINE).toBe("You are offline. Go online to show your pass.");
    expect(L.CLOCK_DRIFT).toBe("Check your phone clock.");
    expect(L.REVEAL).toBe("Reveal Instant Discount Code");
    expect(L.COPIED).toBe("Copied to Clipboard!");
    expect(L.CONFLICT).toBe("Your pass is open on another device.");
    expect(L.RESET_ASK).toBe("Ask the BSD team to reset your pass.");
    expect(L.SUSPENDED).toBe("This pass is suspended. Please contact the BSD team.");
  });

  it("keeps the merchant client strings", () => {
    expect(L.LIVE_CAMERA).toBe("Live Camera");
    expect(L.MANUAL_CODE).toBe("Manual Code");
    expect(L.CONFIRM_DISCOUNT).toBe("Confirm discount and complete");
    expect(L.SCAN_NEXT).toBe("Scan next customer");
    expect(L.ALREADY_SCANNED).toBe("Already scanned recently");
    expect(L.OFFER_CHIPS).toEqual({ PENDING: "Waiting for approval", ACTIVE: "Live", PAUSED: "Paused", REJECTED: "Not approved" });
  });

  it("has no em dash, en dash or connector colon in the merchant strings", () => {
    const all = [L.LIVE_CAMERA, L.MANUAL_CODE, L.CONFIRM_DISCOUNT, L.SCAN_NEXT, L.ALREADY_SCANNED, ...Object.values(L.OFFER_CHIPS), ...Object.values(L.MERCHANT_LABELS)];
    for (const s of all) {
      expect(s).not.toMatch(/[–—]/);
      expect(s).not.toContain(":");
    }
  });

  it("uses the consent line on the claim screen", () => {
    expect(renderToStaticMarkup(createElement(ClaimPanel, { busy: false, error: null, onClaim: () => undefined }))).toContain(L.CONSENT);
  });

  it("has no em dash or en dash anywhere", () => {
    const all = [L.CONSENT, L.MOVE_PASS, L.OFFLINE, L.CLOCK_DRIFT, L.REVEAL, L.COPIED, L.CONFLICT, L.RESET_ASK, L.SUSPENDED, ...Object.values(L.NEW_LABELS)];
    for (const s of all) expect(s).not.toMatch(/[–—]/);
  });
});

describe("Reveal button", () => {
  const p = (id?: string) => ({ slug: "s", name: "Shop", areaLabel: null, postcodeDistrict: "SA1", offer: { id, title: "10% off", percent: 10, terms: "Show your pass." } });
  const html = (id: string | undefined, canReveal = true) => renderToStaticMarkup(createElement(OfferRow, { p: p(id), apiBase: "x", device: "dddddddddddddddd", canReveal }));
  it("shows only when the offer has an id and the pass is ready", () => {
    expect(html("off1")).toContain(L.REVEAL);
    expect(html(undefined)).not.toContain(L.REVEAL);
    expect(html("off1", false)).not.toContain(L.REVEAL);
  });
});
