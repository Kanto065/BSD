"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { BadgeCheck, ClipboardList, FileClock, Inbox, KeyRound, LayoutDashboard, Loader2, LogOut, MessageSquare, Users } from "lucide-react";
import { atLeast, useSession, type Role } from "@/lib/admin-session";

const NAV: { href: string; label: string; icon: typeof LayoutDashboard; minimum: Role }[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, minimum: "VOLUNTEER" },
  { href: "/admin/listings", label: "Listings", icon: ClipboardList, minimum: "MODERATOR" },
  { href: "/admin/verification", label: "Verification", icon: BadgeCheck, minimum: "VOLUNTEER" },
  { href: "/admin/claims", label: "Claims", icon: Inbox, minimum: "MODERATOR" },
  { href: "/admin/messages", label: "Messages", icon: MessageSquare, minimum: "MODERATOR" },
  { href: "/admin/audit", label: "Audit log", icon: FileClock, minimum: "ADMIN" },
  { href: "/admin/users", label: "Team", icon: Users, minimum: "SUPER_ADMIN" },
  { href: "/admin/password", label: "Change password", icon: KeyRound, minimum: "VOLUNTEER" },
];

const ROLE_LABEL: Record<Role, string> = { SUPER_ADMIN: "Super Admin", ADMIN: "Admin", MODERATOR: "Moderator", VOLUNTEER: "Volunteer" };

/** Signs people in, forces a first-time password change, and shows the admin navigation for their role. */
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const { status, admin, signOut } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const onLogin = pathname === "/admin/login";
  const onPassword = pathname === "/admin/password";

  useEffect(() => {
    if (status === "signed-out" && !onLogin) router.replace("/admin/login");
    if (status === "signed-in" && onLogin) router.replace("/admin");
    if (status === "signed-in" && admin?.mustChangePassword && !onPassword) router.replace("/admin/password");
  }, [status, admin, onLogin, onPassword, router]);

  if (onLogin) return <div className="min-h-screen bg-slate-50">{children}</div>;
  if (status !== "signed-in" || !admin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500" role="status">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" /> Loading
      </div>
    );
  }

  const links = admin.mustChangePassword ? [] : NAV.filter((n) => atLeast(admin.role, n.minimum));
  const active = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-brand-navy text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/admin" className="font-heading text-lg font-bold">
            BSD Admin
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden sm:inline">
              {admin.name} <span className="text-slate-300">({ROLE_LABEL[admin.role]})</span>
            </span>
            <button
              type="button"
              onClick={async () => {
                await signOut();
                router.replace("/admin/login");
              }}
              className="inline-flex items-center gap-1 hover:underline"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row">
        {links.length > 0 && (
          <nav aria-label="Admin" className="flex gap-1 overflow-x-auto lg:w-52 lg:shrink-0 lg:flex-col">
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                aria-current={active(href) ? "page" : undefined}
                className={`inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold ${
                  active(href) ? "bg-white text-brand-navy shadow-sm" : "text-slate-600 hover:bg-white"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </Link>
            ))}
          </nav>
        )}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
