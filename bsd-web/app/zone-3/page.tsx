import ZonePage, { zoneMetadata } from "@/components/ZonePage";
import { listingsForZone } from "@/lib/api";
import { ZONES } from "@/lib/content";

// Prerendered, then refreshed from the API at most once a minute.
export const revalidate = 60;

const zone = ZONES[2];

export const metadata = zoneMetadata(zone);

export default async function Zone3Page() {
  return <ZonePage zone={zone} listings={await listingsForZone(zone.slug)} />;
}
