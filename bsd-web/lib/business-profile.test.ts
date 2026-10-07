import { describe, it, expect } from "vitest";
import { OTHERS, emptyValues, mergeProfile, profileHasData, serviceList, stepForErrors, toProfileData, validateStep, zoneForPostcode } from "./business-profile";
import type { CategoryOption } from "./taxonomy";

const categories: CategoryOption[] = [
  { name: "Food", slug: "food", description: null, requiresOwnerName: false, subcategories: [] },
  { name: "Personal", slug: "personal", description: null, requiresOwnerName: true, subcategories: [] },
];
const LONG = "x".repeat(150);

describe("mergeProfile", () => {
  it("keeps the defaults when nothing is saved", () => {
    expect(mergeProfile(emptyValues, null)).toEqual(emptyValues);
    expect(mergeProfile(emptyValues, {})).toEqual(emptyValues);
  });

  it("lets saved values win and maps the saved names to the form's", () => {
    const merged = mergeProfile(
      { ...emptyValues, phone: "default" },
      { name: "Rina", subcategorySlug: "cakes", servicesOffered: ["Bread", "Cakes"], websiteOrSocial: "rina.example", showEmail: true, otherAreaText: "Around Neath", localities: ["skewen"] }
    );
    expect(merged).toMatchObject({
      name: "Rina",
      subcategory: "cakes",
      services: "Bread\nCakes",
      website: "rina.example",
      showEmail: true,
      otherAreaText: "Around Neath",
      othersChecked: true,
      localities: ["skewen"],
      phone: "default",
    });
  });

  it("selects Others when a custom category was saved, and ignores unknown keys and wrong types", () => {
    expect(mergeProfile(emptyValues, { customCategory: "Henna", categorySlug: "" }).categorySlug).toBe(OTHERS);
    const merged = mergeProfile(emptyValues, { name: 5, serveZones: "zone-1", isAdmin: true, showEmail: "yes" });
    expect(merged).toEqual(emptyValues);
  });
});

describe("toProfileData", () => {
  it("leaves blanks out, trims, and drops the Others sentinel", () => {
    const data = toProfileData({ ...emptyValues, name: " Rina ", categorySlug: OTHERS, customCategory: "Henna", services: "- Bread\n\n* Cakes", email: "a@b.co", showEmail: true });
    expect(data).toEqual({ name: "Rina", customCategory: "Henna", servicesOffered: ["Bread", "Cakes"], email: "a@b.co", showEmail: true });
  });

  it("saves the email switch only with an email, and round trips through mergeProfile", () => {
    expect(toProfileData({ ...emptyValues, showEmail: true })).toEqual({});
    const v = { ...emptyValues, name: "N", categorySlug: "food", services: "A\nB", phone: "01792 123 456", othersChecked: true, otherAreaText: "Here" };
    expect(mergeProfile(emptyValues, toProfileData(v))).toEqual({ ...v });
  });
});

describe("profileHasData", () => {
  it("is false for nothing, for blanks and for the email switch alone", () => {
    expect(profileHasData(null)).toBe(false);
    expect(profileHasData({})).toBe(false);
    expect(profileHasData({ name: "  ", servicesOffered: [], showEmail: true })).toBe(false);
  });
  it("is true when a field has text or a list has items", () => {
    expect(profileHasData({ name: "Rina" })).toBe(true);
    expect(profileHasData({ serveZones: ["zone-1"] })).toBe(true);
  });
});

describe("stepForErrors", () => {
  it("returns the first step that holds an error", () => {
    expect(stepForErrors({})).toBe(0);
    expect(stepForErrors({ name: "" })).toBe(0);
    expect(stepForErrors({ phone: "Enter a valid phone number." })).toBe(1);
    expect(stepForErrors({ postcode: "x", phone: "y" })).toBe(1);
    expect(stepForErrors({ serveZones: "x" })).toBe(2);
    expect(stepForErrors({ openingHours: "x" })).toBe(3);
  });
  it("puts photos and consents on the last step", () => {
    expect(stepForErrors({ photos: "x" })).toBe(4);
    expect(stepForErrors({ consentAccurateInfo: "x" })).toBe(4);
    expect(stepForErrors({ consentAccurateInfo: "x", description: "y" })).toBe(0);
  });
});

describe("validateStep", () => {
  const good = { ...emptyValues, name: "Rina", categorySlug: "food", description: LONG, services: "Bread", phone: "01792 123 456", postcode: "SA1 4PE", serveZones: ["zone-1"] };
  it("accepts a complete form on every field step", () => {
    for (const step of [0, 1, 2, 3]) expect(validateStep(step, good, categories)).toEqual({});
  });
  it("reports step 1 problems with the original messages", () => {
    const e = validateStep(0, emptyValues, categories);
    expect(e).toEqual({
      name: "Enter the business or service name.",
      category: "Choose a category.",
      description: "The short description must be at least 150 characters.",
      servicesOffered: "List at least one service.",
    });
    expect(validateStep(0, { ...good, categorySlug: OTHERS, customCategory: "x" }, categories).customCategory).toBe("Type the category you need.");
  });
  it("needs the owner name when the category asks for it, and a valid phone", () => {
    expect(validateStep(1, { ...good, categorySlug: "personal" }, categories).ownerName).toBeTruthy();
    expect(validateStep(1, { ...good, phone: "12" }, categories).phone).toBe("Enter a valid phone number.");
    expect(validateStep(1, { ...good, email: "nope" }, categories).email).toBe("Enter a valid email address.");
  });
  it("checks the postcode and at least one area", () => {
    expect(validateStep(2, { ...good, postcode: "" }, categories).postcode).toBe("Enter the postcode.");
    expect(validateStep(2, { ...good, postcode: "SA25 1AA" }, categories).postcode).toMatch(/outside/);
    expect(validateStep(2, { ...good, serveZones: [] }, categories).serveZones).toBeTruthy();
    expect(validateStep(2, { ...good, serveZones: [], othersChecked: true, otherAreaText: "Here" }, categories)).toEqual({});
  });
});

describe("helpers", () => {
  it("splits services by line and strips bullets", () => expect(serviceList("• A\n\n- B \n")).toEqual(["A", "B"]));
  it("finds the zone for a postcode", () => {
    expect(zoneForPostcode("")).toBeNull();
    expect(zoneForPostcode("sa10 9aa")?.zone?.slug).toBe("zone-2");
    expect(zoneForPostcode("SA25 1AA")?.problem).toMatch(/outside/);
    expect(zoneForPostcode("hello")?.problem).toMatch(/full UK postcode/);
  });
});
