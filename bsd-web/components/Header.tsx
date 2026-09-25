"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Globe, Handshake, Menu, Plus, X, Zap } from "lucide-react";
import Logo from "@/components/Logo";

// Top utility bar (Homepage Header doc, section 1).
const UTILITY = [
  { href: "/free-access", label: "Free Access Policy", icon: Globe },
  { href: "/community-initiative", label: "Community Initiative", icon: Handshake },
  { href: "/bayconnect", label: "Powered by BayConnect", icon: Zap },
];

// Header navigation (Homepage Header doc): Home | Directory | Coverage Area | About Us | FAQ | Contact.
const NAV = [
  { href: "/", label: "Home" },
  { href: "/categories", label: "Directory" },
  { href: "/coverage-area", label: "Coverage Area" },
  { href: "/about", label: "About Us" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <header className="bg-white">
      {/* On phones these links move into the menu (below), where they are easier to tap. */}
      <div className="hidden bg-brand-navy text-white sm:block">
        <nav
          aria-label="Utility"
          className="mx-auto flex max-w-6xl flex-wrap items-center justify-end gap-x-6 gap-y-1 px-6 py-2 text-xs font-medium"
        >
          {UTILITY.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="inline-flex items-center gap-1.5 hover:underline">
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="border-b border-slate-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" onClick={() => setOpen(false)} aria-label="BSD home" className="shrink-0">
            <Logo className="h-10 sm:h-12" priority />
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-6 text-sm font-semibold text-brand-navy lg:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={`border-b-2 py-1 hover:text-brand-blue ${
                  isActive(item.href) ? "border-brand-teal text-brand-blue" : "border-transparent"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/submit"
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-brand-blue px-3 py-2 text-sm font-semibold text-white hover:bg-brand-navy sm:px-4"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Submit Listing
            </Link>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              aria-controls="mobile-menu"
              className="rounded-md p-2.5 text-brand-navy hover:bg-slate-100 lg:hidden"
            >
              {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {open && (
          <nav
            id="mobile-menu"
            aria-label="Mobile"
            className="flex flex-col gap-1 border-t border-slate-200 px-4 py-3 text-sm font-semibold text-brand-navy lg:hidden"
          >
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={`rounded-md px-2 py-3 text-base hover:bg-slate-100 ${isActive(item.href) ? "bg-slate-100 text-brand-blue" : ""}`}
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 border-t border-slate-200 pt-2">
              {UTILITY.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-md px-2 py-3 font-medium text-slate-600 hover:bg-slate-100"
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </Link>
              ))}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
