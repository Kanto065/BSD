"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { ApiError } from "@/lib/admin-session";
import { CLAIM_CONSENT, CLAIM_SIGN_IN, CLAIM_TEXT_MAX, claimProblem, sendClaim } from "@/lib/claims-api";
import { memberCall } from "@/lib/member-api";
import { PROOF_ACCEPT } from "@/lib/student-api";

// The "Claim This Listing", "Request an update" and "Request removal" forms on a business page (FAQ Q8, Q9 and the
// homepage FAQ's Claim This Listing button). Each goes to a queue the BSD team works through.
// A claim is made by a signed in member (M9-D): written evidence and an optional document, no code and no email.

type Kind = "claim" | "update" | "removal";
type Member = "unknown" | "checking" | "out" | "in";

const TABS: { kind: Kind; label: string; intro: string }[] = [
  {
    kind: "claim",
    label: "Claim This Listing",
    intro: "Is this your business? Tell us how you can show it is yours. You can add a document, such as a utility bill or a Companies House letter. The BSD team will check it.",
  },
  { kind: "update", label: "Request an update", intro: "Tell us what should change. Updates are usually processed within 3–7 working days." },
  {
    kind: "removal",
    label: "Request removal",
    intro: "You may request removal at any time. Emergency removals (incorrect or sensitive information) are handled within 24 hours.",
  },
];

// 16px on phones so the browser does not zoom in, 44px tall so a thumb can hit it.
const inputClass =
  "mt-1 min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base focus:border-brand-blue focus:outline-none aria-[invalid=true]:border-red-600 sm:text-sm";
const submitClass = "inline-flex min-h-11 items-center gap-2 rounded-md bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy disabled:opacity-60";

export default function ListingRequests({ apiBase, slug, businessName }: { apiBase: string; slug: string; businessName: string }) {
  const [kind, setKind] = useState<Kind | null>(null);
  const [f, setF] = useState({ name: "", email: "", phone: "", message: "", reason: "", isEmergency: false, companyWebsite: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [member, setMember] = useState<Member>("unknown");
  const [claimText, setClaimText] = useState("");
  const [claimFile, setClaimFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);

  const tab = TABS.find((t) => t.kind === kind);

  function open(next: Kind | null) {
    setKind(next);
    setErrors({});
    setFormError("");
    if (next === "claim" && (member === "unknown" || member === "out")) {
      setMember("checking");
      memberCall(apiBase, "me")
        .then((r) => setMember(r.user ? "in" : "out"))
        .catch(() => setMember("out"));
    }
  }

  const field = (key: "name" | "email" | "phone", label: string, type = "text", auto?: string) => (
    <div>
      <label htmlFor={`rq-${key}`} className="text-sm font-semibold text-brand-navy">
        {label}
      </label>
      <input
        id={`rq-${key}`}
        type={type}
        autoComplete={auto}
        value={f[key]}
        onChange={(e) => setF({ ...f, [key]: e.target.value })}
        aria-invalid={errors[key] ? true : undefined}
        className={inputClass}
      />
      {errors[key] && <p className="mt-1 text-sm text-red-700">{errors[key]}</p>}
    </div>
  );

  async function submitClaim(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError("");
    const problem = claimProblem(claimText, claimFile);
    if (problem) {
      setErrors({ ...(problem.proofText ? { proofText: problem.proofText } : {}), ...(problem.file ? { proof: problem.file } : {}) });
      return;
    }
    if (claimFile && !consent) {
      setErrors({ consent: "Tick the box to send a file." });
      return;
    }
    setBusy(true);
    try {
      setDone(await sendClaim(apiBase, slug, claimText, claimFile));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setMember("out");
      else if (err instanceof ApiError && err.status === 429) setFormError("You have sent several claims in a short time. Please try again later.");
      else if (err instanceof ApiError && err.fieldErrors.proofText) setErrors(err.fieldErrors);
      else if (err instanceof ApiError) setFormError(err.message);
      else setFormError("We could not reach the server. Please try again, or use the email address shown in the footer.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div role="status" className="mt-4 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-900">
        <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span>
          {done}{" "}
          {tab?.kind === "claim" && (
            <Link href="/account/claims" className="inline-flex min-h-11 items-center font-semibold underline">
              See your claims
            </Link>
          )}
        </span>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label={`Requests about ${businessName}`}>
        {TABS.map((t) => (
          <button
            key={t.kind}
            type="button"
            role="tab"
            aria-selected={kind === t.kind}
            onClick={() => open(kind === t.kind ? null : t.kind)}
            className={`min-h-11 rounded-md px-3 py-1.5 text-sm font-semibold ${kind === t.kind ? "bg-brand-navy text-white" : "border border-slate-300 bg-white text-brand-navy hover:border-brand-blue"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab?.kind === "claim" && (
        <div role="tabpanel" className="mt-4 space-y-4 rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-600">{tab.intro}</p>
          {(member === "unknown" || member === "checking") && <div aria-busy="true" className="h-24 animate-pulse rounded-lg bg-slate-100 motion-reduce:animate-none" />}
          {member === "out" && (
            <Link href="/account" className="inline-flex min-h-11 items-center rounded-md bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy">
              {CLAIM_SIGN_IN}
            </Link>
          )}
          {member === "in" && (
            <form noValidate className="space-y-4" onSubmit={submitClaim}>
              <div>
                <label htmlFor="rq-proofText" className="text-sm font-semibold text-brand-navy">
                  How can you show this business is yours?
                </label>
                <textarea
                  id="rq-proofText"
                  rows={4}
                  maxLength={CLAIM_TEXT_MAX}
                  value={claimText}
                  onChange={(e) => setClaimText(e.target.value)}
                  placeholder="For example: I am the registered owner. I can send a utility bill or a Companies House letter."
                  aria-invalid={errors.proofText ? true : undefined}
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-slate-500">Please do not type ID numbers or bank details here.</p>
                {errors.proofText && <p className="mt-1 text-sm text-red-700">{errors.proofText}</p>}
              </div>
              <div>
                <label htmlFor="rq-proofFile" className="text-sm font-semibold text-brand-navy">
                  Document <span className="font-normal text-slate-500">(optional)</span>
                </label>
                <input
                  id="rq-proofFile"
                  type="file"
                  accept={PROOF_ACCEPT}
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    const problem = file ? claimProblem("x".repeat(20), file)?.file : undefined;
                    setErrors(problem ? { proof: problem } : {});
                    if (problem) e.target.value = "";
                    setClaimFile(file && !problem ? file : null);
                  }}
                  aria-invalid={errors.proof ? true : undefined}
                  className={`${inputClass} py-2`}
                />
                <p className="mt-1 text-xs text-slate-500">JPG, PNG, WebP or PDF, up to 5 MB.</p>
                {errors.proof && <p className="mt-1 text-sm text-red-700">{errors.proof}</p>}
              </div>
              {claimFile && (
                <div>
                  <label className="flex min-h-11 items-start gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-brand-blue" />
                    {CLAIM_CONSENT}
                  </label>
                  {errors.consent && <p className="mt-1 text-sm text-red-700">{errors.consent}</p>}
                </div>
              )}
              {formError && (
                <p role="alert" className="text-sm font-medium text-red-700">
                  {formError}
                </p>
              )}
              <button type="submit" disabled={busy} className={submitClass}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Send request
              </button>
            </form>
          )}
        </div>
      )}

      {tab && tab.kind !== "claim" && (
        <form
          role="tabpanel"
          noValidate
          className="mt-4 space-y-4 rounded-lg border border-slate-200 bg-white p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setErrors({});
            setFormError("");
            const path = tab.kind === "update" ? "request-update" : "request-removal";
            const body: Record<string, unknown> = { name: f.name, email: f.email, phone: f.phone, companyWebsite: f.companyWebsite };
            if (tab.kind === "update") body.message = f.message;
            if (tab.kind === "removal") Object.assign(body, { reason: f.reason, isEmergency: f.isEmergency });
            try {
              const res = await fetch(`${apiBase}/businesses/${encodeURIComponent(slug)}/${path}`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(body),
              });
              const data = await res.json().catch(() => ({}));
              if (res.ok) setDone(data.message ?? "Thank you. We have received your request.");
              else if (res.status === 429) setFormError("You have sent several requests in a short time. Please try again in an hour.");
              else if (data.fieldErrors) setErrors(data.fieldErrors);
              else setFormError("Something went wrong. Please try again, or use the email address shown in the footer.");
            } catch {
              setFormError("We could not reach the server. Please try again, or use the email address shown in the footer.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <p className="text-sm text-slate-600">{tab.intro}</p>
          <div className="grid gap-4 sm:grid-cols-3">
            {field("name", "Your name", "text", "name")}
            {field("email", "Your email", "email", "email")}
            {field("phone", "Your phone (optional)", "tel", "tel")}
          </div>
          {tab.kind === "update" && (
            <div>
              <label htmlFor="rq-message" className="text-sm font-semibold text-brand-navy">
                What should change?
              </label>
              <textarea id="rq-message" rows={3} maxLength={2000} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} aria-invalid={errors.message ? true : undefined} className={inputClass} />
              {errors.message && <p className="mt-1 text-sm text-red-700">{errors.message}</p>}
            </div>
          )}
          {tab.kind === "removal" && (
            <>
              <div>
                <label htmlFor="rq-reason" className="text-sm font-semibold text-brand-navy">
                  Reason <span className="font-normal text-slate-500">(optional)</span>
                </label>
                <textarea id="rq-reason" rows={2} maxLength={2000} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} className={inputClass} />
              </div>
              <label className="flex min-h-11 items-start gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={f.isEmergency} onChange={(e) => setF({ ...f, isEmergency: e.target.checked })} className="mt-0.5 h-5 w-5 shrink-0 accent-brand-blue" />
                This is urgent: the listing shows incorrect or sensitive information.
              </label>
            </>
          )}
          <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
            <label htmlFor="rq-companyWebsite">Company website</label>
            <input id="rq-companyWebsite" tabIndex={-1} autoComplete="off" value={f.companyWebsite} onChange={(e) => setF({ ...f, companyWebsite: e.target.value })} />
          </div>
          {formError && (
            <p role="alert" className="text-sm font-medium text-red-700">
              {formError}
            </p>
          )}
          <button type="submit" disabled={busy} className={submitClass}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Send request
          </button>
        </form>
      )}
    </div>
  );
}
