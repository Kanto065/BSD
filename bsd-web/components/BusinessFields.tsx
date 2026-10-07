"use client";

import { useMemo } from "react";
import { ImagePlus, MapPin, X } from "lucide-react";
import { ZONES, zoneLabel, zoneShortLabel } from "@/lib/content";
import { localitySlug } from "@/lib/slug";
import { descriptionStatus } from "@/lib/description";
import { allZonesState, toggleAllZones } from "@/lib/zones";
import { CUSTOM_CATEGORY_MAX, HIDE_ADDRESS_LABEL, OTHERS, zoneForPostcode, type Errors, type FormValues } from "@/lib/business-profile";
import type { CategoryOption } from "@/lib/taxonomy";
import { ServiceTagPicker } from "@/components/ServiceTagPicker";

// The listing form fields from the client's Submission Form doc, one component per step. Used by the Submit stepper and
// by the business details page, so the wording, help text and ids stay in one place. The client's text is unchanged.

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_PHOTOS = 4;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const TERMS = [
  { name: "consentAccurateInfo", label: "I confirm that all information provided is accurate and given voluntarily." },
  { name: "consentPublishPermission", label: "I give permission to publish this information on BSD (print + digital)." },
  { name: "consentNoLiability", label: "I understand that BSD is not responsible for any business transactions or disputes." },
  { name: "consentDataStorage", label: "I agree that my data will be stored securely and used only for directory purposes." },
];
export const GDPR = [
  { name: "gdprConsentStorage", label: "I consent to BSD storing my submitted information for directory publication." },
  { name: "gdprConsentRights", label: "I understand that I may request correction or removal of my listing at any time." },
];
export const CONSENTS = [...TERMS, ...GDPR];

export const SECTION_TITLES = {
  business: "Section 1: Business / Service Information",
  contact: "Section 2: Contact Details",
  location: "Section 3: Location Details",
  additional: "Section 4: Additional Information",
  terms: "Section 5: Consent & Legal Agreement",
  privacy: "Section 6: Privacy & GDPR Consent",
};

// 16px text on phones so iOS does not zoom into the field, and 44px tall for easy tapping.
export const inputClass =
  "mt-1 min-h-11 w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-brand-blue focus:outline-none sm:text-sm aria-[invalid=true]:border-red-600";
export const labelClass = "block text-sm font-semibold text-brand-navy";
export const helpClass = "mt-1 text-xs text-slate-500";
const checkRow = "flex min-h-11 cursor-pointer items-center gap-2 text-sm";

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={`${id}-error`} className="mt-1 text-sm font-medium text-red-700">
      {message}
    </p>
  );
}

export function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-2xl border border-slate-200 p-5 shadow-[0_1px_2px_rgba(12,46,66,0.05)] sm:p-6">
      {title && <legend className="px-2 font-heading text-lg font-bold text-brand-navy">{title}</legend>}
      <div className="space-y-5">{children}</div>
    </fieldset>
  );
}

const invalid = (errors: Errors, key: string) => (errors[key] ? { "aria-invalid": true, "aria-describedby": `${key}-error` } : {});

type StepProps = { v: FormValues; set: (patch: Partial<FormValues>) => void; errors: Errors; categories: CategoryOption[] };

const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

/** Step 1, Section 1: Business / Service Information. */
export function StepBusiness({ v, set, errors, categories }: StepProps) {
  const category = categories.find((c) => c.slug === v.categorySlug);
  const desc = descriptionStatus(v.description);
  return (
    <Section title={SECTION_TITLES.business}>
      <div>
        <label htmlFor="name" className={labelClass}>
          Business / Service Name
        </label>
        <p className={helpClass}>If this is a personal service, write your own name.</p>
        <input id="name" value={v.name} onChange={(e) => set({ name: e.target.value })} maxLength={120} className={inputClass} {...invalid(errors, "name")} />
        <FieldError id="name" message={errors.name} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="category" className={labelClass}>
            Category
          </label>
          <select
            id="category"
            value={v.categorySlug}
            onChange={(e) => set({ categorySlug: e.target.value, subcategory: "" })}
            className={`${inputClass} bg-white`}
            {...invalid(errors, "category")}
          >
            <option value="">Choose a category</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
            <option value={OTHERS}>Others (type your own)</option>
          </select>
          <FieldError id="category" message={errors.category} />
          {v.categorySlug === OTHERS && (
            <div className="mt-3">
              <label htmlFor="customCategory" className={labelClass}>
                Your category
              </label>
              <p className={helpClass}>Tell us what kind of business or service this is. We check new categories before they appear on the site.</p>
              <input
                id="customCategory"
                value={v.customCategory}
                onChange={(e) => set({ customCategory: e.target.value })}
                maxLength={CUSTOM_CATEGORY_MAX}
                className={inputClass}
                {...invalid(errors, "customCategory")}
              />
              <FieldError id="customCategory" message={errors.customCategory} />
            </div>
          )}
        </div>
        <div>
          <label htmlFor="subcategory" className={labelClass}>
            Subcategory <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <select
            id="subcategory"
            value={v.subcategory}
            onChange={(e) => set({ subcategory: e.target.value })}
            disabled={!category || category.subcategories.length === 0 || v.categorySlug === OTHERS}
            className={`${inputClass} bg-white disabled:bg-slate-50`}
            {...invalid(errors, "subcategory")}
          >
            <option value="">{category ? "Choose a subcategory" : "Choose a category first"}</option>
            {category?.subcategories.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
          <FieldError id="subcategory" message={errors.subcategory} />
        </div>
      </div>

      <div>
        <label htmlFor="description" className={labelClass}>
          Short Description (at least 150 characters)
        </label>
        <p className={helpClass}>A short introduction to your business or service.</p>
        <textarea
          id="description"
          rows={6}
          value={v.description}
          onChange={(e) => set({ description: e.target.value })}
          maxLength={2000}
          className={inputClass}
          {...invalid(errors, "description")}
        />
        <p className={`mt-1 text-xs font-medium ${desc.chars === 0 || desc.ok ? "text-slate-500" : "text-red-700"}`} aria-live="polite">
          {desc.counter}
        </p>
        <FieldError id="description" message={errors.description} />
      </div>

      <div>
        <label htmlFor="servicesOffered" className={labelClass}>
          Services Offered
        </label>
        <p className={helpClass}>One service per line.</p>
        <textarea
          id="servicesOffered"
          rows={4}
          value={v.services}
          onChange={(e) => set({ services: e.target.value })}
          placeholder={"Home delivery\nParty catering"}
          className={inputClass}
          {...invalid(errors, "servicesOffered")}
        />
        <ServiceTagPicker tags={category?.serviceTags ?? []} value={v.services} onChange={(services) => set({ services })} />
        <FieldError id="servicesOffered" message={errors.servicesOffered} />
      </div>
    </Section>
  );
}

/** Step 2, Section 2: Contact Details. */
export function StepContact({ v, set, errors, categories }: StepProps) {
  const ownerRequired = categories.find((c) => c.slug === v.categorySlug)?.requiresOwnerName ?? false;
  return (
    <Section title={SECTION_TITLES.contact}>
      <div>
        <label htmlFor="ownerName" className={labelClass}>
          Owner / Service Provider Name{" "}
          <span className="font-normal text-slate-500">{ownerRequired ? "(required for this category)" : "(optional)"}</span>
        </label>
        <p className={helpClass}>Required for personal services. It is not shown on your public listing.</p>
        <input id="ownerName" value={v.ownerName} onChange={(e) => set({ ownerName: e.target.value })} maxLength={120} className={inputClass} {...invalid(errors, "ownerName")} />
        <FieldError id="ownerName" message={errors.ownerName} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="phone" className={labelClass}>
            Phone Number
          </label>
          <p className={helpClass}>Will be publicly displayed.</p>
          <input id="phone" type="tel" autoComplete="tel" value={v.phone} onChange={(e) => set({ phone: e.target.value })} maxLength={25} className={inputClass} {...invalid(errors, "phone")} />
          <FieldError id="phone" message={errors.phone} />
        </div>
        <div>
          <label htmlFor="whatsapp" className={labelClass}>
            WhatsApp Number <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <p className={helpClass}>Will be publicly displayed.</p>
          <input id="whatsapp" type="tel" value={v.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} maxLength={25} className={inputClass} {...invalid(errors, "whatsapp")} />
          <FieldError id="whatsapp" message={errors.whatsapp} />
        </div>
      </div>
      <div>
        <label htmlFor="email" className={labelClass}>
          Email Address <span className="font-normal text-slate-500">(optional)</span>
        </label>
        <input id="email" type="email" autoComplete="email" value={v.email} onChange={(e) => set({ email: e.target.value })} maxLength={200} className={inputClass} {...invalid(errors, "email")} />
        <FieldError id="email" message={errors.email} />
        <label htmlFor="showEmail" className="mt-2 flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-brand-navy">
          <input id="showEmail" type="checkbox" checked={v.showEmail} onChange={(e) => set({ showEmail: e.target.checked })} className="h-5 w-5 shrink-0 accent-brand-blue" />
          Show my email address on my public listing
        </label>
        <p className={helpClass}>Leave this off to keep your email private. We will still use it to contact you.</p>
      </div>
      <div>
        <label htmlFor="websiteOrSocial" className={labelClass}>
          Website / Facebook Page / Social Media <span className="font-normal text-slate-500">(optional)</span>
        </label>
        <input id="websiteOrSocial" value={v.website} onChange={(e) => set({ website: e.target.value })} maxLength={300} className={inputClass} {...invalid(errors, "websiteOrSocial")} />
        <FieldError id="websiteOrSocial" message={errors.websiteOrSocial} />
      </div>
    </Section>
  );
}

/** Step 3, Section 3: Location Details. */
export function StepLocation({ v, set, errors }: Omit<StepProps, "categories">) {
  const postcodeCheck = useMemo(() => zoneForPostcode(v.postcode), [v.postcode]);
  const allZones = allZonesState(v.serveZones);
  return (
    <Section title={SECTION_TITLES.location}>
      <div className="grid gap-5 sm:grid-cols-[1fr_12rem]">
        <div>
          <label htmlFor="address" className={labelClass}>
            Address
          </label>
          <p className={helpClass}>If you have no office, write &quot;HomeBased&quot;.</p>
          <input id="address" autoComplete="street-address" value={v.address} onChange={(e) => set({ address: e.target.value })} maxLength={300} className={inputClass} {...invalid(errors, "address")} />
          <FieldError id="address" message={errors.address} />
          <label htmlFor="hideFullAddress" className="mt-2 flex min-h-11 cursor-pointer items-start gap-3 py-2 text-sm font-semibold text-brand-navy">
            <input id="hideFullAddress" type="checkbox" checked={v.hideFullAddress} onChange={(e) => set({ hideFullAddress: e.target.checked })} className="mt-0.5 h-5 w-5 shrink-0 accent-brand-blue" />
            {HIDE_ADDRESS_LABEL}
          </label>
        </div>
        <div>
          <label htmlFor="postcode" className={labelClass}>
            Postcode
          </label>
          <p className={helpClass}>For example SA1 4PE.</p>
          <input
            id="postcode"
            autoComplete="postal-code"
            value={v.postcode}
            onChange={(e) => set({ postcode: e.target.value })}
            maxLength={12}
            className={`${inputClass} uppercase`}
            {...invalid(errors, "postcode")}
          />
          <FieldError id="postcode" message={errors.postcode} />
        </div>
      </div>
      {postcodeCheck?.zone && (
        <p className="flex items-center gap-2 text-sm text-slate-700" aria-live="polite">
          <MapPin className="h-4 w-4 text-brand-teal" aria-hidden="true" />
          Your listing will be in <strong className="text-brand-navy">{zoneLabel(postcodeCheck.zone)}</strong>. For home-based
          services only the first part of the postcode is shown publicly.
        </p>
      )}

      <div>
        <p className={labelClass} id="areas-label">
          Areas you serve
        </p>
        <p className={helpClass}>Choose whole zones, specific areas, or both.</p>
        <div className="mt-3 space-y-3" role="group" aria-labelledby="areas-label" {...invalid(errors, "serveZones")}>
          <div className="rounded-lg border border-slate-200 px-3">
            <label className={`${checkRow} font-semibold text-brand-navy`}>
              <input
                type="checkbox"
                checked={allZones === "all"}
                ref={(el) => {
                  if (el) el.indeterminate = allZones === "some";
                }}
                onChange={() => set({ serveZones: toggleAllZones(v.serveZones) })}
                className="h-5 w-5 shrink-0 accent-brand-blue"
              />
              All Zones
            </label>
          </div>
          {ZONES.map((z) => {
            const slugs = z.localities.map(localitySlug);
            const chosen = v.localities.filter((l) => slugs.includes(l)).length;
            return (
              <div key={z.slug} className="rounded-lg border border-slate-200 px-3">
                <label className={`${checkRow} font-semibold text-brand-navy`}>
                  <input
                    type="checkbox"
                    checked={v.serveZones.includes(z.slug)}
                    onChange={() => set({ serveZones: toggle(v.serveZones, z.slug) })}
                    className="h-5 w-5 shrink-0 accent-brand-blue"
                  />
                  {zoneShortLabel(z)}
                </label>
                <details className="pb-2">
                  <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-brand-teal-dark">
                    Choose areas in Zone {z.number}
                    {chosen ? ` (${chosen} chosen)` : ""}
                  </summary>
                  <div className="mt-1 grid gap-x-3 sm:grid-cols-2 lg:grid-cols-3">
                    {z.localities.map((l) => {
                      const value = localitySlug(l);
                      return (
                        <label key={value} className={`${checkRow} text-slate-700`}>
                          <input
                            type="checkbox"
                            checked={v.localities.includes(value)}
                            onChange={() => set({ localities: toggle(v.localities, value) })}
                            className="h-5 w-5 shrink-0 accent-brand-blue"
                          />
                          {l}
                        </label>
                      );
                    })}
                  </div>
                </details>
              </div>
            );
          })}
          <div className="rounded-lg border border-slate-200 px-3 pb-2">
            <label className={`${checkRow} font-semibold text-brand-navy`}>
              <input type="checkbox" checked={v.othersChecked} onChange={(e) => set({ othersChecked: e.target.checked })} className="h-5 w-5 shrink-0 accent-brand-blue" />
              Others (Specify)
            </label>
            {v.othersChecked && (
              <input
                aria-label="Other areas you serve"
                value={v.otherAreaText}
                onChange={(e) => set({ otherAreaText: e.target.value })}
                maxLength={300}
                className={inputClass}
                {...invalid(errors, "otherAreaText")}
              />
            )}
          </div>
        </div>
        <FieldError id="serveZones" message={errors.serveZones} />
        <FieldError id="localities" message={errors.localities} />
        <FieldError id="otherAreaText" message={errors.otherAreaText} />
      </div>
    </Section>
  );
}

/** Step 4, Section 4: Additional Information (opening hours and special notes). */
export function StepAdditional({ v, set }: Omit<StepProps, "categories" | "errors">) {
  return (
    <Section title={SECTION_TITLES.additional}>
      <div>
        <label htmlFor="openingHours" className={labelClass}>
          Opening Hours <span className="font-normal text-slate-500">(optional)</span>
        </label>
        <textarea id="openingHours" rows={3} value={v.openingHours} onChange={(e) => set({ openingHours: e.target.value })} maxLength={500} className={inputClass} />
      </div>
      <div>
        <label htmlFor="specialNotes" className={labelClass}>
          Special Notes <span className="font-normal text-slate-500">(optional)</span>
        </label>
        <p className={helpClass}>For example: home-based, appointment only, emergency service, weekend service.</p>
        <textarea id="specialNotes" rows={3} value={v.specialNotes} onChange={(e) => set({ specialNotes: e.target.value })} maxLength={500} className={inputClass} />
      </div>
    </Section>
  );
}

export type PhotosProps = {
  logo: File | null;
  photos: File[];
  onLogo: (files: FileList | null) => void;
  onPhotos: (files: FileList | null) => void;
  removeLogo: () => void;
  removePhoto: (index: number) => void;
  consents: Record<string, boolean>;
  setConsents: (fn: (c: Record<string, boolean>) => Record<string, boolean>) => void;
  errors: Errors;
};

/** Step 5: the photo and logo upload, then Sections 5 and 6 (the six consent boxes). */
export function StepPhotosConsents({ logo, photos, onLogo, onPhotos, removeLogo, removePhoto, consents, setConsents, errors }: PhotosProps) {
  return (
    <>
      <Section>
        <div>
          <p className={labelClass}>
            Photo / Logo Upload <span className="font-normal text-slate-500">(optional but highly recommended)</span>
          </p>
          <p className={helpClass}>
            JPEG, PNG or WebP, up to 10 MB each. We keep the full picture quality and remove hidden location data from photos.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="logo" className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-brand-navy hover:border-brand-blue has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-blue">
                <ImagePlus className="h-4 w-4" aria-hidden="true" />
                {logo ? "Change logo" : "Add a logo"}
                <input id="logo" type="file" accept={IMAGE_TYPES.join(",")} className="sr-only" onChange={(e) => onLogo(e.target.files)} />
              </label>
              {logo && <Preview file={logo} onRemove={removeLogo} />}
              <FieldError id="logo" message={errors.logo} />
            </div>
            <div>
              <label
                htmlFor="photos"
                className={`inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-brand-navy has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-blue ${photos.length >= MAX_PHOTOS ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:border-brand-blue"}`}
              >
                <ImagePlus className="h-4 w-4" aria-hidden="true" />
                Add photos ({photos.length}/{MAX_PHOTOS})
                <input
                  id="photos"
                  type="file"
                  multiple
                  accept={IMAGE_TYPES.join(",")}
                  disabled={photos.length >= MAX_PHOTOS}
                  className="sr-only"
                  onChange={(e) => {
                    onPhotos(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {photos.map((p, i) => (
                  <Preview key={`${p.name}-${i}`} file={p} onRemove={() => removePhoto(i)} />
                ))}
              </div>
              <FieldError id="photos" message={errors.photos} />
            </div>
          </div>
        </div>
      </Section>

      <Section title={SECTION_TITLES.terms}>
        <p className="text-sm font-semibold text-slate-700">Terms & Conditions Agreement:</p>
        <Consents items={TERMS} consents={consents} setConsents={setConsents} errors={errors} />
      </Section>

      <Section title={SECTION_TITLES.privacy}>
        <Consents items={GDPR} consents={consents} setConsents={setConsents} errors={errors} />
      </Section>
    </>
  );
}

function Consents({
  items,
  consents,
  setConsents,
  errors,
}: {
  items: { name: string; label: string }[];
  consents: Record<string, boolean>;
  setConsents: PhotosProps["setConsents"];
  errors: Errors;
}) {
  return (
    <div className="space-y-3">
      {items.map((c) => (
        <div key={c.name}>
          <label className="flex min-h-11 items-start gap-3 py-1 text-sm text-slate-700">
            <input
              id={c.name}
              type="checkbox"
              name={c.name}
              checked={!!consents[c.name]}
              onChange={(e) => setConsents((prev) => ({ ...prev, [c.name]: e.target.checked }))}
              aria-invalid={errors[c.name] ? true : undefined}
              aria-describedby={errors[c.name] ? `${c.name}-error` : undefined}
              className="mt-0.5 h-5 w-5 shrink-0 accent-brand-blue"
            />
            {c.label}
          </label>
          <FieldError id={c.name} message={errors[c.name]} />
        </div>
      ))}
    </div>
  );
}

function Preview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  return (
    <div className="relative mt-2 overflow-hidden rounded-md border border-slate-200">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={`Preview of ${file.name}`} className="h-28 w-full object-cover" />
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${file.name}`}
        className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow hover:bg-white"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
