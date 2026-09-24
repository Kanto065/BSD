import ZonePage, { zoneMetadata } from "@/components/ZonePage";
import { ZONES } from "@/lib/content";

const zone = ZONES[1];

export const metadata = zoneMetadata(zone);

export default function Zone2Page() {
  return <ZonePage zone={zone} />;
}
