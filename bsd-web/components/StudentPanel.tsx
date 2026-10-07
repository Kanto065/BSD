"use client";

import { useEffect, useState } from "react";
import { ErrorNote, inputClass } from "@/components/admin/ui";
import { ApiError } from "@/lib/admin-session";
import { PROOF_ACCEPT, getStudent, proofProblem, sendProof, studentView, withdrawStudent, type StudentState } from "@/lib/student-api";

// Student verification on /account. Self contained: it asks the API who you are and renders nothing when you are
// signed out (401). Being a student is only a claim until an admin approves the proof, and the file is deleted
// within 24 hours after the decision.

const fieldClass = inputClass.replace("text-sm", "text-base sm:text-sm");
const button = "inline-flex min-h-[44px] items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60";

export default function StudentPanel({ apiBase }: { apiBase: string }) {
  const [state, setState] = useState<StudentState | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const load = () =>
      getStudent(apiBase)
        .then(setState)
        .catch(() => setState(null));
    void load();
    // AccountForm can fire this after sign in or sign out so the panel follows without a reload.
    window.addEventListener("bsd:member-changed", load);
    return () => window.removeEventListener("bsd:member-changed", load);
  }, [apiBase]);

  if (!state) return null;
  const view = studentView(state);

  const choose = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    const problem = f ? proofProblem(f) : null;
    setFileError(problem);
    setFile(f && !problem ? f : null);
    if (problem) e.target.value = "";
  };

  const run = async (action: () => Promise<StudentState>) => {
    setBusy(true);
    setError(null);
    try {
      setState(await action());
      setFile(null);
      setNote("");
      setConsent(false);
    } catch (err) {
      setError(err);
      if (err instanceof ApiError && err.status === 401) setState(null);
    } finally {
      setBusy(false);
    }
  };

  const showForm = view === "none" || view === "rejected" || view === "expired";

  return (
    <section aria-labelledby="student-heading" className="mt-10 border-t border-slate-200 pt-8">
      <h2 id="student-heading" className="text-lg font-bold text-brand-navy">
        Student status
      </h2>
      <div aria-live="polite">
        {view === "verified" && <p className="mt-2 text-sm font-semibold text-emerald-800">Student, verified</p>}
        {view === "pending" && <p className="mt-2 text-sm text-slate-700">Waiting for review. You will see the result here.</p>}
        {view === "rejected" && (
          <p className="mt-2 text-sm text-slate-700">
            <span className="font-semibold">Not verified.</span> {state.rejectionReason}
          </p>
        )}
        {view === "expired" && <p className="mt-2 text-sm text-slate-700">Your request was not reviewed in time and the file was deleted. You can send it again.</p>}
        {view === "none" && (
          <p className="mt-2 text-sm text-slate-700">
            If you are a student you can ask the BSD team to verify it. Upload a photo or PDF of your student card or an enrolment letter.
          </p>
        )}
      </div>
      <ErrorNote error={error} />

      {view === "pending" && (
        <button type="button" disabled={busy} onClick={() => run(() => withdrawStudent(apiBase))} className={`${button} mt-4 border border-slate-300 text-brand-navy hover:bg-slate-50`}>
          Withdraw request
        </button>
      )}

      {showForm && (
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (file && consent) void run(() => sendProof(apiBase, file, note));
          }}
        >
          <div>
            <label htmlFor="student-file" className="text-sm font-semibold text-slate-800">
              Student card or enrolment letter
            </label>
            <input id="student-file" type="file" accept={PROOF_ACCEPT} onChange={choose} className={`${fieldClass} min-h-[44px] file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold`} aria-describedby="student-file-help" />
            <p id="student-file-help" className={`mt-1 text-xs ${fileError ? "font-semibold text-red-700" : "text-slate-600"}`} role={fileError ? "alert" : undefined}>
              {fileError ?? "JPG, PNG, WebP or PDF, up to 5 MB."}
            </p>
          </div>
          <div>
            <label htmlFor="student-note" className="text-sm font-semibold text-slate-800">
              Note (optional)
            </label>
            <input id="student-note" type="text" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} className={`${fieldClass} min-h-[44px]`} />
          </div>
          <label className="flex min-h-[44px] items-start gap-3 text-sm text-slate-700">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0" />
            <span>
              I agree that BSD can look at this file to check my student status. The file is kept only until the check is done and is deleted within 24 hours after the decision.
            </span>
          </label>
          <button type="submit" disabled={busy || !file || !consent} className={`${button} bg-brand-navy text-white hover:bg-brand-navy/90`}>
            {busy ? "Sending..." : "Send for review"}
          </button>
        </form>
      )}
    </section>
  );
}
