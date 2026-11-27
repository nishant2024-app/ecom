'use client';

import 'leaflet/dist/leaflet.css';
import type { Map as LeafletMap } from 'leaflet';
import { useEffect, useRef, useState } from 'react';

export interface PickedLocation {
  lat: number;
  lng: number;
  accuracyM: number | null;
  source: 'device' | 'map_pin';
}

const TILES = process.env.NEXT_PUBLIC_MAP_TILES_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const INDIA_CENTER: [number, number] = [18.5204, 73.8567]; // Pune

/**
 * Map with a fixed pin in the centre: the customer drags the map until the pin sits on their door.
 * Starts from the phone's GPS when allowed. Reports the point on every move (debounce in the parent).
 */
export function LocationPicker({ value, onChange }: { value: PickedLocation | null; onChange: (l: PickedLocation) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const circle = useRef<import('leaflet').Circle | null>(null);
  const programmatic = useRef(false);
  const [status, setStatus] = useState<'idle' | 'locating' | 'denied' | 'unavailable'>('idle');
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let cancelled = false;
    void import('leaflet').then((L) => {
      if (cancelled || !box.current || map.current) return;
      const start: [number, number] = value ? [value.lat, value.lng] : INDIA_CENTER;
      const m = L.map(box.current, { center: start, zoom: value ? 18 : 12, zoomControl: true, attributionControl: true });
      L.tileLayer(TILES, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(m);
      m.on('moveend', () => {
        if (programmatic.current) {
          programmatic.current = false;
          return;
        }
        const c = m.getCenter();
        circle.current?.remove();
        circle.current = null;
        onChangeRef.current({ lat: c.lat, lng: c.lng, accuracyM: null, source: 'map_pin' });
      });
      map.current = m;
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function locate() {
    if (!('geolocation' in navigator)) return setStatus('unavailable');
    setStatus('locating');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const L = await import('leaflet');
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        setStatus('idle');
        const m = map.current;
        if (m) {
          programmatic.current = true;
          m.setView([lat, lng], accuracy > 200 ? 16 : 18);
          circle.current?.remove();
          circle.current = L.circle([lat, lng], { radius: accuracy, color: '#17803d', weight: 1, fillOpacity: 0.12 }).addTo(m);
        }
        onChange({ lat, lng, accuracyM: Math.round(accuracy), source: 'device' });
      },
      (err) => setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  return (
    <div>
      <div className="relative overflow-hidden rounded-4 border border-rule">
        <div ref={box} className="h-[260px] w-full md:h-[300px]" role="application" aria-label="Map. Drag the map so the pin is on your door." />
        {/* Fixed centre pin */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-[500] -translate-x-1/2 -translate-y-full" aria-hidden>
          <svg width="36" height="46" viewBox="0 0 36 46">
            <path d="M18 45s15-15.4 15-27A15 15 0 0 0 3 18c0 11.6 15 27 15 27Z" fill="#17803d" stroke="#fff" strokeWidth="2.5" />
            <circle cx="18" cy="18" r="6" fill="#fff" />
          </svg>
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-2 z-[500] text-center">
          <span className="rounded-pill bg-paper/95 px-3 py-1 text-[12px] font-semibold shadow-card">Move the map to place the pin on your door</span>
        </div>
        <button type="button" onClick={locate} disabled={status === 'locating'} className="absolute bottom-3 left-1/2 z-[500] flex h-11 -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-pill bg-paper px-4 text-[14px] font-semibold text-forest shadow-float disabled:opacity-70">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>
          {status === 'locating' ? 'Finding you…' : 'Use my current location'}
        </button>
      </div>
      {status === 'denied' && <p role="alert" className="mt-2 text-[13px] text-alert">Location permission is off. Allow it in your browser settings, or move the map to your address.</p>}
      {status === 'unavailable' && <p role="alert" className="mt-2 text-[13px] text-alert">Could not get your location. Move the map to your address instead.</p>}
      {value?.source === 'device' && value.accuracyM != null && value.accuracyM > 100 && (
        <p className="mt-2 text-[13px] text-ink-2">Your phone located you within about {value.accuracyM} m. Drag the map to put the pin exactly on your building.</p>
      )}
    </div>
  );
}
