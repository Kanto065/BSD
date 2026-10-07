import { ZONES } from "@/lib/content";
import { descriptionStatus } from "@/lib/description";
import type { CategoryOption } from "@/lib/taxonomy";

// The saved business details of a member, and the pure rules the Submit stepper and the details page share. The
// browser checks what it can for quick feedback, and the API checks everything again.

export type Errors = Record<string, string>;

/** The select value for the "Others" option. It is never sent to the server as a category. */
export const OTHERS = "__others";
export const CUSTOM_CATEGORY_MAX = 60;

export const STEP_TITLES = ["Business information", "Contact details", "Location", "Additional information", "Photos, consents and review"] as const;
export const LAST_STEP = STEP_TITLES.length - 1;

/** What the form holds. `services` is the raw textarea (one per line) and `categorySlug` can be OTHERS. */
export type FormValues = {
  name: string;
  categorySlug: string;
  customCategory: string;
  subcategory: string;
  description: string;
  services: string;
  ownerName: string;
  phone: string;
  whatsapp: string;
  email: string;
  showEmail: boolean;
  website: string;
  address: string;
  hideFullAddress: boolean;
  postcode: string;
  serveZones: string[];
  localities: string[];
  othersChecked: boolean;
  otherAreaText: string;
  openingHours: string;
  specialNotes: string;
};

export const emptyValues: FormValues = {
  name: "",
  categorySlug: "",
  customCategory: "",
  subcategory: "",
  description: "",
  services: "",
  ownerName: "",
  phone: "",
  whatsapp: "",
  email: "",
  showEmail: false,
  website: "",
  address: "",
  hideFullAddress: false,
  postcode: "",
  serveZones: [],
  localities: [],
  othersChecked: false,
  otherAreaText: "",
  openingHours: "",
  specialNotes: "",
};

const str = (v: unknown) => (typeof v === "string" ? v : undefined);
const strList = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : undefined);

/** Lays what is saved on the account over the defaults. Unknown keys and wrong types are ignored. */
export function mergeProfile(defaults: FormValues, saved: Record<string, unknown> | null | undefined): FormValues {
  const s = saved ?? {};
  const out: FormValues = { ...defaults };
  out.name = str(s.name) ?? out.name;
  out.customCategory = str(s.customCategory) ?? out.customCategory;
  out.categorySlug = str(s.categorySlug) ?? out.categorySlug;
  if (!out.categorySlug && out.customCategory) out.categorySlug = OTHERS;
  out.subcategory = str(s.subcategorySlug) ?? out.subcategory;
  out.description = str(s.description) ?? out.description;
  const services = strList(s.servicesOffered);
  if (services) out.services = services.join("\n");
  out.ownerName = str(s.ownerName) ?? out.ownerName;
  out.phone = str(s.phone) ?? out.phone;
  out.whatsapp = str(s.whatsapp) ?? out.whatsapp;
  out.email = str(s.email) ?? out.email;
  if (typeof s.showEmail === "boolean") out.showEmail = s.showEmail;
  out.website = str(s.websiteOrSocial) ?? out.website;
  out.address = str(s.address) ?? out.address;
  if (typeof s.hideFullAddress === "boolean") out.hideFullAddress = s.hideFullAddress;
  out.postcode = str(s.postcode) ?? out.postcode;
  out.serveZones = strList(s.serveZones) ?? out.serveZones;
  out.localities = strList(s.localities) ?? out.localities;
  const other = str(s.otherAreaText);
  if (other !== undefined) {
    out.otherAreaText = other;
    out.othersChecked = other.trim().length > 0;
  }
  out.openingHours = str(s.openingHours) ?? out.openingHours;
  out.specialNotes = str(s.specialNotes) ?? out.specialNotes;
  return out;
}

export const serviceList = (services: string) =>
  services
    .split("\n")
    .map((s) => s.replace(/^[\s•*-]+/, "").trim())
    .filter(Boolean);

/** The client's wording for the checkbox on Submit, the owner edit and the admin edit. Do not reword. */
export const HIDE_ADDRESS_LABEL = 'Hide Full Address (Show Postcode Area/Neighborhood Only - e.g., "Manselton, SA5")';

/**
 * What the business page Location block shows. A listing that hides its address (areaLabel is set by the API) prints
 * "Location: Manselton, SA5" and has no street, no full postcode, no map link and only the district in JSON-LD.
 */
export function locationView(b: { name: string; address: string | null; postcode: string | null; postcodeDistrict: string; areaLabel?: string | null }) {
  const area = b.areaLabel ?? (b.postcode ? null : b.postcodeDistrict);
  if (area) return { hidden: true as const, area, street: null, postcode: null, postalCode: b.postcodeDistrict, streetAddress: null, mapUrl: null };
  const mapUrl = b.postcode ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([b.name, b.address, b.postcode].filter(Boolean).join(", "))}` : null;
  return { hidden: false as const, area: null, street: b.address, postcode: b.postcode ?? b.postcodeDistrict, postalCode: b.postcode ?? b.postcodeDistrict, streetAddress: b.postcode && b.address ? b.address : null, mapUrl };
}

/** The body of PUT /auth/business-profile. Blank fields are left out. */
export function toProfileData(v: FormValues): Record<string, string | boolean | string[]> {
  const out: Record<string, string | boolean | string[]> = {};
  const put = (key: string, value: string) => {
    if (value.trim()) out[key] = value.trim();
  };
  put("name", v.name);
  if (v.categorySlug === OTHERS) put("customCategory", v.customCategory);
  else put("categorySlug", v.categorySlug);
  put("subcategorySlug", v.subcategory);
  put("description", v.description);
  const services = serviceList(v.services);
  if (services.length) out.servicesOffered = services.slice(0, 15);
  put("ownerName", v.ownerName);
  put("phone", v.phone);
  put("whatsapp", v.whatsapp);
  put("email", v.email);
  if (v.email.trim()) out.showEmail = v.showEmail;
  put("websiteOrSocial", v.website);
  put("address", v.address);
  if (v.hideFullAddress) out.hideFullAddress = true;
  put("postcode", v.postcode);
  if (v.serveZones.length) out.serveZones = v.serveZones;
  if (v.localities.length) out.localities = v.localities;
  if (v.othersChecked) put("otherAreaText", v.otherAreaText);
  put("openingHours", v.openingHours);
  put("specialNotes", v.specialNotes);
  return out;
}

/** True when the saved details hold anything a person typed. The email switch alone does not count. */
export function profileHasData(data: Record<string, unknown> | null | undefined): boolean {
  return Object.entries(data ?? {}).some(([key, v]) => {
    if (key === "showEmail" || key === "hideFullAddress") return false;
    if (typeof v === "string") return v.trim().length > 0;
    if (Array.isArray(v)) return v.length > 0;
    return false;
  });
}

// Which step holds each field, in the order of the stepper.
const FIELD_STEP: Record<string, number> = {
  name: 0, category: 0, customCategory: 0, subcategory: 0, description: 0, servicesOffered: 0,
  ownerName: 1, phone: 1, whatsapp: 1, email: 1, websiteOrSocial: 1,
  address: 2, hideFullAddress: 2, postcode: 2, serveZones: 2, localities: 2, otherAreaText: 2,
  openingHours: 3, specialNotes: 3,
};

/** The step to show for a set of errors: the first step that has one. Fields not listed (photos, consents) are on the last step. */
export function stepForErrors(errors: Errors): number {
  const steps = Object.entries(errors)
    .filter(([, message]) => message)
    .map(([key]) => FIELD_STEP[key] ?? LAST_STEP);
  return steps.length ? Math.min(...steps) : 0;
}

/** Mirrors the API's postcode rule: a full UK postcode whose outward code is in one of the three zones. */
export function zoneForPostcode(input: string): { zone?: (typeof ZONES)[number]; problem?: string } | null {
  const cleaned = input.replace(/\s+/g, "").toUpperCase();
  if (!cleaned) return null;
  const outward = cleaned.slice(0, -3);
  if (cleaned.length < 5 || !/^[A-Z]{1,2}\d[A-Z\d]?$/.test(outward) || !/^\d[A-Z]{2}$/.test(cleaned.slice(-3))) {
    return { problem: "Enter a full UK postcode, for example SA1 4PE." };
  }
  const zone = ZONES.find((z) => z.districts.includes(outward));
  return zone ? { zone } : { problem: "That postcode is outside the BSD coverage area (SA1 to SA20 and SA31 to SA34)." };
}

const validPhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return /^[+()\d\s-]+$/.test(value.trim()) && digits.length >= 10 && digits.length <= 15;
};

/** The checks for one of the four field steps (0 to 3), with the same messages the form always had. */
export function validateStep(step: number, v: FormValues, categories: CategoryOption[]): Errors {
  const e: Errors = {};
  if (step === 0) {
    if (v.name.trim().length < 2) e.name = "Enter the business or service name.";
    if (v.categorySlug === OTHERS) {
      if (v.customCategory.trim().length < 2) e.customCategory = "Type the category you need.";
    } else if (!categories.some((c) => c.slug === v.categorySlug)) e.category = "Choose a category.";
    const desc = descriptionStatus(v.description);
    if (!desc.ok) e.description = desc.message;
    const list = serviceList(v.services);
    if (!list.length) e.servicesOffered = "List at least one service.";
    if (list.length > 15) e.servicesOffered = "List up to 15 services.";
  }
  if (step === 1) {
    const category = categories.find((c) => c.slug === v.categorySlug);
    if (category?.requiresOwnerName && !v.ownerName.trim()) e.ownerName = "This category needs the owner or service provider name.";
    if (!validPhone(v.phone)) e.phone = "Enter a valid phone number.";
    if (v.whatsapp.trim() && !validPhone(v.whatsapp)) e.whatsapp = "Enter a valid phone number.";
    if (v.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) e.email = "Enter a valid email address.";
  }
  if (step === 2) {
    const check = zoneForPostcode(v.postcode);
    if (!v.postcode.trim()) e.postcode = "Enter the postcode.";
    else if (check?.problem) e.postcode = check.problem;
    const other = v.othersChecked ? v.otherAreaText.trim() : "";
    if (!v.serveZones.length && !v.localities.length && !other) e.serveZones = "Choose at least one area you serve, or describe it under Others.";
  }
  return e;
}
