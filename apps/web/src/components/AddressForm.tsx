'use client';

import { Button } from '@dairy/ui';
import { useState, type FormEvent } from 'react';
import { api, ApiError } from '@/lib/api-client';
import type { Address } from '@/lib/types';

const field = 'mt-1 h-12 w-full border border-rule bg-paper px-4 text-base focus:border-forest';

export function AddressForm({ defaultName, onSaved, onCancel }: { defaultName?: string; onSaved: (a: Address) => void; onCancel?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const a = await api<Address>('/v1/store/me/addresses', {
        method: 'POST',
        body: JSON.stringify({
          name: f.get('name'),
          phone: f.get('phone'),
          line1: f.get('line1'),
          line2: f.get('line2') || undefined,
          landmark: f.get('landmark') || undefined,
          city: f.get('city'),
          pincode: f.get('pincode'),
          label: f.get('label') || undefined,
          isDefault: true,
        }),
      });
      onSaved(a);
    } catch (err) {
      setError(err instanceof ApiError ? (err.problem.detail ?? err.problem.title) : 'Could not save the address');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <label className="sm:col-span-1">
        <span className="text-sm text-ink-2">Full name</span>
        <input name="name" required defaultValue={defaultName} autoComplete="name" className={field} />
      </label>
      <label>
        <span className="text-sm text-ink-2">Mobile number</span>
        <input name="phone" required inputMode="tel" placeholder="98765 43210" autoComplete="tel-national" className={`${field} num`} />
      </label>
      <label className="sm:col-span-2">
        <span className="text-sm text-ink-2">Flat, house, building</span>
        <input name="line1" required autoComplete="address-line1" className={field} />
      </label>
      <label className="sm:col-span-2">
        <span className="text-sm text-ink-2">Street, area</span>
        <input name="line2" autoComplete="address-line2" className={field} />
      </label>
      <label>
        <span className="text-sm text-ink-2">Pincode</span>
        <input name="pincode" required inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6} autoComplete="postal-code" className={`${field} num`} />
      </label>
      <label>
        <span className="text-sm text-ink-2">City</span>
        <input name="city" required autoComplete="address-level2" className={field} />
      </label>
      <label>
        <span className="text-sm text-ink-2">Landmark (optional)</span>
        <input name="landmark" className={field} />
      </label>
      <label>
        <span className="text-sm text-ink-2">Label (optional)</span>
        <input name="label" placeholder="Home, Office…" className={field} />
      </label>
      {error && (
        <p role="alert" className="text-alert sm:col-span-2">
          {error}
        </p>
      )}
      <div className="flex gap-3 sm:col-span-2">
        <Button type="submit" variant="solid" disabled={busy}>
          {busy ? 'Saving…' : 'Save address'}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
