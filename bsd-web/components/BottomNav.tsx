"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Store, Ticket, User } from "lucide-react";
import { NAV_KEYS, activeKey, navHref, showBottomNav, type NavKey } from "@/lib/bottom-nav";
import type { SiteKey } from "@/lib/site";

const ITEMS = {
  home: { label: "Home", Icon: Home },
  search: { label: "Search", Icon: Search },
  pass: { label: "Pass", Icon: Ticket },
  market: { label: "Market", Icon: Store },
  profile: { label: "Profile", Icon: User },
} satisfies Record<NavKey, { label: string; Icon: typeof Home }>;

const SAFE_HEIGHT = "h-[calc(4rem+env(safe-area-inset-bottom))]";

export default function BottomNav({ site }: { site: SiteKey }) {
  const pathname = usePathname();
  if (!showBottomNav(pathname)) return null;
  const active = activeKey(site, pathname);

  return (
    <>
      <div aria-hidden="true" className={`${SAFE_HEIGHT} lg:hidden print:hidden`} />
      <nav
        aria-label="App sections"
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden ${SAFE_HEIGHT}`}
      >
        <ul className="flex h-16 px-4">
          {NAV_KEYS.map((key) => {
            const { label, Icon } = ITEMS[key];
            const href = navHref(site, key);
            const isActive = key === active;
            const cls = `relative flex h-full min-h-11 w-full touch-manipulation select-none flex-col items-center justify-center gap-1 text-xs hover:text-bc-bar focus-visible:outline-offset-[-3px] motion-safe:transition-colors active:bg-slate-100 ${
              isActive ? "font-semibold text-bc-bar" : "text-slate-600"
            }`;
            const inner = (
              <>
                {isActive && <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-bc-bar" />}
                <Icon aria-hidden="true" className="h-6 w-6" />
                <span>{label}</span>
              </>
            );
            return (
              <li key={key} className="flex flex-1">
                {href.startsWith("/") ? (
                  <Link href={href} aria-current={isActive ? "page" : undefined} className={cls}>
                    {inner}
                  </Link>
                ) : (
                  <a href={href} aria-current={isActive ? "page" : undefined} className={cls}>
                    {inner}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
