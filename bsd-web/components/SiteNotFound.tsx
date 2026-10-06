import type { SiteInfo } from "@/lib/site";
import { SiteBar } from "@/components/SitePlaceholder";

export default function SiteNotFound({ site }: { site: SiteInfo }) {
  return (
    <>
      <SiteBar site={site} />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-16">
        <h1 className="font-heading text-3xl font-bold" style={{ color: site.themeColor }}>
          Page not found
        </h1>
        <div className="mt-8 flex flex-wrap gap-3 text-sm font-semibold">
          <a href="/" className="rounded-md px-4 py-2.5 text-white" style={{ background: site.themeColor }}>
            {site.name} home
          </a>
          <a href="https://bsd.wales" className="rounded-md border border-slate-300 px-4 py-2.5 hover:bg-slate-50">
            Back to BSD Directory
          </a>
        </div>
      </main>
    </>
  );
}
