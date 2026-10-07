"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { BadgeCheck, ClipboardList, GraduationCap, ExternalLink, Globe, FilePen, FolderTree, FileClock, Inbox, Languages, KeyRound, LayoutDashboard, LogOut, MessageSquare, Store, Users } from "lucide-react";
import { atLeast, useSession, type Role } from "@/lib/admin-session";
import { Skeleton, useAdminData } from "@/components/admin/ui";

type Counts = {
  listings: Record<string, number>;
  verificationQueue: number;
  pendingClaims: number;
  openMessages: number;
  pendingUpdates: number;
  pendingRemovals: number;
  pendingStudents: number;
  market: number;
};

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; minimum: Role; count?: (c: Counts) => number };

// Grouped so the review queues sit together. Labels and routes are unchanged from the flat list.
const NAV: { group: string; items: NavItem[] }[] = [
  { group: "Overview", items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard, minimum: "VOLUNTEER" }] },
  {
    group: "Review",
    items: [
      { href: "/admin/listings", label: "Listings", icon: ClipboardList, minimum: "MODERATOR", count: (c) => c.listings.PENDING ?? 0 },
      { href: "/admin/verification", label: "Verification", icon: BadgeCheck, minimum: "VOLUNTEER", count: (c) => c.verificationQueue },
      { href: "/admin/requests", label: "Update & removal", icon: FilePen, minimum: "MODERATOR", count: (c) => c.pendingUpdates + c.pendingRemovals },
      { href: "/admin/claims", label: "Claims", icon: Inbox, minimum: "MODERATOR", count: (c) => c.pendingClaims },
      { href: "/admin/students", label: "Students", icon: GraduationCap, minimum: "MODERATOR", count: (c) => c.pendingStudents },
      { href: "/admin/messages", label: "Messages", icon: MessageSquare, minimum: "MODERATOR", count: (c) => c.openMessages },
      { href: "/admin/market", label: "Market", icon: Store, minimum: "MODERATOR", count: (c) => c.market },
    ],
  },
  { group: "Directory", items: [{ href: "/admin/categories", label: "Categories", icon: FolderTree, minimum: "ADMIN" },
      { href: "/admin/site", label: "Site", icon: Globe, minimum: "ADMIN" },
      { href: "/admin/synonyms", label: "Search synonyms", icon: Languages, minimum: "ADMIN" },
    ] },
  {
    group: "Account",
    items: [
      { href: "/admin/audit", label: "Audit log", icon: FileClock, minimum: "ADMIN" },
      { href: "/admin/users", label: "Team", icon: Users, minimum: "SUPER_ADMIN" },
      { href: "/admin/password", label: "Change password", icon: KeyRound, minimum: "VOLUNTEER" },
    ],
  },
];

const ROLE_LABEL: Record<Role, string> = { SUPER_ADMIN: "Super Admin", ADMIN: "Admin", MODERATOR: "Moderator", VOLUNTEER: "Volunteer" };

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

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

  // Queue sizes for the sidebar. Refreshed on every page change so a cleared queue drops its number.
  const ready = status === "signed-in" && !!admin && !admin.mustChangePassword && !onLogin;
  const { data: dash, reload } = useAdminData<Omit<Counts, "market">>(ready ? "/dashboard" : null);
  const { data: mk, reload: reloadMk } = useAdminData<{ pending: number; reported: number; openTickets: number }>(ready && atLeast(admin?.role, "MODERATOR") ? "/market/counts" : null);
  const counts: Counts | null = dash ? { ...dash, market: mk ? mk.pending + mk.reported + mk.openTickets : 0 } : null;
  useEffect(() => {
    const f = () => void reloadMk();
    window.addEventListener("market-counts-changed", f);
    return () => window.removeEventListener("market-counts-changed", f);
  }, [reloadMk]);
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (!ready || lastPath.current === pathname) return;
    lastPath.current = pathname;
    void reload();
    void reloadMk();
  }, [pathname, ready, reload, reloadMk]);

  if (onLogin) return <div className="min-h-screen bg-slate-50">{children}</div>;
  if (status !== "signed-in" || !admin) return <ShellSkeleton />;

  const groups = admin.mustChangePassword
    ? []
    : NAV.map((g) => ({ ...g, items: g.items.filter((n) => atLeast(admin.role, n.minimum)) })).filter((g) => g.items.length > 0);
  const active = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
  const badge = (item: NavItem) => (counts && item.count ? item.count(counts) : 0);

  const handleSignOut = async () => {
    await signOut();
    router.replace("/admin/login");
  };

  return (
    <div className="min-h-screen bg-slate-50 lg:pl-64">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-brand-navy text-white lg:flex">
        <Link href="/admin" className="flex items-center gap-3 px-6 pb-6 pt-7">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-teal font-heading text-sm font-bold">BSD</span>
          <span className="leading-tight">
            <span className="block font-heading text-base font-bold">BSD Wales</span>
            <span className="block text-xs text-slate-300">Admin panel</span>
          </span>
        </Link>
        <nav aria-label="Admin" className="flex-1 space-y-6 overflow-y-auto px-3 pb-6">
          {groups.map((g) => (
            <div key={g.group}>
              <p className="px-3 pb-2 text-xs font-semibold text-slate-400">{g.group}</p>
              <ul className="space-y-0.5">
                {g.items.map((item) => {
                  const on = active(item.href);
                  const n = badge(item);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={on ? "page" : undefined}
                        className={`group relative flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                          on ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        {on && <span aria-hidden="true" className="absolute inset-y-1.5 left-0 w-1 rounded-full bg-brand-teal" />}
                        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="flex-1 truncate">{item.label}</span>
                        {n > 0 && (
                          <span className="rounded-full bg-brand-teal px-2 py-0.5 text-xs font-semibold tabular-nums text-white">
                            {n}
                            <span className="sr-only"> waiting</span>
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold">{initials(admin.name)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{admin.name}</p>
              <p className="truncate text-xs text-slate-300">{ROLE_LABEL[admin.role]}</p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white active:scale-95"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Sign out</span>
            </button>
          </div>
          <a href="/" target="_blank" rel="noreferrer" className="mt-1 inline-flex min-h-11 items-center gap-1.5 px-1 text-xs text-slate-300 hover:text-white">
            View live site <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        </div>
      </aside>

      {/* Phone and tablet top bar */}
      <header className="sticky top-0 z-30 bg-brand-navy text-white lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <Link href="/admin" className="flex min-h-11 items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-teal font-heading text-xs font-bold">BSD</span>
            <span className="font-heading text-sm font-bold">Admin</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="max-w-[40vw] truncate text-xs text-slate-300">
              {admin.name} ({ROLE_LABEL[admin.role]})
            </span>
            <button type="button" onClick={handleSignOut} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-200 hover:bg-white/10" title="Sign out">
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Sign out</span>
            </button>
          </div>
        </div>
        {groups.length > 0 && (
          <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-3 pb-3 [scrollbar-width:none]">
            {groups.flatMap((g) => g.items).map((item) => {
              const on = active(item.href);
              const n = badge(item);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={on ? "page" : undefined}
                  className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${on ? "bg-white text-brand-navy" : "text-slate-200 hover:bg-white/10"}`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                  {n > 0 && <span className={`rounded-full px-1.5 text-xs font-semibold tabular-nums ${on ? "bg-brand-navy text-white" : "bg-brand-teal text-white"}`}>{n}</span>}
                </Link>
              );
            })}
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</main>
    </div>
  );
}

/** Shown while the session is checked, shaped like the real layout so nothing jumps when it loads. */
function ShellSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 lg:pl-64" role="status" aria-label="Loading">
      <div className="fixed inset-y-0 left-0 hidden w-64 bg-brand-navy lg:block" />
      <div className="h-14 bg-brand-navy lg:hidden" />
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
        <div className="grid gap-4 pt-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
