"use client";

import { useState } from "react";
import { ApiError, useSession, type Role } from "@/lib/admin-session";
import { Card, ErrorNote, PageTitle, buttonClass, fmtDate, inputClass, useAdminData } from "@/components/admin/ui";

type User = { id: string; name: string; email: string; role: Role; active: boolean; lastLoginAt: string | null; createdAt: string; mustChangePassword: boolean };

const ROLES: { value: Role; label: string; can: string }[] = [
  { value: "VOLUNTEER", label: "Volunteer", can: "Verification queue only" },
  { value: "MODERATOR", label: "Moderator", can: "Also approve, reject, edit and remove listings, claims and messages" },
  { value: "ADMIN", label: "Admin", can: "Also the audit log" },
  { value: "SUPER_ADMIN", label: "Super Admin", can: "Also team accounts" },
];

// Team accounts. A one-time password is shown once, to pass on privately. The person must change it at first sign-in.
export default function UsersPage() {
  const { api, admin } = useSession();
  const { data, error, reload } = useAdminData<{ users: User[] }>("/users");
  const [form, setForm] = useState({ name: "", email: "", role: "VOLUNTEER" as Role });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<unknown>(null);
  const [secret, setSecret] = useState<{ email: string; password: string } | null>(null);

  async function run<T>(fn: () => Promise<T>) {
    setActionError(null);
    try {
      const r = await fn();
      await reload();
      return r;
    } catch (e) {
      setActionError(e);
      return null;
    }
  }

  return (
    <div className="space-y-6">
      <PageTitle>Team</PageTitle>
      {secret && (
        <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="font-semibold text-amber-900">One-time password for {secret.email}. It is shown only now.</p>
          <p className="mt-2 font-mono text-lg">{secret.password}</p>
          <p className="mt-2 text-amber-900">Pass it on privately (not by the public email address). They will be asked to choose their own at first sign-in.</p>
          <button type="button" onClick={() => setSecret(null)} className="mt-2 font-semibold text-amber-900 underline">
            I have noted it
          </button>
        </div>
      )}
      <ErrorNote error={error ?? actionError} />

      <Card title="People">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-4">Person</th>
                <th className="py-2 pr-4">Role</th>
                <th className="py-2 pr-4">Last sign-in</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.users.map((u) => {
                const self = u.email === admin?.email;
                return (
                  <tr key={u.id} className={u.active ? "" : "text-slate-400"}>
                    <td className="py-2 pr-4">
                      <p className="font-semibold">{u.name}</p>
                      <p className="text-xs">
                        {u.email}
                        {!u.active ? " · disabled" : u.mustChangePassword ? " · has a one-time password" : ""}
                      </p>
                    </td>
                    <td className="py-2 pr-4">
                      <select
                        aria-label={`Role for ${u.name}`}
                        disabled={self}
                        value={u.role}
                        onChange={(e) => run(() => api(`/users/${u.id}`, { method: "PATCH", body: { role: e.target.value } }))}
                        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm disabled:bg-slate-50"
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-4 text-xs">{u.lastLoginAt ? fmtDate(u.lastLoginAt) : "never"}</td>
                    <td className="space-x-3 py-2 text-xs font-semibold">
                      {!self && (
                        <>
                          <button type="button" onClick={() => run(() => api(`/users/${u.id}`, { method: "PATCH", body: { active: !u.active } }))} className="text-brand-teal-dark hover:underline">
                            {u.active ? "Disable" : "Enable"}
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!window.confirm(`Reset ${u.name}'s password? They will be signed out everywhere.`)) return;
                              const r = await run(() => api<{ temporaryPassword: string }>(`/users/${u.id}/reset-password`, { method: "POST" }));
                              if (r) setSecret({ email: u.email, password: r.temporaryPassword });
                            }}
                            className="text-brand-teal-dark hover:underline"
                          >
                            Reset password
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Add a person">
        <form
          className="grid gap-4 sm:grid-cols-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setErrors({});
            setActionError(null);
            try {
              const r = await api<{ user: User; temporaryPassword: string }>("/users", { method: "POST", body: form });
              setSecret({ email: r.user.email, password: r.temporaryPassword });
              setForm({ name: "", email: "", role: "VOLUNTEER" });
              await reload();
            } catch (err) {
              if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors);
              else setActionError(err);
            }
          }}
        >
          <div>
            <label htmlFor="u-name" className="text-sm font-semibold text-brand-navy">
              Name
            </label>
            <input id="u-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
            {errors.name && <p className="mt-1 text-sm text-red-700">{errors.name}</p>}
          </div>
          <div>
            <label htmlFor="u-email" className="text-sm font-semibold text-brand-navy">
              Email
            </label>
            <input id="u-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} />
            {errors.email && <p className="mt-1 text-sm text-red-700">{errors.email}</p>}
          </div>
          <div>
            <label htmlFor="u-role" className="text-sm font-semibold text-brand-navy">
              Role
            </label>
            <select id="u-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })} className={inputClass}>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">{ROLES.find((r) => r.value === form.role)?.can}</p>
          </div>
          <div className="sm:col-span-3">
            <button type="submit" className={`${buttonClass} bg-brand-blue text-white hover:bg-brand-navy`}>
              Add person
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
