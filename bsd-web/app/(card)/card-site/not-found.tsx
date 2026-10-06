import SiteNotFound from "@/components/SiteNotFound";
import { SITES } from "@/lib/site";

export default function NotFound() {
  return <SiteNotFound site={SITES.card} />;
}
