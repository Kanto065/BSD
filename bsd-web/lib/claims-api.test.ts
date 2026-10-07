import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { CLAIM_CONSENT, claimProblem, claimStatusText } from "./claims-api";

const read = (p: string) => readFileSync(path.resolve(__dirname, "..", p), "utf8");

describe("claim words and checks", () => {
  it("uses the plain status words", () => {
    expect(claimStatusText({ status: "PENDING", linkedOwner: false })).toBe("Waiting for review");
    expect(claimStatusText({ status: "REJECTED", linkedOwner: false })).toBe("Not approved");
    expect(claimStatusText({ status: "APPROVED", linkedOwner: true })).toBe("Approved, this listing is now in your account");
    expect(claimStatusText({ status: "APPROVED", linkedOwner: false })).toBe("Approved");
  });

  it("explains short text, long text and a bad file, and accepts text alone", () => {
    expect(claimProblem("short", null)?.proofText).toMatch(/at least 20/);
    expect(claimProblem("x".repeat(1001), null)?.proofText).toMatch(/1000/);
    const ok = "I can send a utility bill for this shop.";
    expect(claimProblem(ok, null)).toBeNull();
    expect(claimProblem(ok, { type: "application/pdf", size: 10 })).toBeNull();
    expect(claimProblem(ok, { type: "text/html", size: 10 })?.file).toMatch(/JPG, PNG, WebP or PDF/);
    expect(claimProblem(ok, { type: "image/png", size: 6 * 1024 * 1024 })?.file).toMatch(/5 MB/);
  });

  it("keeps the consent line in the form and the plain sign in link", () => {
    expect(CLAIM_CONSENT).toBe("I agree that BSD can look at this file to check that I own this business. The file is deleted within 24 hours after the decision.");
    const form = read("components/ListingRequests.tsx");
    expect(form).toContain("CLAIM_CONSENT");
    expect(form).toContain("CLAIM_SIGN_IN");
    expect(form).toContain('href="/account"');
  });

  it("keeps 16px inputs and 44px targets on the claim form, MyClaims and the admin claims page", () => {
    const form = read("components/ListingRequests.tsx");
    expect(form).toMatch(/text-base[^"]*sm:text-sm/);
    expect(form.match(/min-h-11/g)!.length).toBeGreaterThanOrEqual(4);
    const mine = read("components/MyClaims.tsx");
    expect(mine).toContain("min-h-11");
    const admin = read("app/(bsd)/admin/claims/page.tsx");
    expect(admin).toContain('inputClass.replace("text-sm", "text-base sm:text-sm")');
    expect(admin.match(/min-h-\[44px\]/g)!.length).toBeGreaterThanOrEqual(4);
  });
});
