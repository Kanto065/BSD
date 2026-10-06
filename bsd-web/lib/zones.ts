import { ZONES } from "./content";

const ALL = ZONES.map((z) => z.slug as string);

/** The "All Zones" box is derived from the zone list, never stored. */
export type AllZonesState = "all" | "some" | "none";

export function allZonesState(current: string[]): AllZonesState {
  const n = ALL.filter((s) => current.includes(s)).length;
  return n === 0 ? "none" : n === ALL.length ? "all" : "some";
}

/** All becomes none, none or some becomes all. Other values in the list are kept. */
export function toggleAllZones(current: string[]): string[] {
  const rest = current.filter((s) => !ALL.includes(s));
  return allZonesState(current) === "all" ? rest : [...ALL, ...rest];
}
