"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, useSession, type SessionAdmin } from "@/lib/admin-session";
import { Card, ErrorNote, PageTitle, buttonClass, inputClass } from "@/components/admin/ui";

export default function ChangePasswordPage() {
  const { api, adopt, admin } = useSession();
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState(false);

  return (
    <div className="max-w-lg">
      <PageTitle sub={admin?.mustChangePassword ? "You are using a one-time password. Choose your own password to continue." : undefined}>
        Change password
      </PageTitle>
      <Card>
        {done ? (
          <p className="text-sm font-semibold text-green-800">Your password has been changed. Other devices have been signed out.</p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setErrors({});
              setError(null);
              if (next !== repeat) return setErrors({ repeat: "The two new passwords do not match." });
              try {
                const r = await api<{ accessToken: string; admin: SessionAdmin }>("/change-password", {
                  method: "POST",
                  body: { currentPassword: current, newPassword: next },
                });
                adopt(r);
                setDone(true);
                router.replace("/admin");
              } catch (err) {
                if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors);
                else setError(err);
              }
            }}
          >
            {[
              { id: "currentPassword", label: "Current password", value: current, set: setCurrent, auto: "current-password" },
              { id: "newPassword", label: "New password", value: next, set: setNext, auto: "new-password" },
              { id: "repeat", label: "New password again", value: repeat, set: setRepeat, auto: "new-password" },
            ].map((f) => (
              <div key={f.id}>
                <label htmlFor={f.id} className="text-sm font-semibold text-brand-navy">
                  {f.label}
                </label>
                <input id={f.id} type="password" autoComplete={f.auto} required value={f.value} onChange={(e) => f.set(e.target.value)} className={inputClass} />
                {errors[f.id] && <p className="mt-1 text-sm font-medium text-red-700">{errors[f.id]}</p>}
              </div>
            ))}
            <p className="text-xs text-slate-500">
              At least 12 characters. Avoid the site or region name, common words and your email. A few unrelated words joined together work well.
            </p>
            <ErrorNote error={error} />
            <button type="submit" className={`${buttonClass} bg-brand-blue text-white hover:bg-brand-navy`}>
              Change password
            </button>
          </form>
        )}
      </Card>
    </div>
  );
}
