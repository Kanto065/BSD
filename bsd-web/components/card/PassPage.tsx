import { SiteShell } from "@/components/SitePlaceholder";
import { SITES } from "@/lib/site";

/** Shell and column for the pass pages. Narrow on purpose, the pass is a phone screen. */
export default function PassPage({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <SiteShell site={SITES.card}>
      <main aria-label={label} className="mx-auto w-full max-w-md flex-1 px-4 pb-8 pt-2 sm:px-6">
        {children}
      </main>
    </SiteShell>
  );
}
