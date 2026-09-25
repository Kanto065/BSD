"use client";

import { useMemo, useRef, useState } from "react";
import { CheckCircle2, ImagePlus, Loader2, MapPin, X } from "lucide-react";
import { ZONES, zoneLabel } from "@/lib/content";
import { localitySlug } from "@/lib/slug";
import type { CategoryOption } from "@/lib/taxonomy";

// The listing form, built from the client's Submission Form doc: every field, the six consent boxes worded exactly,
// and the exact confirmation message. v2 changes: a required postcode that decides the zone, an optional WhatsApp
// number, and "Areas you serve" in place of the old town list. The browser checks what it can so people get quick
// feedback, and the API checks everything again.

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_PHOTOS = 4;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const TERMS = [
  { name: "consentAccurateInfo", label: "I confirm that all information provided is accurate and given voluntarily." },
  { name: "consentPublishPermission", label: "I give permission to publish this information on BSD (print + digital)." },
  { name: "consentNoLiability", label: "I understand that BSD is not responsible for any business transactions or disputes." },
  { name: "consentDataStorage", label: "I agree that my data will be stored securely and used only for directory purposes." },
];
const GDPR = [
  { name: "gdprConsentStorage", label: "I consent to BSD storing my submitted information for directory publication." },
  { name: "gdprConsentRights", label: "I understand that I may request correction or removal of my listing at any time." },
];
const CONSENTS = [...TERMS, ...GDPR];

export const CONFIRMATION_MESSAGE =
  "Thank you! Your listing has been submitted for review. BSD Team will verify and publish it within 3–7 days.";

const countWords = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** Mirrors the API's postcode rule: a full UK postcode whose outward code is in one of the three zones. */
function zoneForPostcode(input: string): { zone?: (typeof ZONES)[number]; problem?: string } | null {
  const cleaned = input.replace(/\s+/g, "").toUpperCase();
  if (!cleaned) return null;
  const outward = cleaned.slice(0, -3);
  if (cleaned.length < 5 || !/^[A-Z]{1,2}\d[A-Z\d]?$/.test(outward) || !/^\d[A-Z]{2}$/.test(cleaned.slice(-3))) {
    return { problem: "Enter a full UK postcode, for example SA1 4PE." };
  }
  const zone = ZONES.find((z) => z.districts.includes(outward));
  return zone ? { zone } : { problem: "That postcode is outside the BSD coverage area (SA1 to SA20 and SA31 to SA34)." };
}

type Errors = Record<string, string>;

const inputClass =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none aria-[invalid=true]:border-red-600";
const labelClass = "block text-sm font-semibold text-brand-navy";
const helpClass = "mt-1 text-xs text-slate-500";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={`${id}-error`} className="mt-1 text-sm font-medium text-red-700">
      {message}
    </p>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-xl border border-slate-200 p-5 sm:p-6">
      <legend className="px-2 font-heading text-lg font-bold text-brand-navy">{title}</legend>
      <div className="space-y-5">{children}</div>
    </fieldset>
  );
}

export default function SubmitForm({ apiBase, categories }: { apiBase: string; categories: CategoryOption[] }) {
  const [name, setName] = useState("");
  const [categorySlug, setCategorySlug] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [description, setDescription] = useState("");
  const [services, setServices] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");
  const [postcode, setPostcode] = useState("");
  const [serveZones, setServeZones] = useState<string[]>([]);
  const [localities, setLocalities] = useState<string[]>([]);
  const [othersChecked, setOthersChecked] = useState(false);
  const [otherAreaText, setOtherAreaText] = useState("");
  const [openingHours, setOpeningHours] = useState("");
  const [specialNotes, setSpecialNotes] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [consents, setConsents] = useState<Record<string, boolean>>({});
  const [honeypot, setHoneypot] = useState("");

  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [formError, setFormError] = useState("");
  const summaryRef = useRef<HTMLDivElement>(null);

  const category = categories.find((c) => c.slug === categorySlug);
  // Which categories need an owner name is set per category in the admin panel.
  const ownerRequired = category?.requiresOwnerName ?? false;
  const words = countWords(description);
  const postcodeCheck = useMemo(() => zoneForPostcode(postcode), [postcode]);
  const serviceList = services
    .split("\n")
    .map((s) => s.replace(/^[\s•*-]+/, "").trim())
    .filter(Boolean);

  const toggle = (list: string[], value: string, set: (v: string[]) => void) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  function checkImage(file: File): string | null {
    if (!IMAGE_TYPES.includes(file.type)) return `${file.name}: only JPEG, PNG and WebP images are accepted.`;
    if (file.size > MAX_FILE_BYTES) return `${file.name}: each image must be 10 MB or smaller.`;
    return null;
  }

  function onLogo(files: FileList | null) {
    const file = files?.[0] ?? null;
    const problem = file ? checkImage(file) : null;
    setErrors((e) => ({ ...e, logo: problem ?? "" }));
    setLogo(problem ? null : file);
  }

  function onPhotos(files: FileList | null) {
    const picked = Array.from(files ?? []);
    const problems = picked.map(checkImage).filter(Boolean) as string[];
    const ok = picked.filter((f) => !checkImage(f));
    const next = [...photos, ...ok].slice(0, MAX_PHOTOS);
    if (photos.length + ok.length > MAX_PHOTOS) problems.push(`Upload up to ${MAX_PHOTOS} photos.`);
    setErrors((e) => ({ ...e, photos: problems.join(" ") }));
    setPhotos(next);
  }

  function validate(): Errors {
    const e: Errors = {};
    if (name.trim().length < 2) e.name = "Enter the business or service name.";
    if (!category) e.category = "Choose a category.";
    if (words < 50 || words > 150) e.description = "The short description must be between 50 and 150 words.";
    if (!serviceList.length) e.servicesOffered = "List at least one service.";
    if (serviceList.length > 15) e.servicesOffered = "List up to 15 services.";
    if (ownerRequired && !ownerName.trim()) e.ownerName = "This category needs the owner or service provider name.";
    const digits = phone.replace(/\D/g, "");
    if (!/^[+()\d\s-]+$/.test(phone.trim()) || digits.length < 10 || digits.length > 15) e.phone = "Enter a valid phone number.";
    if (whatsapp.trim()) {
      const w = whatsapp.replace(/\D/g, "");
      if (!/^[+()\d\s-]+$/.test(whatsapp.trim()) || w.length < 10 || w.length > 15) e.whatsapp = "Enter a valid phone number.";
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = "Enter a valid email address.";
    if (!postcode.trim()) e.postcode = "Enter the postcode.";
    else if (postcodeCheck?.problem) e.postcode = postcodeCheck.problem;
    const other = othersChecked ? otherAreaText.trim() : "";
    if (!serveZones.length && !localities.length && !other) e.serveZones = "Choose at least one area you serve, or describe it under Others.";
    for (const c of CONSENTS) if (!consents[c.name]) e[c.name] = "Please tick this box to continue.";
    return e;
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");
    const found = validate();
    if (Object.values(found).some(Boolean)) {
      setErrors(found);
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    setErrors({});
    setStatus("sending");

    const data = new FormData();
    data.set("name", name.trim());
    data.set("category", categorySlug);
    if (subcategory) data.set("subcategory", subcategory);
    data.set("description", description.trim());
    for (const s of serviceList) data.append("servicesOffered", s);
    if (ownerName.trim()) data.set("ownerName", ownerName.trim());
    data.set("phone", phone.trim());
    if (whatsapp.trim()) data.set("whatsapp", whatsapp.trim());
    if (email.trim()) data.set("email", email.trim());
    if (website.trim()) data.set("websiteOrSocial", website.trim());
    if (address.trim()) data.set("address", address.trim());
    data.set("postcode", postcode.trim());
    for (const z of serveZones) data.append("serveZones", z);
    for (const l of localities) data.append("localities", l);
    if (othersChecked && otherAreaText.trim()) data.set("otherAreaText", otherAreaText.trim());
    if (openingHours.trim()) data.set("openingHours", openingHours.trim());
    if (specialNotes.trim()) data.set("specialNotes", specialNotes.trim());
    for (const c of CONSENTS) data.set(c.name, "true");
    if (honeypot) data.set("companyWebsite", honeypot);
    if (logo) data.append("logo", logo);
    for (const p of photos) data.append("photos", p);

    try {
      const res = await fetch(`${apiBase}/businesses/submit`, { method: "POST", body: data });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatus("done");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      setStatus("idle");
      if (res.status === 429) setFormError("You have sent several listings in a short time. Please try again in an hour.");
      else if (body.fieldErrors) {
        setErrors(body.fieldErrors);
        requestAnimationFrame(() => summaryRef.current?.focus());
      } else setFormError("Something went wrong on our side. Please try again in a few minutes.");
    } catch {
      setStatus("idle");
      setFormError("We could not reach the server. Please check your connection and try again.");
    }
  }

  if (status === "done") {
    return (
      <div role="status" className="rounded-xl border border-green-200 bg-green-50 p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-green-700" aria-hidden="true" />
        <p className="mt-4 text-lg font-semibold text-green-900">{CONFIRMATION_MESSAGE}</p>
      </div>
    );
  }

  const errorList = Object.entries(errors).filter(([, v]) => v);
  const invalid = (key: string) => (errors[key] ? { "aria-invalid": true, "aria-describedby": `${key}-error` } : {});

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-8">
      {(errorList.length > 0 || formError) && (
        <div ref={summaryRef} tabIndex={-1} role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 focus:outline-none">
          {formError ? (
            <p className="font-semibold">{formError}</p>
          ) : (
            <>
              <p className="font-semibold">Please check {errorList.length === 1 ? "this field" : `these ${errorList.length} fields`}:</p>
              <ul className="mt-2 list-disc pl-5">
                {errorList.map(([key, message]) => (
                  <li key={key}>{message}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <Section title="Section 1: Business / Service Information">
        <div>
          <label htmlFor="name" className={labelClass}>
            Business / Service Name
          </label>
          <p className={helpClass}>If this is a personal service, write your own name.</p>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className={inputClass} {...invalid("name")} />
          <FieldError id="name" message={errors.name} />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="category" className={labelClass}>
              Category
            </label>
            <select
              id="category"
              value={categorySlug}
              onChange={(e) => {
                setCategorySlug(e.target.value);
                setSubcategory("");
              }}
              className={`${inputClass} bg-white`}
              {...invalid("category")}
            >
              <option value="">Choose a category</option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
            <FieldError id="category" message={errors.category} />
          </div>
          <div>
            <label htmlFor="subcategory" className={labelClass}>
              Subcategory <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <select
              id="subcategory"
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              disabled={!category || category.subcategories.length === 0}
              className={`${inputClass} bg-white disabled:bg-slate-50`}
              {...invalid("subcategory")}
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
            Short Description (50–150 words)
          </label>
          <p className={helpClass}>A short introduction to your business or service.</p>
          <textarea
            id="description"
            rows={6}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            className={inputClass}
            {...invalid("description")}
          />
          <p className={`mt-1 text-xs font-medium ${words === 0 || (words >= 50 && words <= 150) ? "text-slate-500" : "text-red-700"}`} aria-live="polite">
            {words} {words === 1 ? "word" : "words"}
            {words > 0 && words < 50 ? `, at least ${50 - words} more needed` : ""}
            {words > 150 ? `, ${words - 150} over the limit` : ""}
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
            value={services}
            onChange={(e) => setServices(e.target.value)}
            placeholder={"Home delivery\nParty catering"}
            className={inputClass}
            {...invalid("servicesOffered")}
          />
          <FieldError id="servicesOffered" message={errors.servicesOffered} />
        </div>
      </Section>

      <Section title="Section 2: Contact Details">
        <div>
          <label htmlFor="ownerName" className={labelClass}>
            Owner / Service Provider Name{" "}
            <span className="font-normal text-slate-500">{ownerRequired ? "(required for this category)" : "(optional)"}</span>
          </label>
          <p className={helpClass}>Required for personal services. It is not shown on your public listing.</p>
          <input id="ownerName" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} maxLength={120} className={inputClass} {...invalid("ownerName")} />
          <FieldError id="ownerName" message={errors.ownerName} />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="phone" className={labelClass}>
              Phone Number
            </label>
            <p className={helpClass}>Will be publicly displayed.</p>
            <input id="phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={25} className={inputClass} {...invalid("phone")} />
            <FieldError id="phone" message={errors.phone} />
          </div>
          <div>
            <label htmlFor="whatsapp" className={labelClass}>
              WhatsApp Number <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <p className={helpClass}>Will be publicly displayed.</p>
            <input id="whatsapp" type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} maxLength={25} className={inputClass} {...invalid("whatsapp")} />
            <FieldError id="whatsapp" message={errors.whatsapp} />
          </div>
        </div>
        <div>
          <label htmlFor="email" className={labelClass}>
            Email Address <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <p className={helpClass}>Will be publicly displayed.</p>
          <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} className={inputClass} {...invalid("email")} />
          <FieldError id="email" message={errors.email} />
        </div>
        <div>
          <label htmlFor="websiteOrSocial" className={labelClass}>
            Website / Facebook Page / Social Media <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <input id="websiteOrSocial" value={website} onChange={(e) => setWebsite(e.target.value)} maxLength={300} className={inputClass} {...invalid("websiteOrSocial")} />
          <FieldError id="websiteOrSocial" message={errors.websiteOrSocial} />
        </div>
      </Section>

      <Section title="Section 3: Location Details">
        <div className="grid gap-5 sm:grid-cols-[1fr_12rem]">
          <div>
            <label htmlFor="address" className={labelClass}>
              Address
            </label>
            <p className={helpClass}>If you have no office, write &quot;HomeBased&quot;.</p>
            <input id="address" autoComplete="street-address" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} className={inputClass} {...invalid("address")} />
            <FieldError id="address" message={errors.address} />
          </div>
          <div>
            <label htmlFor="postcode" className={labelClass}>
              Postcode
            </label>
            <p className={helpClass}>For example SA1 4PE.</p>
            <input
              id="postcode"
              autoComplete="postal-code"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
              maxLength={12}
              className={`${inputClass} uppercase`}
              {...invalid("postcode")}
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
          <div className="mt-3 space-y-3" role="group" aria-labelledby="areas-label" {...invalid("serveZones")}>
            {ZONES.map((z) => (
              <div key={z.slug} className="rounded-lg border border-slate-200 p-3">
                <label className="flex items-start gap-2 text-sm font-semibold text-brand-navy">
                  <input
                    type="checkbox"
                    checked={serveZones.includes(z.slug)}
                    onChange={() => toggle(serveZones, z.slug, setServeZones)}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-brand-blue"
                  />
                  All of {zoneLabel(z)}
                </label>
                <details className="mt-2">
                  <summary className="cursor-pointer py-2 text-sm font-semibold text-brand-teal-dark">
                    Or choose areas in Zone {z.number}
                    {localities.some((l) => z.localities.map(localitySlug).includes(l))
                      ? ` (${localities.filter((l) => z.localities.map(localitySlug).includes(l)).length} chosen)`
                      : ""}
                  </summary>
                  <div className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                    {z.localities.map((l) => {
                      const value = localitySlug(l);
                      return (
                        <label key={value} className="flex items-center gap-2 py-1.5 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={localities.includes(value)}
                            onChange={() => toggle(localities, value, setLocalities)}
                            className="h-5 w-5 shrink-0 accent-brand-blue"
                          />
                          {l}
                        </label>
                      );
                    })}
                  </div>
                </details>
              </div>
            ))}
            <div className="rounded-lg border border-slate-200 p-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-brand-navy">
                <input type="checkbox" checked={othersChecked} onChange={(e) => setOthersChecked(e.target.checked)} className="h-5 w-5 shrink-0 accent-brand-blue" />
                Others (Specify)
              </label>
              {othersChecked && (
                <input
                  aria-label="Other areas you serve"
                  value={otherAreaText}
                  onChange={(e) => setOtherAreaText(e.target.value)}
                  maxLength={300}
                  className={inputClass}
                  {...invalid("otherAreaText")}
                />
              )}
            </div>
          </div>
          <FieldError id="serveZones" message={errors.serveZones} />
          <FieldError id="localities" message={errors.localities} />
          <FieldError id="otherAreaText" message={errors.otherAreaText} />
        </div>
      </Section>

      <Section title="Section 4: Additional Information">
        <div>
          <label htmlFor="openingHours" className={labelClass}>
            Opening Hours <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <textarea id="openingHours" rows={3} value={openingHours} onChange={(e) => setOpeningHours(e.target.value)} maxLength={500} className={inputClass} />
        </div>

        <div>
          <p className={labelClass}>
            Photo / Logo Upload <span className="font-normal text-slate-500">(optional but highly recommended)</span>
          </p>
          <p className={helpClass}>
            JPEG, PNG or WebP, up to 10 MB each. We keep the full picture quality and remove hidden location data from photos.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="logo" className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-brand-navy hover:border-brand-blue">
                <ImagePlus className="h-4 w-4" aria-hidden="true" />
                {logo ? "Change logo" : "Add a logo"}
              </label>
              <input id="logo" type="file" accept={IMAGE_TYPES.join(",")} className="sr-only" onChange={(e) => onLogo(e.target.files)} />
              {logo && <Preview file={logo} onRemove={() => setLogo(null)} />}
              <FieldError id="logo" message={errors.logo} />
            </div>
            <div>
              <label
                htmlFor="photos"
                className={`inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-brand-navy ${photos.length >= MAX_PHOTOS ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:border-brand-blue"}`}
              >
                <ImagePlus className="h-4 w-4" aria-hidden="true" />
                Add photos ({photos.length}/{MAX_PHOTOS})
              </label>
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
              <div className="mt-2 grid grid-cols-2 gap-2">
                {photos.map((p, i) => (
                  <Preview key={`${p.name}-${i}`} file={p} onRemove={() => setPhotos(photos.filter((_, j) => j !== i))} />
                ))}
              </div>
              <FieldError id="photos" message={errors.photos} />
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="specialNotes" className={labelClass}>
            Special Notes <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <p className={helpClass}>For example: home-based, appointment only, emergency service, weekend service.</p>
          <textarea id="specialNotes" rows={3} value={specialNotes} onChange={(e) => setSpecialNotes(e.target.value)} maxLength={500} className={inputClass} />
        </div>
      </Section>

      <Section title="Section 5: Consent & Legal Agreement">
        <p className="text-sm font-semibold text-slate-700">Terms & Conditions Agreement:</p>
        <Consents items={TERMS} consents={consents} setConsents={setConsents} errors={errors} />
      </Section>

      <Section title="Section 6: Privacy & GDPR Consent">
        <Consents items={GDPR} consents={consents} setConsents={setConsents} errors={errors} />
      </Section>

      {/* Hidden from people. Automated spam fills it in, and those submissions are dropped. */}
      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label htmlFor="companyWebsite">Company website</label>
        <input id="companyWebsite" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
      </div>

      <div>
        <button
          type="submit"
          disabled={status === "sending"}
          className="inline-flex items-center gap-2 rounded-md bg-green-700 px-8 py-3 text-base font-semibold text-white hover:bg-green-800 disabled:opacity-70"
        >
          {status === "sending" && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
          {status === "sending" ? "Submitting..." : "Submit My Listing"}
        </button>
      </div>
    </form>
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
  setConsents: (fn: (c: Record<string, boolean>) => Record<string, boolean>) => void;
  errors: Errors;
}) {
  return (
    <div className="space-y-3">
      {items.map((c) => (
        <div key={c.name}>
          <label className="flex items-start gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              name={c.name}
              checked={!!consents[c.name]}
              onChange={(e) => setConsents((prev) => ({ ...prev, [c.name]: e.target.checked }))}
              aria-invalid={errors[c.name] ? true : undefined}
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
        className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-slate-700 shadow hover:bg-white"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

