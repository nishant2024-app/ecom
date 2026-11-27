/** A point saved with an address so the delivery partner can navigate to the door. */
export interface GeoPoint {
  lat: number;
  lng: number;
  /** Reported GPS accuracy radius in metres (device locations only). */
  accuracyM?: number | null;
  /** 'device' = browser/phone GPS; 'map_pin' = customer placed or moved the pin. */
  source: 'device' | 'map_pin';
}

/** Rough bounding box of India including islands. Rejects swapped or default (0,0) coordinates. */
export function isInIndia(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 6 && lat <= 37.6 && lng >= 68 && lng <= 97.5;
}

/** Store 6 decimals (~11 cm); more is noise. */
export const roundCoord = (n: number) => Math.round(n * 1e6) / 1e6;

/** Opens turn-by-turn navigation in Google Maps (app on phones, web on desktop). */
export const directionsUrl = (lat: number, lng: number) => `https://www.google.com/maps/dir/?api=1&destination=${roundCoord(lat)},${roundCoord(lng)}`;
