import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, it, expect } from "vitest";
import * as L from "./card-labels";
import { ClaimPanel } from "@/components/card/PassPanels";

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

  it("uses the consent line on the claim screen", () => {
    expect(renderToStaticMarkup(createElement(ClaimPanel, { busy: false, error: null, onClaim: () => undefined }))).toContain(L.CONSENT);
  });

  it("has no em dash or en dash anywhere", () => {
    const all = [L.CONSENT, L.MOVE_PASS, L.OFFLINE, L.CLOCK_DRIFT, L.REVEAL, L.COPIED, L.CONFLICT, L.RESET_ASK, L.SUSPENDED, ...Object.values(L.NEW_LABELS)];
    for (const s of all) expect(s).not.toMatch(/[–—]/);
  });
});
