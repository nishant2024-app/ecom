'use client';

import { Button } from '@dairy/ui';
import { useState, type FormEvent } from 'react';
import { api, ApiError } from '@/lib/api-client';

const field = 'mt-1 h-12 w-full rounded-1 border border-ink-3 bg-paper px-3 text-base focus:border-ink';

/** First-run form: mobile number and a serviceable delivery address. */
export function Onboarding({ me, onDone }: { me: { name: string; phone: string | null; defaultAddressId: string | null }; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await api('/v1/store/me', { method: 'PATCH', body: JSON.stringify({ name: f.get('name'), phone: f.get('phone') }) });
      if (!me.defaultAddressId) {
        await api('/v1/store/me/addresses', {
          method: 'POST',
          body: JSON.stringify({
            label: 'Home',
            line1: f.get('line1'),
            line2: f.get('line2') || undefined,
            landmark: f.get('landmark') || undefined,
            city: f.get('city'),
            state: 'Maharashtra',
            pincode: f.get('pincode'),
            deliveryInstructions: f.get('instructions') || undefined,
            isDefault: true,
          }),
        });
      }
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? (err.problem.detail ?? err.problem.title) : 'Could not save. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-[1200px] gap-10 px-4 py-12 md:grid-cols-12 md:px-6">
      <div className="md:col-span-4">
        <h1 className="font-display text-2xl">Where should we deliver?</h1>
        <p className="mt-3 text-lg text-ink-2">Our delivery partner calls this number only if they can&rsquo;t find your door.</p>
      </div>
      <form onSubmit={submit} className="grid gap-4 md:col-span-6 md:col-start-6">
        <label>
          <span className="text-sm text-ink-2">Name</span>
          <input name="name" required defaultValue={me.name} className={field} autoComplete="name" />
        </label>
        <label>
          <span className="text-sm text-ink-2">Mobile number</span>
          <input name="phone" required defaultValue={me.phone ?? ''} inputMode="tel" placeholder="98765 43210" className={`${field} num`} autoComplete="tel-national" />
        </label>
        {!me.defaultAddressId && (
          <>
            <label>
              <span className="text-sm text-ink-2">Flat, building</span>
              <input name="line1" required className={field} autoComplete="address-line1" />
            </label>
            <label>
              <span className="text-sm text-ink-2">Street, area</span>
              <input name="line2" className={field} autoComplete="address-line2" />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label>
                <span className="text-sm text-ink-2">Pincode</span>
                <input name="pincode" required inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6} className={`${field} num`} autoComplete="postal-code" />
              </label>
              <label>
                <span className="text-sm text-ink-2">City</span>
                <input name="city" required defaultValue="Pune" className={field} autoComplete="address-level2" />
              </label>
            </div>
            <label>
              <span className="text-sm text-ink-2">Landmark</span>
              <input name="landmark" className={field} />
            </label>
            <label>
              <span className="text-sm text-ink-2">Instructions for the delivery partner</span>
              <input name="instructions" placeholder="Leave at door, don’t ring before 7" className={field} />
            </label>
          </>
        )}
        {error && (
          <p role="alert" className="text-alert">
            {error}
          </p>
        )}
        <Button type="submit" variant="solid" size="lg" disabled={busy}>
          {busy ? 'Saving…' : 'Save and continue'}
        </Button>
      </form>
    </div>
  );
}
