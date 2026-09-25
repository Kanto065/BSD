import type { Metadata } from "next";
import AdminShell from "@/components/admin/AdminShell";
import { SessionProvider } from "@/lib/admin-session";
import { publicApiBase } from "@/lib/api";

export const metadata: Metadata = {
  title: { absolute: "BSD Admin" },
  robots: { index: false, follow: false, nocache: true },
};

// Rendered per request so the browser gets the API address of the running deployment.
export const dynamic = "force-dynamic";

// The admin area. Every page below is a client page that talks to the admin API with the signed-in person's token.
// The API decides what each role may do; these pages only hide what a role cannot use.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider apiBase={publicApiBase()}>
      <AdminShell>{children}</AdminShell>
    </SessionProvider>
  );
}
