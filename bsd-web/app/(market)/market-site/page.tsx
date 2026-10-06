import SitePlaceholder from "@/components/SitePlaceholder";
import { publicApiBase } from "@/lib/api";
import { SITES } from "@/lib/site";

// Rendered per request so the browser gets the API address of the running deployment.
export const dynamic = "force-dynamic";

export default function Page() {
  return <SitePlaceholder site={SITES.market} apiBase={publicApiBase()} />;
}
