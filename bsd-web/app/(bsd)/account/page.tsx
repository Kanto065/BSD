import type { Metadata } from "next";
import AccountForm from "@/components/AccountForm";
import { publicApiBase } from "@/lib/api";

export const metadata: Metadata = {
  title: "Your Account",
  description: "One BSD account for the directory, the Privilege Pass and the Marketplace.",
  robots: { index: false, follow: false },
};

// Rendered per request so the browser gets the API address of the running deployment.
export const dynamic = "force-dynamic";

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <AccountForm apiBase={publicApiBase()} />
    </div>
  );
}
