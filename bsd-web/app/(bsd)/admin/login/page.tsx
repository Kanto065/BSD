"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import Logo from "@/components/Logo";
import { useSession } from "@/lib/admin-session";
import { ErrorNote, inputClass } from "@/components/admin/ui";
import PasswordInput from "@/components/PasswordInput";

export default function AdminLoginPage() {
  const { signIn } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-[1fr_minmax(0,34rem)]">
      <div className="relative hidden overflow-hidden bg-brand-navy p-12 text-white lg:flex lg:flex-col lg:justify-end">
        <div aria-hidden="true" className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-teal/20 blur-3xl" />
        <div aria-hidden="true" className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-brand-blue/30 blur-3xl" />
        <div className="relative max-w-md">
          <h2 className="text-3xl font-bold leading-tight">Keeping the directory accurate and trusted.</h2>
          <p className="mt-3 text-slate-300">Review new listings, verify businesses and answer requests from the community across SA1 to SA34.</p>
        </div>
      </div>

      <div className="flex items-center justify-center bg-slate-50 px-4 py-12 sm:px-8">
        <form
          className="w-full max-w-sm"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              await signIn(email.trim(), password);
            } catch (err) {
              setError(err);
              setPassword("");
            } finally {
              setBusy(false);
            }
          }}
        >
          <Logo className="h-12" priority />
          <h1 className="mt-8 text-2xl font-bold tracking-tight text-brand-navy">Sign in to the admin panel</h1>
          <p className="mt-1 text-sm text-slate-600">For the BSD team and volunteers only.</p>
          <div className="mt-8 space-y-5">
            <div>
              <label htmlFor="email" className="text-sm font-semibold text-slate-800">
                Email
              </label>
              <input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="password" className="text-sm font-semibold text-slate-800">
                Password
              </label>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </div>
            <ErrorNote error={error} />
            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-navy px-4 py-2.5 font-semibold text-white shadow-sm transition hover:bg-brand-blue active:scale-[0.98] disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Sign in
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
