import Link from "next/link";

const NAV = [
  { href: "/categories", label: "Categories" },
  { href: "/coverage-area", label: "Coverage Area" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

export default function Header() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="text-lg font-bold text-teal">
          BSD <span className="font-normal text-slate-500">Swansea Bay</span>
        </Link>
        <nav className="hidden gap-6 text-sm font-medium text-slate-700 md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-teal">
              {item.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/submit"
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
        >
          Submit Listing
        </Link>
      </div>
    </header>
  );
}
