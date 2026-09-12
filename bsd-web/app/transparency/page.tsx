import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Community Transparency",
  description:
    "BSD is a free community initiative until 30 June 2027. No listing fees, sponsorships, or advertisements are accepted.",
  alternates: { canonical: "/transparency" },
};

export default function TransparencyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold text-slate-900">Community Transparency</h1>
      <p className="mt-6 text-slate-600">
        BSD Directory is a free community initiative operating on a test basis until 30 June 2027. No listing fee,
        sponsorship or advertisement is accepted. Future premium services may be introduced after essential
        preparations and formalities.
      </p>

      <ul className="mt-6 list-disc space-y-1 pl-5 text-slate-600">
        <li>Free period — no cost to be listed until 30 June 2027</li>
        <li>No sponsorship</li>
        <li>No advertisements</li>
        <li>No listing fee</li>
        <li>Future premium plan may follow after 30 June 2027, with public notice in advance</li>
      </ul>

      <div className="mt-10">
        <Link href="/legal" className="font-semibold text-teal hover:underline">
          Full Legal Disclaimer →
        </Link>
      </div>
    </div>
  );
}
