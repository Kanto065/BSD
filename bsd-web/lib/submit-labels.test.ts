import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { SECTION_TITLES, StepAdditional, StepBusiness, StepContact, StepLocation, StepPhotosConsents } from "@/components/BusinessFields";
import { emptyValues, OTHERS } from "./business-profile";
import type { CategoryOption } from "./taxonomy";

// The copy guard fetches /submit with no session, so it only sees the sign-in check now and no longer protects the
// form wording. This test does that job: every title, label, help text and consent below is copied from the client's
// Submission Form doc as it stood in the copy baseline before the stepper (R-08B). Do not edit a string here to make
// the test pass. A change to client wording needs the PM's approval first.

const categories: CategoryOption[] = [{ name: "Food", slug: "food", description: null, requiresOwnerName: false, subcategories: [{ name: "Tiffin", slug: "tiffin" }] }];
const noop = () => undefined;

// Plain text lines the way the copy snapshot reads them: inline tags join, block tags break.
function lines(html: string): string[] {
  return html
    .replace(/<!--.*?-->/g, "")
    .replace(/<\/?(span|strong|em|b|i|a)\b[^>]*>/g, "")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

const render = (el: React.ReactElement) => lines(renderToStaticMarkup(el));
const common = { v: emptyValues, set: noop, errors: {}, categories };

describe("client wording of the Submit form", () => {
  it("keeps the six section titles", () => {
    expect(SECTION_TITLES).toEqual({
      business: "Section 1: Business / Service Information",
      contact: "Section 2: Contact Details",
      location: "Section 3: Location Details",
      additional: "Section 4: Additional Information",
      terms: "Section 5: Consent & Legal Agreement",
      privacy: "Section 6: Privacy & GDPR Consent",
    });
  });

  it("Section 1 labels and help text", () => {
    const text = render(createElement(StepBusiness, { ...common, v: { ...emptyValues, categorySlug: OTHERS } }));
    for (const s of [
      "Section 1: Business / Service Information",
      "Business / Service Name",
      "If this is a personal service, write your own name.",
      "Category",
      "Choose a category",
      "Others (type your own)",
      "Your category",
      "Tell us what kind of business or service this is. We check new categories before they appear on the site.",
      "Subcategory (optional)",
      "Choose a category first",
      "Short Description (at least 150 characters)",
      "A short introduction to your business or service.",
      "0 of 150 characters minimum",
      "Services Offered",
      "One service per line.",
    ]) {
      expect(text, s).toContain(s);
    }
  });

  it("Section 2 labels and help text", () => {
    const text = render(createElement(StepContact, common));
    for (const s of [
      "Section 2: Contact Details",
      "Owner / Service Provider Name (optional)",
      "Required for personal services. It is not shown on your public listing.",
      "Phone Number",
      "Will be publicly displayed.",
      "WhatsApp Number (optional)",
      "Email Address (optional)",
      "Show my email address on my public listing",
      "Leave this off to keep your email private. We will still use it to contact you.",
      "Website / Facebook Page / Social Media (optional)",
    ]) {
      expect(text, s).toContain(s);
    }
    expect(text.filter((l) => l === "Will be publicly displayed.")).toHaveLength(2);
  });

  it("Section 3 labels, zones and help text", () => {
    const text = render(createElement(StepLocation, { v: emptyValues, set: noop, errors: {} }));
    for (const s of [
      "Section 3: Location Details",
      "Address",
      'If you have no office, write "HomeBased".',
      "Postcode",
      "For example SA1 4PE.",
      "Areas you serve",
      "Choose whole zones, specific areas, or both.",
      "All Zones",
      "Zone 1",
      "Choose areas in Zone 1",
      "Zone 2",
      "Choose areas in Zone 2",
      "Zone 3",
      "Choose areas in Zone 3",
      "Swansea City Centre",
      "Neath Town Centre",
      "Llanelli",
      "Others (Specify)",
    ]) {
      expect(text, s).toContain(s);
    }
  });

  it("Section 4 labels and help text", () => {
    const text = render(createElement(StepAdditional, { v: emptyValues, set: noop }));
    for (const s of [
      "Section 4: Additional Information",
      "Opening Hours (optional)",
      "Special Notes (optional)",
      "For example: home-based, appointment only, emergency service, weekend service.",
    ]) {
      expect(text, s).toContain(s);
    }
  });

  it("photo upload, Sections 5 and 6 and the six consent texts", () => {
    const text = render(
      createElement(StepPhotosConsents, { logo: null, photos: [], onLogo: noop, onPhotos: noop, removeLogo: noop, removePhoto: noop, consents: {}, setConsents: noop, errors: {} })
    );
    for (const s of [
      "Photo / Logo Upload (optional but highly recommended)",
      "JPEG, PNG or WebP, up to 10 MB each. We keep the full picture quality and remove hidden location data from photos.",
      "Add a logo",
      "Add photos (0/4)",
      "Section 5: Consent & Legal Agreement",
      "Terms & Conditions Agreement:",
      "I confirm that all information provided is accurate and given voluntarily.",
      "I give permission to publish this information on BSD (print + digital).",
      "I understand that BSD is not responsible for any business transactions or disputes.",
      "I agree that my data will be stored securely and used only for directory purposes.",
      "Section 6: Privacy & GDPR Consent",
      "I consent to BSD storing my submitted information for directory publication.",
      "I understand that I may request correction or removal of my listing at any time.",
    ]) {
      expect(text, s).toContain(s);
    }
  });
});
