import { describe, it, expect } from "vitest";
import { ALL_ZONES_LABEL, ZONES, zoneShortLabel } from "./content";
import { allZonesState, toggleAllZones } from "./zones";

describe("zone labels", () => {
  it("lists All Zones then Zone 1, 2, 3", () => {
    expect(ALL_ZONES_LABEL).toBe("All Zones");
    expect(ZONES.map(zoneShortLabel)).toEqual(["Zone 1", "Zone 2", "Zone 3"]);
  });
});

describe("toggleAllZones", () => {
  it("none becomes all", () => expect(toggleAllZones([])).toEqual(["zone-1", "zone-2", "zone-3"]));
  it("all becomes none", () => expect(toggleAllZones(["zone-1", "zone-2", "zone-3"])).toEqual([]));
  it("some becomes all", () => expect(toggleAllZones(["zone-2"])).toEqual(["zone-1", "zone-2", "zone-3"]));
  it("reports the derived state", () => {
    expect(allZonesState([])).toBe("none");
    expect(allZonesState(["zone-3"])).toBe("some");
    expect(allZonesState(["zone-3", "zone-1", "zone-2"])).toBe("all");
  });
});
