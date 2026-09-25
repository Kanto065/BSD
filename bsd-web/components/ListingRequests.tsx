"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

// The "Claim This Listing", "Request an update" and "Request removal" forms on a business page (FAQ Q8, Q9 and the
// homepage FAQ's Claim This Listing button). Each goes to a queue the BSD team works through.

type Kind = "claim" | "update" | "removal";

const TABS: { kind: Kind; label: string; intro: string }[] = [
  {
    kind: "claim",
    label: "Claim This Listing",
    intro: "Is this your business? Tell us who you are and how you can show it is yours. We will reply by email, and you can send documents to us then.",
  },
  { kind: "update", label: "Request an update", intro: "Tell us what should change. Updates are usually processed within 3–7 working days." },
  {
    kind: "removal",
    label: "Request removal",
    intro: "You may request removal at any time. Emergency removals (incorrect or sensitive information) are handled within 24 hours.",
  },
];

const inputClass =
  "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:outline-none aria-[invalid=true]:border-red-600";

export default function ListingRequests({ apiBase, slug, businessName }: { apiBase: string; slug: string; businessName: string }) {
  const [kind, setKind] = useState<Kind | null>(null);
  const [f, setF] = useState({ name: "", email: "", phone: "", proof: "", message: "", reason: "", isEmergency: false, companyWebsite: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const tab = TABS.find((t) => t.kind === kind);
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

  if (done) {
    return (
      <div role="status" className="mt-4 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-900">
        <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
        {done}
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
            onClick={() => {
              setKind(kind === t.kind ? null : t.kind);
              setErrors({});
              setFormError("");
            }}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold ${kind === t.kind ? "bg-brand-navy text-white" : "border border-slate-300 bg-white text-brand-navy hover:border-brand-blue"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab && (
        <form
          role="tabpanel"
          noValidate
          className="mt-4 space-y-4 rounded-lg border border-slate-200 bg-white p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setErrors({});
            setFormError("");
            const path = { claim: "claim", update: "request-update", removal: "request-removal" }[tab.kind];
            const body: Record<string, unknown> = { name: f.name, email: f.email, phone: f.phone, companyWebsite: f.companyWebsite };
            if (tab.kind === "claim") body.proof = f.proof;
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
              else setFormError("Something went wrong. Please try again, or email support@bsd.wales.");
            } catch {
              setFormError("We could not reach the server. Please try again, or email support@bsd.wales.");
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
          {tab.kind === "claim" && (
            <div>
              <label htmlFor="rq-proof" className="text-sm font-semibold text-brand-navy">
                How can you show this business is yours?
              </label>
              <textarea
                id="rq-proof"
                rows={3}
                maxLength={2000}
                value={f.proof}
                onChange={(e) => setF({ ...f, proof: e.target.value })}
                placeholder="For example: I can reply from the business email, or send a utility bill or registration document."
                aria-invalid={errors.proof ? true : undefined}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-slate-500">Please do not type ID numbers or bank details here. We will ask for anything we need by email.</p>
              {errors.proof && <p className="mt-1 text-sm text-red-700">{errors.proof}</p>}
            </div>
          )}
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
              <label className="flex items-start gap-2 text-sm text-slate-700">
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
          <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-md bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy disabled:opacity-60">
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Send request
          </button>
        </form>
      )}
    </div>
  );
}
