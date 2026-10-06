import type { SiteInfo } from "@/lib/site";
import { SITES } from "@/lib/site";
import { SiteLinks, SiteShell } from "@/components/SitePlaceholder";

export default function SiteNotFound({ site }: { site: SiteInfo }) {
  const solid = site === SITES.card ? "#0F766E" : "#005A8C";
  return (
    <SiteShell site={site}>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 py-10 sm:px-6 md:py-16">
        <div className="motion-safe:animate-rise">
          <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">Page not found</h1>
          <div className="mt-8">
            <SiteLinks>
              <a
                href="/"
                className="inline-flex min-h-[44px] touch-manipulation select-none items-center rounded-full px-5 text-white ring-1 ring-white/20 focus-visible:outline-white motion-safe:transition-transform motion-safe:duration-150 active:scale-[0.98]"
                style={{ background: solid }}
              >
                {site.name} home
              </a>
            </SiteLinks>
          </div>
        </div>
      </main>
    </SiteShell>
  );
}
