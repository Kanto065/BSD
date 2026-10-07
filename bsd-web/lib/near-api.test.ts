import { describe, expect, it } from "vitest";
import { FALLBACK_POINT, hiddenLine, nearPath, pinsPath, pinsToBounds, pointFromPostcode, RADIUS_CHOICES } from "./near-api";

describe("near helpers", () => {
  it("offers exactly 1, 5 and 10 miles", () => {
    expect(RADIUS_CHOICES.map((r) => r.label)).toEqual(["1 Mile", "5 Miles", "10 Miles"]);
  });
  it("resolves BSD postcodes to a district centre", () => {
    expect(pointFromPostcode("SA1 4PE")).toEqual(FALLBACK_POINT);
    expect(pointFromPostcode("sa10")).not.toBeNull();
    expect(pointFromPostcode("CF10 1AA")).toBeNull();
    expect(pointFromPostcode("SA99 1AA")).toBeNull();
    expect(pointFromPostcode("")).toBeNull();
  });
  it("builds paths with rounded coordinates and filters", () => {
    expect(nearPath({ lat: 51.62671, lng: -3.94041 }, 5, { q: "cafe", category: "food" })).toBe(
      "businesses/near?lat=51.627&lng=-3.940&miles=5&pageSize=50&q=cafe&category=food",
    );
    expect(pinsPath()).toBe("businesses/map-pins");
    expect(pinsPath({ zone: "zone-1", q: "a b" })).toBe("businesses/map-pins?zone=zone-1&q=a+b");
  });
  it("bounds the pins", () => {
    const f = (lng: number, lat: number) => ({ geometry: { coordinates: [lng, lat] as [number, number] }, properties: { id: "", slug: "", name: "", categoryName: "", verificationStatus: "" } });
    expect(pinsToBounds([])).toBeNull();
    expect(pinsToBounds([f(-3.9, 51.6), f(-4.1, 51.7)])).toEqual([[51.6, -4.1], [51.7, -3.9]]);
  });
  it("words the hidden count", () => {
    expect(hiddenLine(1)).toBe("1 business hides their exact location and is only in the list");
    expect(hiddenLine(3)).toBe("3 businesses hide their exact location and are only in the list");
  });
});
