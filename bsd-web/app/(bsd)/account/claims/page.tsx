import type { Metadata } from "next";
import Link from "next/link";
import MyClaims from "@/components/MyClaims";
import { publicApiBase } from "@/lib/api";

export const metadata: Metadata = {
  title: "Your Claims",
  description: "The listings you have asked to claim.",
  robots: { index: false, follow: false },
};

// Rendered per request so the browser gets the API address of the running deployment.
export const dynamic = "force-dynamic";

export default function MyClaimsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <Link href="/account" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-teal-dark hover:underline">
        Your account
      </Link>
      <h1 className="mt-2 text-3xl font-bold text-brand-navy">Your claims</h1>
      <div className="mt-8">
        <MyClaims apiBase={publicApiBase()} />
      </div>
    </div>
  );
}
