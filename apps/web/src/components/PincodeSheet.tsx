'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api-client';
import { useCart } from '@/lib/cart';
import { etaText } from '@/lib/format';
import type { ShippingInfo } from '@/lib/types';

export interface Estimate {
  serviceable: boolean;
  state: string | null;
  shipping: ShippingInfo | null;
  freeAbove: { amount: number } | null;
  message: string | null;
}

const rupees = (p: number) => `₹${(p / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export function estimateText(e: Estimate) {
  if (!e.serviceable || !e.shipping) return e.message ?? 'We do not deliver to this pincode yet.';
  const when = etaText(e.shipping.earliest, e.shipping.latest);
  const free = e.freeAbove ? ` Free delivery on orders above ${rupees(e.freeAbove.amount)}.` : '';
  return `Delivers ${when}${e.state ? ` in ${e.state}` : ''}.${free}`;
}

/** Six-box pincode entry. Saves the pincode for the basket and shows delivery dates. */
export function PincodeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { pincode, setPincode } = useCart();
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const [result, setResult] = useState<Estimate | null>(null);
  const [busy, setBusy] = useState(false);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    setDigits((pincode.padEnd(6, ' ').slice(0, 6).split('') as string[]).map((d) => (d === ' ' ? '' : d)));
    setResult(null);
    setTimeout(() => boxes.current[pincode.length >= 6 ? 5 : pincode.length]?.focus(), 60);
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [open, pincode, onClose]);

  const value = digits.join('');
  async function check() {
    if (!/^[1-9]\d{5}$/.test(value)) return;
    setBusy(true);
    try {
      const e = await api<Estimate>(`/v1/store/shipping/estimate?pincode=${value}&subtotal=0`);
      setResult(e);
      if (e.serviceable) setPincode(value);
    } catch {
      setResult({ serviceable: false, state: null, shipping: null, freeAbove: null, message: 'Could not check right now. Try again.' });
    } finally {
      setBusy(false);
    }
  }

  function type(i: number, raw: string) {
    const v = raw.replace(/\D/g, '');
    if (v.length > 1) {
      const all = (value.slice(0, i) + v)
        .slice(0, 6)
        .padEnd(6, ' ')
        .split('')
        .map((d) => (d === ' ' ? '' : d));
      setDigits(all);
      boxes.current[Math.min(5, i + v.length)]?.focus();
      return;
    }
    const next = [...digits];
    next[i] = v;
    setDigits(next);
    if (v && i < 5) boxes.current[i + 1]?.focus();
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] grid items-end sm:place-items-center">
          <motion.div className="absolute inset-0 bg-ink/45" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pin-title"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="relative w-full rounded-t-5 bg-paper p-6 pb-8 shadow-float sm:max-w-[420px] sm:rounded-5"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 id="pin-title" className="text-xl font-bold">
                  Where should we deliver?
                </h2>
                <p className="mt-1 text-sm text-forest">We ship across India</p>
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-pill hover:bg-paper-2">
                ✕
              </button>
            </div>
            <form
              className="mt-5"
              onSubmit={(e) => {
                e.preventDefault();
                void check();
              }}
            >
              <label className="text-sm font-medium" id="pin-label">
                Pincode
              </label>
              <div className="mt-2 grid grid-cols-6 gap-2" role="group" aria-labelledby="pin-label">
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      boxes.current[i] = el;
                    }}
                    value={d}
                    inputMode="numeric"
                    autoComplete={i === 0 ? 'postal-code' : 'off'}
                    aria-label={`Digit ${i + 1}`}
                    maxLength={6}
                    onChange={(e) => type(i, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Backspace' && !d && i > 0) boxes.current[i - 1]?.focus();
                    }}
                    className="num h-12 w-full rounded-3 border border-rule bg-paper-2 text-center text-lg focus:border-forest focus:bg-paper"
                  />
                ))}
              </div>
              <button
                disabled={value.length !== 6 || busy}
                className="mt-5 h-12 w-full rounded-pill bg-forest font-semibold text-on-forest transition-colors hover:bg-forest-2 disabled:bg-paper-3 disabled:text-ink-3"
              >
                {busy ? 'Checking…' : 'Check delivery'}
              </button>
            </form>
            {result && (
              <p role="status" className={`mt-4 rounded-3 p-3 text-sm ${result.serviceable ? 'bg-meadow text-ink' : 'bg-paper-2 text-alert'}`}>
                {estimateText(result)}
              </p>
            )}
            {result?.serviceable && (
              <button type="button" onClick={onClose} className="mt-3 w-full text-sm font-medium text-forest underline underline-offset-4">
                Continue shopping
              </button>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
