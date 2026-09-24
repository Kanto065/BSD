import ZonePage, { zoneMetadata } from "@/components/ZonePage";
import { ZONES } from "@/lib/content";

const zone = ZONES[0];

export const metadata = zoneMetadata(zone);

export default function Zone1Page() {
  return <ZonePage zone={zone} />;
}
