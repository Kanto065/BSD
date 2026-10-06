"use client";

import { startTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";

// Shown when a page could not load its data (for example the API was briefly unreachable). Pages fetch fresh data on
// every visit, so trying again usually works.
export default function PageError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  // refresh() fetches the page again from the server; reset() then clears this error screen.
  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center sm:px-6">
      <h1 className="text-2xl font-bold text-brand-navy sm:text-3xl">This page could not load</h1>
      <p className="mt-3 text-slate-600">Something went wrong while fetching the latest information. Please try again in a moment.</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={retry}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-blue px-6 py-3 font-semibold text-white hover:bg-brand-navy"
        >
          <RotateCw className="h-4 w-4" aria-hidden="true" />
          Try again
        </button>
        <Link href="/" className="rounded-md border-2 border-brand-blue px-6 py-3 font-semibold text-brand-blue hover:bg-brand-blue hover:text-white">
          Go to the homepage
        </Link>
      </div>
    </div>
  );
}
