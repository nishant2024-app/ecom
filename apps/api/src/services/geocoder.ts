import { isInIndia } from '@dairy/core';
import type { Config } from '../config';
import type { Kv } from './kv';

export interface ReverseResult {
  /** Road / locality / suburb, to prefill "Area, street". */
  area: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  /** Full place name from the provider, for display only. */
  label: string | null;
}

export interface Geocoder {
  name: string;
  reverse(lat: number, lng: number): Promise<ReverseResult | null>;
}

/**
 * OpenStreetMap Nominatim (or a compatible server such as a self-hosted Nominatim).
 * The public server allows light use only (max 1 request/second, identify the app); results are cached
 * for 30 days per ~11 m grid cell. At scale, point GEOCODER_URL at a self-hosted instance (docs/16-location.md).
 */
export function createNominatim(config: Config, kv: Kv, fetchImpl: typeof fetch = fetch): Geocoder {
  const base = config.GEOCODER_URL.replace(/\/$/, '');
  const ua = `DairyStore/1.0 (${config.PUBLIC_WEB_URL}${config.GEOCODER_EMAIL ? `; ${config.GEOCODER_EMAIL}` : ''})`;
  return {
    name: 'nominatim',
    async reverse(lat, lng) {
      if (!isInIndia(lat, lng)) return null;
      const key = `geo:rev:${lat.toFixed(4)},${lng.toFixed(4)}`;
      const cached = await kv.get(key);
      if (cached) return JSON.parse(cached) as ReverseResult;
      const url = `${base}/reverse?format=jsonv2&addressdetails=1&zoom=18&accept-language=en&lat=${lat}&lon=${lng}${config.GEOCODER_EMAIL ? `&email=${encodeURIComponent(config.GEOCODER_EMAIL)}` : ''}`;
      const res = await fetchImpl(url, { headers: { 'user-agent': ua, accept: 'application/json' }, signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`geocoder ${res.status}`);
      const body = (await res.json()) as { display_name?: string; address?: Record<string, string> };
      const a = body.address ?? {};
      const area = [a.house_number && a.road ? `${a.house_number} ${a.road}` : a.road, a.neighbourhood ?? a.suburb ?? a.quarter ?? a.residential].filter(Boolean).join(', ') || null;
      const pin = (a.postcode ?? '').replace(/\s/g, '');
      const out: ReverseResult = {
        area,
        city: a.city ?? a.town ?? a.village ?? a.municipality ?? a.city_district ?? a.county ?? a.state_district ?? null,
        state: a.state ?? null,
        pincode: /^[1-9]\d{5}$/.test(pin) ? pin : null,
        label: body.display_name ?? null,
      };
      await kv.set(key, JSON.stringify(out), 30 * 24 * 3600);
      return out;
    },
  };
}

/** Used when GEOCODER_URL is "off": the customer types the address and only the pin is saved. */
export const noGeocoder: Geocoder = { name: 'off', reverse: async () => null };
