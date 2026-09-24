import ZonePage, { zoneMetadata } from "@/components/ZonePage";
import { ZONES } from "@/lib/content";

const zone = ZONES[2];

export const metadata = zoneMetadata(zone);

export default function Zone3Page() {
  return <ZonePage zone={zone} />;
}
