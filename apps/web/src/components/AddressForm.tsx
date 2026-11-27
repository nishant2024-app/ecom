'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError } from '@/lib/api-client';
import type { Address } from '@/lib/types';
import type { PickedLocation } from './LocationPicker';

const LocationPicker = dynamic(() => import('./LocationPicker').then((m) => m.LocationPicker), {
  ssr: false,
  loading: () => <div className="h-[260px] animate-pulse rounded-4 bg-paper-2 md:h-[300px]" />,
});

const field = 'mt-1 h-12 w-full rounded-3 border border-rule bg-paper px-4 text-base focus:border-forest';

interface Suggestion {
  area: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  label: string | null;
}

/**
 * New delivery address. Step 1: pin the exact door on a map (GPS or drag) so the courier can navigate there.
 * Step 2: flat/floor/building and contact details. Map suggestions fill only fields the customer hasn't typed.
 */
export function AddressForm({ defaultName, onSaved, onCancel }: { defaultName?: string; onSaved: (a: Address) => void; onCancel?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loc, setLoc] = useState<PickedLocation | null>(null);
  const [hint, setHint] = useState<Suggestion | null>(null);
  const [label, setLabel] = useState('Home');
  const [v, setV] = useState({ name: defaultName ?? '', phone: '', line1: '', line2: '', landmark: '', city: '', pincode: '' });
  const touched = useRef(new Set<string>());
  const set = (k: keyof typeof v, value: string) => {
    touched.current.add(k);
    setV((x) => ({ ...x, [k]: value }));
  };

  // Ask the server what is at the pin (debounced) and prefill untouched fields.
  useEffect(() => {
    if (!loc) return;
    const t = setTimeout(() => {
      api<Suggestion>(`/v1/store/geo/reverse?lat=${loc.lat.toFixed(6)}&lng=${loc.lng.toFixed(6)}`)
        .then((s) => {
          setHint(s);
          setV((x) => ({
            ...x,
            line2: !touched.current.has('line2') && s.area ? s.area : x.line2,
            city: !touched.current.has('city') && s.city ? s.city : x.city,
            pincode: !touched.current.has('pincode') && s.pincode ? s.pincode : x.pincode,
          }));
        })
        .catch(() => setHint(null));
    }, 600);
    return () => clearTimeout(t);
  }, [loc]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const a = await api<Address>('/v1/store/me/addresses', {
        method: 'POST',
        body: JSON.stringify({
          name: v.name,
          phone: v.phone,
          line1: v.line1,
          line2: v.line2 || undefined,
          landmark: v.landmark || undefined,
          city: v.city,
          pincode: v.pincode,
          label: label || undefined,
          isDefault: true,
          location: loc ? { lat: loc.lat, lng: loc.lng, accuracyM: loc.accuracyM, source: loc.source } : undefined,
        }),
      });
      onSaved(a);
    } catch (err) {
      setError(err instanceof ApiError ? (err.problem.detail ?? err.problem.title) : 'Could not save the address');
    } finally {
      setBusy(false);
    }
  }

  const pinMismatch = hint?.pincode && v.pincode.length === 6 && hint.pincode.slice(0, 3) !== v.pincode.slice(0, 3);

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <p className="text-[15px] font-bold">Pin your exact location</p>
        <p className="mb-2 text-[13px] text-ink-2">Helps the delivery partner reach your door without calling. Optional, but recommended.</p>
        <LocationPicker value={loc} onChange={setLoc} />
        {loc && (
          <p className="mt-2 flex items-start gap-2 rounded-3 bg-meadow px-3 py-2 text-[13px]">
            <span className="text-forest" aria-hidden>
              ●
            </span>
            <span>
              <span className="font-semibold">{loc.source === 'device' ? 'Location from your phone' : 'Pinned on map'}</span>
              {hint?.label ? <span className="text-ink-2"> · near {hint.label.split(',').slice(0, 3).join(',')}</span> : null}
            </span>
          </p>
        )}
      </div>

      <label className="sm:col-span-2">
        <span className="text-sm text-ink-2">Flat / house no., floor, building</span>
        <input required value={v.line1} onChange={(e) => set('line1', e.target.value)} placeholder="B-704, 7th floor, Sai Residency" autoComplete="address-line1" className={field} />
      </label>
      <label className="sm:col-span-2">
        <span className="text-sm text-ink-2">Street, area</span>
        <input value={v.line2} onChange={(e) => set('line2', e.target.value)} autoComplete="address-line2" className={field} />
      </label>
      <label>
        <span className="text-sm text-ink-2">Pincode</span>
        <input
          required
          value={v.pincode}
          onChange={(e) => set('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          pattern="[1-9][0-9]{5}"
          maxLength={6}
          autoComplete="postal-code"
          className={`${field} num`}
        />
        {pinMismatch && <span className="mt-1 block text-[12px] text-alert">The map suggests {hint!.pincode}. Please check your pincode.</span>}
      </label>
      <label>
        <span className="text-sm text-ink-2">City</span>
        <input required value={v.city} onChange={(e) => set('city', e.target.value)} autoComplete="address-level2" className={field} />
      </label>
      <label className="sm:col-span-2">
        <span className="text-sm text-ink-2">Landmark (optional)</span>
        <input value={v.landmark} onChange={(e) => set('landmark', e.target.value)} placeholder="Opposite D-Mart, near the temple…" className={field} />
      </label>
      <label>
        <span className="text-sm text-ink-2">Receiver&rsquo;s name</span>
        <input required value={v.name} onChange={(e) => set('name', e.target.value)} autoComplete="name" className={field} />
      </label>
      <label>
        <span className="text-sm text-ink-2">Mobile number</span>
        <input required value={v.phone} onChange={(e) => set('phone', e.target.value)} inputMode="tel" placeholder="98765 43210" autoComplete="tel-national" className={`${field} num`} />
      </label>
      <fieldset className="sm:col-span-2">
        <legend className="text-sm text-ink-2">Save as</legend>
        <div className="mt-1 flex gap-2">
          {['Home', 'Work', 'Other'].map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={label === l}
              onClick={() => setLabel(l)}
              className={`rounded-pill border px-4 py-2 text-[14px] font-semibold ${label === l ? 'border-forest bg-meadow text-forest' : 'border-rule'}`}
            >
              {l}
            </button>
          ))}
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="text-alert sm:col-span-2">
          {error}
        </p>
      )}
      <div className="flex gap-3 sm:col-span-2">
        <button type="submit" disabled={busy} className="h-12 rounded-pill bg-forest px-6 font-semibold text-on-forest hover:bg-forest-2 disabled:opacity-60">
          {busy ? 'Saving…' : 'Save address'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="h-12 rounded-pill px-5 font-semibold text-ink-2 hover:bg-paper-2">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
