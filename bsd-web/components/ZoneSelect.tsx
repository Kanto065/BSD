import { ALL_ZONES_LABEL, ZONES, zoneShortLabel } from "@/lib/content";

/** The one zone dropdown for home and search: All Zones, then Zone 1 to 3. The value is the zone slug, empty for all. */
export default function ZoneSelect({ id, name, defaultValue = "", className }: { id: string; name: string; defaultValue?: string; className?: string }) {
  return (
    <select id={id} name={name} defaultValue={defaultValue} className={className}>
      <option value="">{ALL_ZONES_LABEL}</option>
      {ZONES.map((z) => (
        <option key={z.slug} value={z.slug}>
          {zoneShortLabel(z)}
        </option>
      ))}
    </select>
  );
}
