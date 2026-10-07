"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ErrorNote, inputClass } from "@/components/admin/ui";
import { ApiError } from "@/lib/admin-session";
import { zoneForPostcode } from "@/lib/business-profile";
import { changePassword, deleteAccount, memberCall as call, updateProfile, type Member } from "@/lib/member-api";

// 16px on phones so iOS does not zoom into the field, back to the compact size from sm up. 44px tall for easy tapping.
const fieldClass = `${inputClass.replace("text-sm", "text-base sm:text-sm")} min-h-11`;
const buttonClass =
  "flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-navy px-4 py-2.5 font-semibold text-white shadow-sm transition hover:bg-brand-blue active:scale-[0.98] disabled:opacity-60";
const quietButton = "flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-semibold text-brand-navy hover:bg-slate-50";

// Sign in, create an account, or see who you are signed in as. The API sets one httpOnly cookie on the parent
// domain, so the same sign-in works on the Privilege Pass and Marketplace sites. The page never sees the token.

const SITES: Record<string, string> = { DIRECTORY: "Directory", CARD: "Privilege Pass", MARKETPLACE: "Marketplace" };
const BADGES: Record<string, string> = { MEMBER: "Member", STUDENT: "Student", VOLUNTEER: "Volunteer" };

const label = "text-sm font-semibold text-slate-800";
const fieldError = (e: unknown, key: string) => (e instanceof ApiError ? e.fieldErrors[key] : undefined);

export const accountTypeLabel = (m: Pick<Member, "accountType" | "studentVerified">) =>
  m.accountType === "GENERAL" ? "General" : m.studentVerified ? "Student" : "Student (not verified)";

type Props = {
  apiBase: string;
  /** Used on Submit: no page heading of its own, and it does not look up the session (the page already did). */
  compact?: boolean;
  onSignedIn?: (member: Member) => void;
};

export default function AccountForm({ apiBase, compact = false, onSignedIn }: Props) {
  const [member, setMember] = useState<Member | null>(null);
  const [checking, setChecking] = useState(!compact);
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [f, setF] = useState({ name: "", email: "", password: "", postcode: "", phone: "", accountType: "" });
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const Heading = compact ? "h3" : "h1";

  useEffect(() => {
    if (compact) return;
    call(apiBase, "me")
      .then((r) => setMember(r.user ?? null))
      .catch(() => setMember(null))
      .finally(() => setChecking(false));
  }, [apiBase, compact]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  if (checking) return <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" aria-label="Loading" />;

  if (member) {
    return (
      <SignedIn
        apiBase={apiBase}
        member={member}
        setMember={setMember}
        onDeleted={() => {
          setMember(null);
          window.dispatchEvent(new Event("bsd:member-changed"));
        }}
        onSignOut={async () => {
          await call(apiBase, "logout", {}).catch(() => undefined);
          setMember(null);
          window.dispatchEvent(new Event("bsd:member-changed"));
        }}
      />
    );
  }

  return (
    <form
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        if (mode === "register" && !f.accountType) {
          setError(new ApiError(400, "Please check the highlighted fields.", { accountType: "Choose General or Student." }));
          return;
        }
        // Same postcode rule as the API (the API still checks it again).
        const postcodeCheck = mode === "register" ? zoneForPostcode(f.postcode) : null;
        if (mode === "register" && (!f.postcode.trim() || postcodeCheck?.problem)) {
          setError(new ApiError(400, "Please check the highlighted fields.", { postcode: postcodeCheck?.problem ?? "Enter your postcode." }));
          return;
        }
        setBusy(true);
        try {
          const r =
            mode === "signin"
              ? await call(apiBase, "login", { email: f.email.trim(), password: f.password, module: "DIRECTORY" })
              : await call(apiBase, "register", {
                  name: f.name.trim(),
                  email: f.email.trim(),
                  password: f.password,
                  postcode: f.postcode.trim(),
                  phone: f.phone.trim(),
                  accountType: f.accountType,
                  module: "DIRECTORY",
                });
          setF({ name: "", email: "", password: "", postcode: "", phone: "", accountType: "" });
          if (r.user && onSignedIn) onSignedIn(r.user);
          else setMember(r.user ?? null);
          window.dispatchEvent(new Event("bsd:member-changed"));
        } catch (err) {
          setError(err);
          setF((s) => ({ ...s, password: "" }));
        } finally {
          setBusy(false);
        }
      }}
    >
      <Heading className="text-2xl font-bold text-brand-navy">{mode === "signin" ? "Sign in" : "Create your account"}</Heading>
      <p className="mt-1 text-sm text-slate-600">One account for the directory, the Privilege Pass and the Marketplace.</p>
      <div className="mt-6 space-y-5">
        {mode === "register" && (
          <div>
            <label htmlFor="name" className={label}>
              Name
            </label>
            <input id="name" autoComplete="name" required value={f.name} onChange={set("name")} className={fieldClass} />
            {fieldError(error, "name") && <p className="mt-1 text-sm text-red-700">{fieldError(error, "name")}</p>}
          </div>
        )}
        <div>
          <label htmlFor="email" className={label}>
            Email
          </label>
          <input id="email" type="email" autoComplete="email" required value={f.email} onChange={set("email")} className={fieldClass} />
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
            className={fieldClass}
          />
          {mode === "register" && <p className="mt-1 text-xs text-slate-600">At least 12 characters. Avoid easy words and sequences.</p>}
          {fieldError(error, "password") && <p className="mt-1 text-sm text-red-700">{fieldError(error, "password")}</p>}
        </div>
        {mode === "register" && (
          <>
            <div>
              <label htmlFor="postcode" className={label}>
                Postcode
              </label>
              <input id="postcode" autoComplete="postal-code" required placeholder="SA1 4PE" value={f.postcode} onChange={set("postcode")} className={fieldClass} />
              {fieldError(error, "postcode") && <p className="mt-1 text-sm text-red-700">{fieldError(error, "postcode")}</p>}
            </div>
            <div>
              <label htmlFor="phone" className={label}>
                Phone (optional)
              </label>
              <input id="phone" type="tel" autoComplete="tel" value={f.phone} onChange={set("phone")} maxLength={25} className={fieldClass} />
              {fieldError(error, "phone") && <p className="mt-1 text-sm text-red-700">{fieldError(error, "phone")}</p>}
            </div>
            <AccountTypeChoice value={f.accountType} onChange={(v) => setF({ ...f, accountType: v })} error={fieldError(error, "accountType")} />
          </>
        )}
        <ErrorNote error={error} />
        <button type="submit" disabled={busy} className={buttonClass}>
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
          className="inline-flex min-h-11 items-center font-semibold text-brand-teal-dark hover:underline"
        >
          {mode === "signin" ? "Create an account" : "Sign in"}
        </button>
      </p>
    </form>
  );
}

function AccountTypeChoice({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <fieldset aria-describedby={error ? "accountType-error" : undefined}>
      <legend className={label}>I am signing up as</legend>
      <div className="mt-1 space-y-1">
        {[
          { v: "GENERAL", text: "General" },
          { v: "STUDENT", text: "Student" },
        ].map((o) => (
          <label key={o.v} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-slate-800">
            <input type="radio" name="accountType" value={o.v} checked={value === o.v} onChange={() => onChange(o.v)} className="h-5 w-5 shrink-0 accent-brand-blue" />
            {o.text}
          </label>
        ))}
      </div>
      <p className="text-xs text-slate-600">You can ask the BSD team to verify your student status after you sign up.</p>
      {error && (
        <p id="accountType-error" className="mt-1 text-sm text-red-700">
          {error}
        </p>
      )}
    </fieldset>
  );
}

function SignedIn({ apiBase, member, setMember, onSignOut, onDeleted }: { apiBase: string; member: Member; setMember: (m: Member) => void; onSignOut: () => void; onDeleted: () => void }) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-brand-navy">Hello, {member.name}</h1>
      <p className="mt-1 text-sm text-slate-600">{member.email}</p>
      <dl className="mt-6 space-y-3 text-sm">
        <div>
          <dt className="font-semibold text-slate-800">Account type</dt>
          <dd className="text-slate-600">{accountTypeLabel(member)}</dd>
        </div>
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
        {member.phone && (
          <div>
            <dt className="font-semibold text-slate-800">Phone</dt>
            <dd className="text-slate-600">{member.phone}</dd>
          </div>
        )}
      </dl>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Link href="/account/business" className={quietButton}>
          Your business details
        </Link>
        <Link href="/account/listings" className={quietButton}>
          Your listings{member.listingCount ? ` (${member.listingCount})` : ""}
        </Link>
      </div>

      <div className="mt-6 space-y-3">
        <details className="rounded-lg border border-slate-200 px-4">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-brand-navy">Edit profile</summary>
          <EditProfile apiBase={apiBase} member={member} setMember={setMember} />
        </details>
        <details className="rounded-lg border border-slate-200 px-4">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-brand-navy">Change password</summary>
          <ChangePassword apiBase={apiBase} />
        </details>
        <details className="rounded-lg border border-slate-200 px-4">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-red-800">Delete my account</summary>
          <DeleteAccount apiBase={apiBase} onDeleted={onDeleted} />
        </details>
      </div>

      <button type="button" onClick={onSignOut} className="mt-8 min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-brand-navy hover:bg-slate-50">
        Sign out
      </button>
    </div>
  );
}

function EditProfile({ apiBase, member, setMember }: { apiBase: string; member: Member; setMember: (m: Member) => void }) {
  const [f, setF] = useState({ name: member.name, phone: member.phone ?? "", postcode: member.postcode, accountType: member.accountType as string });
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: "name" | "phone" | "postcode") => (e: React.ChangeEvent<HTMLInputElement>) => {
    setF({ ...f, [k]: e.target.value });
    setSaved(false);
  };
  return (
    <form
      noValidate
      className="space-y-4 pb-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        setSaved(false);
        try {
          const r = await updateProfile(apiBase, { name: f.name.trim(), phone: f.phone.trim() || null, postcode: f.postcode.trim(), accountType: f.accountType as Member["accountType"] });
          setMember(r.user);
          setSaved(true);
        } catch (err) {
          setError(err);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <label htmlFor="edit-name" className={label}>
          Name
        </label>
        <input id="edit-name" autoComplete="name" value={f.name} onChange={set("name")} className={fieldClass} />
        {fieldError(error, "name") && <p className="mt-1 text-sm text-red-700">{fieldError(error, "name")}</p>}
      </div>
      <div>
        <label htmlFor="edit-phone" className={label}>
          Phone (optional)
        </label>
        <input id="edit-phone" type="tel" autoComplete="tel" value={f.phone} onChange={set("phone")} maxLength={25} className={fieldClass} />
        {fieldError(error, "phone") && <p className="mt-1 text-sm text-red-700">{fieldError(error, "phone")}</p>}
      </div>
      <div>
        <label htmlFor="edit-postcode" className={label}>
          Postcode
        </label>
        <input id="edit-postcode" autoComplete="postal-code" value={f.postcode} onChange={set("postcode")} className={fieldClass} />
        {fieldError(error, "postcode") && <p className="mt-1 text-sm text-red-700">{fieldError(error, "postcode")}</p>}
      </div>
      <AccountTypeChoice value={f.accountType} onChange={(v) => { setF({ ...f, accountType: v }); setSaved(false); }} error={fieldError(error, "accountType")} />
      <ErrorNote error={error} />
      <p role="status" aria-live="polite" className="text-sm font-medium text-green-800">
        {saved ? "Saved." : ""}
      </p>
      <button type="submit" disabled={busy} className={buttonClass}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Save profile
      </button>
    </form>
  );
}

function DeleteAccount({ apiBase, onDeleted }: { apiBase: string; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      noValidate
      className="space-y-4 pb-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!confirming) {
          setConfirming(true);
          return;
        }
        setBusy(true);
        setError(null);
        try {
          await deleteAccount(apiBase, password);
          onDeleted();
        } catch (err) {
          setError(err);
          setPassword("");
          setBusy(false);
        }
      }}
    >
      <p className="text-sm text-slate-700">
        This removes your name, email address, phone number, postcode and saved business details, and signs you out everywhere. Your listings stay on the
        directory, with no link to you. You cannot undo this. You can sign up again with the same email address later.
      </p>
      {confirming && (
        <div>
          <label htmlFor="delete-password" className={label}>
            Enter your password to confirm
          </label>
          <input id="delete-password" autoFocus type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={fieldClass} />
          {fieldError(error, "password") && <p className="mt-1 text-sm text-red-700">{fieldError(error, "password")}</p>}
        </div>
      )}
      <ErrorNote error={error} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="submit"
          disabled={busy || (confirming && !password)}
          className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-800 active:scale-[0.98] disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {confirming ? "Yes, delete my account" : "Delete my account"}
        </button>
        {confirming && (
          <button
            type="button"
            onClick={() => {
              setConfirming(false);
              setPassword("");
              setError(null);
            }}
            className={`${quietButton} w-full sm:w-auto`}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function ChangePassword({ apiBase }: { apiBase: string }) {
  const [f, setF] = useState({ currentPassword: "", newPassword: "" });
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <form
      noValidate
      className="space-y-4 pb-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        setSaved(false);
        try {
          await changePassword(apiBase, f);
          setF({ currentPassword: "", newPassword: "" });
          setSaved(true);
        } catch (err) {
          setError(err);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <label htmlFor="current-password" className={label}>
          Current password
        </label>
        <input id="current-password" type="password" autoComplete="current-password" value={f.currentPassword} onChange={(e) => setF({ ...f, currentPassword: e.target.value })} className={fieldClass} />
        {fieldError(error, "currentPassword") && <p className="mt-1 text-sm text-red-700">{fieldError(error, "currentPassword")}</p>}
      </div>
      <div>
        <label htmlFor="new-password" className={label}>
          New password
        </label>
        <input id="new-password" type="password" autoComplete="new-password" value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} className={fieldClass} />
        <p className="mt-1 text-xs text-slate-600">At least 12 characters. Avoid easy words and sequences.</p>
        {fieldError(error, "newPassword") && <p className="mt-1 text-sm text-red-700">{fieldError(error, "newPassword")}</p>}
      </div>
      <ErrorNote error={error} />
      <p role="status" aria-live="polite" className="text-sm font-medium text-green-800">
        {saved ? "Your password has been changed. Other devices have been signed out." : ""}
      </p>
      <button type="submit" disabled={busy} className={buttonClass}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Change password
      </button>
    </form>
  );
}
