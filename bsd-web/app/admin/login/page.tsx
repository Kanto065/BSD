"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useSession } from "@/lib/admin-session";
import { ErrorNote, inputClass } from "@/components/admin/ui";

export default function AdminLoginPage() {
  const { signIn } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form
        className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
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
        <h1 className="text-xl font-bold text-brand-navy">BSD Admin</h1>
        <p className="mt-1 text-sm text-slate-600">Sign in to manage listings.</p>
        <div className="mt-5 space-y-4">
          <div>
            <label htmlFor="email" className="text-sm font-semibold text-brand-navy">
              Email
            </label>
            <input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-semibold text-brand-navy">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>
          <ErrorNote error={error} />
          <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-md bg-brand-blue px-4 py-2.5 font-semibold text-white hover:bg-brand-navy disabled:opacity-60">
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Sign in
          </button>
        </div>
      </form>
    </div>
  );
}
