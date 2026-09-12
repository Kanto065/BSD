import Link from "next/link";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/categories", label: "Browse Categories" },
  { href: "/submit", label: "Submit Listing" },
  { href: "/transparency", label: "Transparency" },
  { href: "/legal", label: "Legal" },
  { href: "/privacy", label: "Privacy" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
          {LINKS.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-teal">
              {item.label}
            </Link>
          ))}
        </nav>
        <p className="mt-6 text-sm font-medium text-slate-700">
          Powered by BayConnect — Connect. Celebrate. Empower.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          © {year} BSD – Bangladeshi Business & Service Directory. All Rights Reserved.
        </p>
      </div>
    </footer>
  );
}
