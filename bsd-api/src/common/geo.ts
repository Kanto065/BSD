// Pure geography helpers for Near Me and the map. No database, no network.

/** Centre of each BSD postcode district (SA1 to SA20, SA31 to SA34), from the public postcodes.io outcode endpoint. */
export const DISTRICT_CENTRES: Readonly<Record<string, readonly [number, number]>> = {
  SA1: [51.6267, -3.9404],
  SA2: [51.619, -3.9982],
  SA3: [51.5811, -4.0525],
  SA4: [51.6732, -4.0482],
  SA5: [51.649, -3.9712],
  SA6: [51.6763, -3.9225],
  SA7: [51.6647, -3.8881],
  SA8: [51.7218, -3.8477],
  SA9: [51.7814, -3.7688],
  SA10: [51.6879, -3.8005],
  SA11: [51.6749, -3.7614],
  SA12: [51.6082, -3.7958],
  SA13: [51.6059, -3.7249],
  SA14: [51.7355, -4.1062],
  SA15: [51.6997, -4.1679],
  SA16: [51.6893, -4.2576],
  SA17: [51.7565, -4.2849],
  SA18: [51.7978, -3.9609],
  SA19: [51.9549, -3.9479],
  SA20: [52.0118, -3.7878],
  SA31: [51.8569, -4.3084],
  SA32: [51.888, -4.1697],
  SA33: [51.8496, -4.4408],
  SA34: [51.852, -4.6191],
};

/** SA1 Swansea City Centre, the point the web sends when GPS is denied or outside the area. */
export const DEFAULT_CENTRE = DISTRICT_CENTRES.SA1!;

/** A generous box round Wales. Anything outside it is not a Near Me search the directory can answer. */
export const WALES_BOX = { minLat: 51.3, maxLat: 53.5, minLng: -5.5, maxLng: -2.6 } as const;

export function inWalesBox(lat: number, lng: number): boolean {
  return lat >= WALES_BOX.minLat && lat <= WALES_BOX.maxLat && lng >= WALES_BOX.minLng && lng <= WALES_BOX.maxLng;
}

const EARTH_MILES = 3958.8;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineMiles(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Latitude and longitude limits that contain every point within `miles` of the centre. */
export function bboxFor(lat: number, lng: number, miles: number) {
  const dLat = (miles / EARTH_MILES) * (180 / Math.PI);
  const dLng = dLat / Math.max(0.01, Math.cos(rad(lat)));
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng };
}

/** One decimal place, as shown on cards. */
export const roundMiles = (m: number) => Math.round(m * 10) / 10;

/** Outward codes whose centre lies within `miles` of the point. */
export function districtsWithin(lat: number, lng: number, miles: number): string[] {
  return Object.entries(DISTRICT_CENTRES)
    .filter(([, [dLat, dLng]]) => haversineMiles(lat, lng, dLat, dLng) <= miles)
    .map(([d]) => d);
}
