import PassApp from "@/components/card/PassApp";
import PassPage from "@/components/card/PassPage";
import VisitorHero from "@/components/card/VisitorHero";
import { publicApiBase } from "@/lib/api";
import { SITES } from "@/lib/site";

// Rendered per request so the browser gets the API address of the running deployment.
export const dynamic = "force-dynamic";

// Signed in members see their pass here. Visitors see the hero.
export default function Page() {
  const apiBase = publicApiBase();
  return (
    <PassPage label={SITES.card.name}>
      <PassApp apiBase={apiBase} fallback={<VisitorHero apiBase={apiBase} />} />
    </PassPage>
  );
}
