import type { SiteInfo } from "@/lib/site";

export function SiteBar({ site }: { site: SiteInfo }) {
  return (
    <header style={{ background: site.themeColor }} className="px-4 py-3 text-sm font-semibold text-white">
      {site.name}
    </header>
  );
}

export default function SitePlaceholder({ site }: { site: SiteInfo }) {
  return (
    <>
      <SiteBar site={site} />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-16">
        <h1 className="font-heading text-3xl font-bold" style={{ color: site.themeColor }}>
          {site.name}
        </h1>
        <p className="mt-4 text-slate-700">Coming soon. {site.description}</p>
        <div className="mt-8 flex flex-wrap gap-3 text-sm font-semibold">
          <a href="https://bsd.wales" className="rounded-md border border-slate-300 px-4 py-2.5 hover:bg-slate-50">
            Back to BSD Directory
          </a>
          <a
            href="https://bsd.wales/account"
            className="rounded-md px-4 py-2.5 text-white"
            style={{ background: site.themeColor }}
          >
            Sign in
          </a>
        </div>
      </main>
    </>
  );
}
