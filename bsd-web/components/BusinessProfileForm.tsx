"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { StepAdditional, StepBusiness, StepContact, StepLocation } from "@/components/BusinessFields";
import { emptyValues, mergeProfile, toProfileData, type Errors, type FormValues } from "@/lib/business-profile";
import { ApiError } from "@/lib/admin-session";
import { clearBusinessProfile, getBusinessProfile, memberCall, saveBusinessProfile } from "@/lib/member-api";
import type { CategoryOption } from "@/lib/taxonomy";

// The business details saved on the account, the same fields as the Submit steps without photos or consents. Whatever
// is saved here fills the Submit form (and later the Pass and Marketplace forms). It is a draft, so nothing is required.

type State = "checking" | "out" | "ready";

export default function BusinessProfileForm({ apiBase, categories }: { apiBase: string; categories: CategoryOption[] }) {
  const [state, setState] = useState<State>("checking");
  const [values, setValues] = useState<FormValues>(emptyValues);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const errors: Errors = {};
  const set = (patch: Partial<FormValues>) => {
    setValues((v) => ({ ...v, ...patch }));
    setMessage(null);
  };

  useEffect(() => {
    memberCall(apiBase, "me")
      .then(async (r) => {
        if (!r.user) return setState("out");
        const p = await getBusinessProfile(apiBase).catch(() => null);
        if (p) setValues(mergeProfile(emptyValues, p.data));
        setState("ready");
      })
      .catch(() => setState("out"));
  }, [apiBase]);

  if (state === "checking") return <div aria-busy="true" className="h-64 animate-pulse rounded-2xl bg-slate-100 motion-reduce:animate-none" />;
  if (state === "out") {
    return (
      <p className="text-slate-600">
        Please{" "}
        <Link href="/account" className="font-semibold text-brand-teal-dark underline">
          sign in
        </Link>{" "}
        to see your business details.
      </p>
    );
  }

  return (
    <form
      noValidate
      className="space-y-8"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMessage(null);
        try {
          await saveBusinessProfile(apiBase, toProfileData(values), 0);
          setMessage({ ok: true, text: "Saved. These details will fill your next listing." });
        } catch (err) {
          setMessage({ ok: false, text: err instanceof ApiError && err.fieldErrors && Object.keys(err.fieldErrors).length ? "Please check the details and try again." : "Could not save your details. Please try again." });
        } finally {
          setBusy(false);
        }
      }}
    >
      <StepBusiness v={values} set={set} errors={errors} categories={categories} />
      <StepContact v={values} set={set} errors={errors} categories={categories} />
      <StepLocation v={values} set={set} errors={errors} />
      <StepAdditional v={values} set={set} />

      <div className="space-y-3">
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={busy} className="press inline-flex min-h-11 items-center gap-2 rounded-md bg-brand-navy px-8 text-base font-semibold text-white hover:bg-brand-blue disabled:opacity-70">
            {busy && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
            Save details
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!window.confirm("Remove your saved business details? Your listings are not affected.")) return;
              await clearBusinessProfile(apiBase).catch(() => undefined);
              setValues(emptyValues);
              setMessage({ ok: true, text: "Your saved details have been removed." });
            }}
            className="min-h-11 rounded-md border border-slate-300 px-6 text-base font-semibold text-brand-navy hover:border-brand-blue"
          >
            Clear saved details
          </button>
        </div>
        <p role="status" aria-live="polite" className={`min-h-5 text-sm font-medium ${message?.ok === false ? "text-red-700" : "text-green-800"}`}>
          {message?.text}
        </p>
      </div>
    </form>
  );
}
