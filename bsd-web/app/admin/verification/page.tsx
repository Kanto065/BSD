"use client";

import Link from "next/link";
import { useState } from "react";
import VerificationBadge, { type VerificationStatus } from "@/components/VerificationBadge";
import { atLeast, useSession } from "@/lib/admin-session";
import { Card, ErrorNote, PageTitle, Pager, buttonClass, fmtDate, useAdminData } from "@/components/admin/ui";

type Item = {
  id: string;
  name: string;
  verificationStatus: VerificationStatus;
  phone: string;
  whatsapp: string | null;
  address: string | null;
  postcode: string;
  openingHours: string | null;
  reviewedAt: string | null;
  category: { name: string };
  zone: { name: string };
  localities: { locality: { name: string } }[];
};

// The field volunteers' queue: approved listings not yet Community Verified, oldest first (Factsheet tier 2).
export default function VerificationPage() {
  const { api, admin } = useSession();
  const [pageNo, setPageNo] = useState(1);
  const { data, error, reload } = useAdminData<{ items: Item[]; total: number; page: number; pageSize: number }>(`/verification-queue?page=${pageNo}&pageSize=20`);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);

  async function set(id: string, status: VerificationStatus) {
    setBusy(id);
    setActionError(null);
    try {
      await api(`/listings/${id}/verification`, { method: "PATCH", body: { status } });
      await reload();
    } catch (e) {
      setActionError(e);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageTitle sub="Cross-check each business's address, phone number and whether it is still trading, then record the result.">
        Verification queue {data ? `(${data.total})` : ""}
      </PageTitle>
      <ErrorNote error={error ?? actionError} />
      <div className="space-y-3">
        {data?.items.map((b) => (
          <Card key={b.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-brand-navy">
                  {atLeast(admin?.role, "MODERATOR") ? (
                    <Link href={`/admin/listings/${b.id}`} className="hover:underline">
                      {b.name}
                    </Link>
                  ) : (
                    b.name
                  )}
                </h2>
                <p className="text-sm text-slate-600">
                  {b.category.name} · {b.zone.name}
                </p>
              </div>
              <VerificationBadge status={b.verificationStatus} />
            </div>
            <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <div>
                <dt className="inline font-semibold text-slate-600">Phone: </dt>
                <dd className="inline">
                  <a href={`tel:${b.phone.replace(/\s+/g, "")}`} className="text-brand-teal-dark hover:underline">
                    {b.phone}
                  </a>
                </dd>
              </div>
              {b.whatsapp && (
                <div>
                  <dt className="inline font-semibold text-slate-600">WhatsApp: </dt>
                  <dd className="inline">{b.whatsapp}</dd>
                </div>
              )}
              <div className="sm:col-span-2">
                <dt className="inline font-semibold text-slate-600">Address: </dt>
                <dd className="inline">
                  {b.address}, {b.postcode}
                  {b.localities.length ? ` (${b.localities.map((l) => l.locality.name).join(", ")})` : ""}
                </dd>
              </div>
              {b.openingHours && (
                <div className="sm:col-span-2">
                  <dt className="inline font-semibold text-slate-600">Hours: </dt>
                  <dd className="inline whitespace-pre-line">{b.openingHours}</dd>
                </div>
              )}
              <div className="text-xs text-slate-500">Approved {fmtDate(b.reviewedAt)}</div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              {b.verificationStatus !== "PENDING_VERIFICATION" && (
                <button type="button" disabled={busy === b.id} onClick={() => set(b.id, "PENDING_VERIFICATION")} className={`${buttonClass} border border-amber-300 bg-white text-amber-900 hover:bg-amber-50`}>
                  I am checking this one
                </button>
              )}
              <button type="button" disabled={busy === b.id} onClick={() => set(b.id, "COMMUNITY_VERIFIED")} className={`${buttonClass} bg-green-700 text-white hover:bg-green-800`}>
                Mark Community Verified
              </button>
            </div>
          </Card>
        ))}
        {data && data.items.length === 0 && <Card>Nothing waiting. Every approved listing is Community Verified.</Card>}
      </div>
      {data && <Pager page={data.page} total={data.total} pageSize={data.pageSize} onPage={setPageNo} />}
    </div>
  );
}
