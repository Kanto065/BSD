import ZonePage, { zoneMetadata } from "@/components/ZonePage";
import { listingsForZone } from "@/lib/api";
import { ZONES } from "@/lib/content";

// Rendered on every visit with fresh data from the API, so a listing approved, edited or removed in the admin panel
// shows up straight away (no cached copy on the server or in the browser).
export const dynamic = "force-dynamic";

const zone = ZONES[2];

export const metadata = zoneMetadata(zone);

export default async function Zone3Page() {
  return <ZonePage zone={zone} listings={await listingsForZone(zone.slug)} />;
}
