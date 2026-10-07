"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import AccountForm from "@/components/AccountForm";
import { CONSENTS, IMAGE_TYPES, MAX_FILE_BYTES, MAX_PHOTOS, StepAdditional, StepBusiness, StepContact, StepLocation, StepPhotosConsents } from "@/components/BusinessFields";
import Stepper, { StepButtons } from "@/components/Stepper";
import {
  LAST_STEP,
  OTHERS,
  STEP_TITLES,
  emptyValues,
  mergeProfile,
  profileHasData,
  serviceList,
  stepForErrors,
  toProfileData,
  validateStep,
  type Errors,
  type FormValues,
} from "@/lib/business-profile";
import { ApiError } from "@/lib/admin-session";
import { clearBusinessProfile, getBusinessProfile, memberCall, saveBusinessProfile } from "@/lib/member-api";
import type { CategoryOption } from "@/lib/taxonomy";

// The listing form, built from the client's Submission Form doc: every field, the six consent boxes worded exactly,
// and the exact confirmation message. Signing in comes first (the API refuses a listing without a session). The form
// is five steps, and the details are saved to the account on every Next so they are typed only once. The browser checks
// what it can so people get quick feedback, and the API checks everything again.

export const CONFIRMATION_MESSAGE =
  "Thank you! Your listing has been submitted for review. BSD Team will verify and publish it within 3–7 days.";

type Auth = "checking" | "out" | "in";
type SaveState = "idle" | "saved" | "failed";

export default function SubmitForm({ apiBase, categories }: { apiBase: string; categories: CategoryOption[] }) {
  const [auth, setAuth] = useState<Auth>("checking");
  // The account phone is the starting value for the contact step. A saved business phone replaces it.
  const [accountPhone, setAccountPhone] = useState("");

  useEffect(() => {
    memberCall(apiBase, "me")
      .then((r) => {
        setAccountPhone(r.user?.phone ?? "");
        setAuth(r.user ? "in" : "out");
      })
      .catch(() => setAuth("out"));
  }, [apiBase]);

  if (auth === "checking") {
    return <div aria-busy="true" className="h-64 animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none" />;
  }
  if (auth === "out") {
    return (
      <section className="rounded-2xl border border-slate-200 p-5 shadow-[0_1px_2px_rgba(12,46,66,0.05)] sm:p-8">
        <h2 className="font-heading text-xl font-bold text-brand-navy">Sign in or create an account to submit your listing</h2>
        <p className="mt-2 text-slate-600">It takes a minute, and your details are saved so you only type them once.</p>
        <div className="mt-6 max-w-md">
          <AccountForm apiBase={apiBase} compact onSignedIn={(u) => {
              setAccountPhone(u.phone ?? "");
              setAuth("in");
            }} />
        </div>
      </section>
    );
  }
  return <ListingStepper apiBase={apiBase} categories={categories} accountPhone={accountPhone} onSignedOut={() => setAuth("out")} />;
}

function ListingStepper({ apiBase, categories, accountPhone, onSignedOut }: { apiBase: string; categories: CategoryOption[]; accountPhone: string; onSignedOut: () => void }) {
  const [values, setValues] = useState<FormValues>({ ...emptyValues, phone: accountPhone });
  const [step, setStep] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [restored, setRestored] = useState(false);
  const [save, setSave] = useState<SaveState>("idle");
  const [logo, setLogo] = useState<File | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [consents, setConsents] = useState<Record<string, boolean>>({});
  const [honeypot, setHoneypot] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [formError, setFormError] = useState("");
  const summaryRef = useRef<HTMLDivElement>(null);
  const stepRef = useRef<HTMLDivElement>(null);
  const moved = useRef(false);

  const set = (patch: Partial<FormValues>) => setValues((v) => ({ ...v, ...patch }));

  // Fill the form from the saved details and resume at the saved step.
  useEffect(() => {
    getBusinessProfile(apiBase)
      .then((p) => {
        setValues((v) => mergeProfile(v, p.data));
        setRestored(profileHasData(p.data));
        setStep(Math.min(Math.max(p.step, 0), LAST_STEP));
      })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, [apiBase]);

  // After Next or Back, move keyboard focus to the new step. Not on the first render.
  useEffect(() => {
    if (!moved.current) return;
    stepRef.current?.focus();
  }, [step]);

  async function persist(nextStep: number, v: FormValues = values) {
    try {
      await saveBusinessProfile(apiBase, toProfileData(v), nextStep);
      setSave("saved");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onSignedOut();
      setSave("failed");
    }
  }

  const focusFirstError = (found: Errors) =>
    requestAnimationFrame(() => {
      const first = Object.keys(found).find((k) => found[k]);
      const el = first ? document.getElementById(first) : null;
      if (el) el.focus();
      else summaryRef.current?.focus();
    });

  function go(to: number) {
    moved.current = true;
    setErrors({});
    setFormError("");
    setStep(to);
  }

  function next() {
    const found = validateStep(step, values, categories);
    if (Object.values(found).some(Boolean)) {
      setErrors(found);
      focusFirstError(found);
      return;
    }
    void persist(step + 1);
    go(step + 1);
  }

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
    const nextList = [...photos, ...ok].slice(0, MAX_PHOTOS);
    if (photos.length + ok.length > MAX_PHOTOS) problems.push(`Upload up to ${MAX_PHOTOS} photos.`);
    setErrors((e) => ({ ...e, photos: problems.join(" ") }));
    setPhotos(nextList);
  }

  async function startBlank() {
    try {
      await clearBusinessProfile(apiBase);
    } catch {
      /* the form is cleared either way, the next Next saves over it */
    }
    setValues(emptyValues);
    setRestored(false);
    setSave("idle");
    go(0);
  }

  async function submitListing() {
    setFormError("");
    const found: Errors = {};
    for (const s of [0, 1, 2, 3]) Object.assign(found, validateStep(s, values, categories));
    for (const c of CONSENTS) if (!consents[c.name]) found[c.name] = "Please tick this box to continue.";
    if (Object.values(found).some(Boolean)) {
      setErrors(found);
      const target = stepForErrors(found);
      if (target !== step) go(target);
      setErrors(found);
      focusFirstError(found);
      return;
    }
    setErrors({});
    setStatus("sending");
    void persist(LAST_STEP);

    const v = values;
    const data = new FormData();
    data.set("name", v.name.trim());
    if (v.categorySlug === OTHERS) data.set("customCategory", v.customCategory.trim());
    else data.set("category", v.categorySlug);
    if (v.subcategory) data.set("subcategory", v.subcategory);
    data.set("description", v.description.trim());
    for (const s of serviceList(v.services)) data.append("servicesOffered", s);
    if (v.ownerName.trim()) data.set("ownerName", v.ownerName.trim());
    data.set("phone", v.phone.trim());
    if (v.whatsapp.trim()) data.set("whatsapp", v.whatsapp.trim());
    if (v.email.trim()) {
      data.set("email", v.email.trim());
      data.set("showEmail", String(v.showEmail));
    }
    if (v.website.trim()) data.set("websiteOrSocial", v.website.trim());
    if (v.address.trim()) data.set("address", v.address.trim());
    data.set("postcode", v.postcode.trim());
    for (const z of v.serveZones) data.append("serveZones", z);
    for (const l of v.localities) data.append("localities", l);
    if (v.othersChecked && v.otherAreaText.trim()) data.set("otherAreaText", v.otherAreaText.trim());
    if (v.openingHours.trim()) data.set("openingHours", v.openingHours.trim());
    if (v.specialNotes.trim()) data.set("specialNotes", v.specialNotes.trim());
    for (const c of CONSENTS) data.set(c.name, "true");
    if (honeypot) data.set("companyWebsite", honeypot);
    if (logo) data.append("logo", logo);
    for (const p of photos) data.append("photos", p);

    try {
      const res = await fetch(`${apiBase}/businesses/submit`, { method: "POST", body: data, credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatus("done");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      setStatus("idle");
      if (res.status === 401) onSignedOut();
      else if (res.status === 429) setFormError(body.ok === false && typeof body.error === "string" ? body.error : "You have sent several listings in a short time. Please try again in an hour.");
      else if (body.fieldErrors && Object.keys(body.fieldErrors).length) {
        setErrors(body.fieldErrors);
        go(stepForErrors(body.fieldErrors));
        setErrors(body.fieldErrors);
        focusFirstError(body.fieldErrors);
      } else setFormError("Something went wrong on our side. Please try again in a few minutes.");
    } catch {
      setStatus("idle");
      setFormError("We could not reach the server. Please check your connection and try again.");
    }
  }

  if (status === "done") {
    return (
      <div role="status" className="rounded-xl border border-green-200 bg-green-50 p-8 text-center motion-safe:animate-swap-in">
        <CheckCircle2 className="mx-auto h-10 w-10 text-green-700" aria-hidden="true" />
        <p className="mt-4 text-lg font-semibold text-green-900">{CONFIRMATION_MESSAGE}</p>
        <Link href="/account/listings" className="mt-6 inline-flex min-h-11 items-center rounded-md border border-green-700 px-6 text-base font-semibold text-green-900 hover:bg-green-100">
          View your listings
        </Link>
      </div>
    );
  }

  if (!loaded) return <div aria-busy="true" className="h-64 animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none" />;

  const errorList = Object.entries(errors).filter(([, v]) => v);
  const common = { v: values, set, errors };

  return (
    <form
      noValidate
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        if (step < LAST_STEP) next();
        else void submitListing();
      }}
    >
      <Stepper steps={STEP_TITLES} current={step} />

      {restored && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-brand-blue/30 bg-blue-50 p-4 text-sm text-brand-navy">
          <p className="flex-1">We filled this in from your saved details. Check it and change anything that is out of date.</p>
          <button type="button" onClick={startBlank} className="min-h-11 rounded-md border border-slate-300 bg-white px-4 font-semibold hover:border-brand-blue">
            Start with blank details
          </button>
        </div>
      )}

      {(errorList.length > 0 || formError) && (
        <div ref={summaryRef} tabIndex={-1} role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 focus:outline-none motion-safe:animate-swap-in">
          {formError ? (
            <p className="font-semibold">{formError}</p>
          ) : (
            <>
              <p className="font-semibold">Please check {errorList.length === 1 ? "this field" : `these ${errorList.length} fields`}.</p>
              <ul className="mt-2 list-disc pl-5">
                {errorList.map(([key, message]) => (
                  <li key={key}>{message}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <div ref={stepRef} tabIndex={-1} className="space-y-8 focus:outline-none">
        {step === 0 && <StepBusiness {...common} categories={categories} />}
        {step === 1 && <StepContact {...common} categories={categories} />}
        {step === 2 && <StepLocation {...common} />}
        {step === 3 && <StepAdditional v={values} set={set} />}
        {step === 4 && (
          <StepPhotosConsents
            logo={logo}
            photos={photos}
            onLogo={onLogo}
            onPhotos={onPhotos}
            removeLogo={() => setLogo(null)}
            removePhoto={(i) => setPhotos(photos.filter((_, j) => j !== i))}
            consents={consents}
            setConsents={setConsents}
            errors={errors}
          />
        )}
      </div>

      {/* Hidden from people. Automated spam fills it in, and those submissions are dropped. */}
      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label htmlFor="companyWebsite">Company website</label>
        <input id="companyWebsite" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <StepButtons step={step} last={LAST_STEP} onBack={() => go(step - 1)} onNext={next} />
          {step === LAST_STEP && (
            <button
              type="submit"
              disabled={status === "sending"}
              className="press inline-flex min-h-11 items-center gap-2 rounded-md bg-green-700 px-8 py-3 text-base font-semibold text-white hover:bg-green-800 disabled:opacity-70"
            >
              {status === "sending" && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
              {status === "sending" ? "Submitting..." : "Submit My Listing"}
            </button>
          )}
        </div>
        <p aria-live="polite" className="min-h-5 text-sm text-slate-600">
          {save === "saved" && "Saved"}
          {save === "failed" && "Could not save your progress. Your answers are still on this page."}
        </p>
      </div>
    </form>
  );
}
