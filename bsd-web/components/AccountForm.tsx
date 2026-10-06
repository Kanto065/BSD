"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ErrorNote, inputClass } from "@/components/admin/ui";
import { ApiError } from "@/lib/admin-session";
import { memberCall as call, type Member } from "@/lib/member-api";

// Sign in, create an account, or see who you are signed in as. The API sets one httpOnly cookie on the parent
// domain, so the same sign-in works on the Privilege Pass and Marketplace sites. The page never sees the token.

const SITES: Record<string, string> = { DIRECTORY: "Directory", CARD: "Privilege Pass", MARKETPLACE: "Marketplace" };
const BADGES: Record<string, string> = { MEMBER: "Member", STUDENT: "Student", VOLUNTEER: "Volunteer" };

const label = "text-sm font-semibold text-slate-800";
const fieldError = (e: unknown, key: string) => (e instanceof ApiError ? e.fieldErrors[key] : undefined);

export default function AccountForm({ apiBase }: { apiBase: string }) {
  const [member, setMember] = useState<Member | null>(null);
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [f, setF] = useState({ name: "", email: "", password: "", postcode: "" });
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    call(apiBase, "me")
      .then((r) => setMember(r.user ?? null))
      .catch(() => setMember(null))
      .finally(() => setChecking(false));
  }, [apiBase]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  if (checking) return <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" aria-label="Loading" />;

  if (member) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-brand-navy">Hello, {member.name}</h1>
        <p className="mt-1 text-sm text-slate-600">{member.email}</p>
        <dl className="mt-6 space-y-3 text-sm">
          <div>
            <dt className="font-semibold text-slate-800">Badges</dt>
            <dd className="text-slate-600">{member.badges.map((b) => BADGES[b] ?? b).join(", ")}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-800">Sites joined</dt>
            <dd className="text-slate-600">{member.modules.map((m) => SITES[m] ?? m).join(", ")}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-800">Postcode</dt>
            <dd className="text-slate-600">{member.postcode}</dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={async () => {
            await call(apiBase, "logout", {}).catch(() => undefined);
            setMember(null);
          }}
          className="mt-8 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-brand-navy hover:bg-slate-50"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const r =
            mode === "signin"
              ? await call(apiBase, "login", { email: f.email.trim(), password: f.password, module: "DIRECTORY" })
              : await call(apiBase, "register", { ...f, name: f.name.trim(), email: f.email.trim(), postcode: f.postcode.trim(), module: "DIRECTORY" });
          setMember(r.user ?? null);
          setF({ name: "", email: "", password: "", postcode: "" });
        } catch (err) {
          setError(err);
          setF((s) => ({ ...s, password: "" }));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h1 className="text-2xl font-bold text-brand-navy">{mode === "signin" ? "Sign in" : "Create your account"}</h1>
      <p className="mt-1 text-sm text-slate-600">One account for the directory, the Privilege Pass and the Marketplace.</p>
      <div className="mt-6 space-y-5">
        {mode === "register" && (
          <div>
            <label htmlFor="name" className={label}>
              Name
            </label>
            <input id="name" autoComplete="name" required value={f.name} onChange={set("name")} className={inputClass} />
            {fieldError(error, "name") && <p className="mt-1 text-sm text-red-700">{fieldError(error, "name")}</p>}
          </div>
        )}
        <div>
          <label htmlFor="email" className={label}>
            Email
          </label>
          <input id="email" type="email" autoComplete="email" required value={f.email} onChange={set("email")} className={inputClass} />
          {fieldError(error, "email") && <p className="mt-1 text-sm text-red-700">{fieldError(error, "email")}</p>}
        </div>
        <div>
          <label htmlFor="password" className={label}>
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            required
            value={f.password}
            onChange={set("password")}
            className={inputClass}
          />
          {mode === "register" && <p className="mt-1 text-xs text-slate-600">At least 12 characters. Avoid easy words and sequences.</p>}
          {fieldError(error, "password") && <p className="mt-1 text-sm text-red-700">{fieldError(error, "password")}</p>}
        </div>
        {mode === "register" && (
          <div>
            <label htmlFor="postcode" className={label}>
              Postcode
            </label>
            <input id="postcode" autoComplete="postal-code" required placeholder="SA1 4PE" value={f.postcode} onChange={set("postcode")} className={inputClass} />
            {fieldError(error, "postcode") && <p className="mt-1 text-sm text-red-700">{fieldError(error, "postcode")}</p>}
          </div>
        )}
        <ErrorNote error={error} />
        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-navy px-4 py-2.5 font-semibold text-white shadow-sm transition hover:bg-brand-blue active:scale-[0.98] disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </div>
      <p className="mt-6 text-sm text-slate-600">
        {mode === "signin" ? "New here? " : "Already have an account? "}
        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "register" : "signin");
            setError(null);
          }}
          className="font-semibold text-brand-teal-dark hover:underline"
        >
          {mode === "signin" ? "Create an account" : "Sign in"}
        </button>
      </p>
    </form>
  );
}
