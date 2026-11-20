'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { useCart } from '@/lib/cart';
import { PinIcon } from '../icons';
import { estimateText, PincodeSheet, type Estimate } from '../PincodeSheet';

/** Inline delivery check (instead of a pop-up on page load, which hurts mobile UX and SEO). */
export function PincodeStrip() {
  const { pincode } = useCart();
  const [open, setOpen] = useState(false);
  const [est, setEst] = useState<Estimate | null>(null);
  useEffect(() => {
    if (!/^[1-9]\d{5}$/.test(pincode)) return setEst(null);
    api<Estimate>(`/v1/store/shipping/estimate?pincode=${pincode}&subtotal=0`).then(setEst).catch(() => setEst(null));
  }, [pincode]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center gap-3 rounded-4 border border-rule bg-paper px-4 py-3 text-left hover:border-forest">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-pill bg-meadow text-forest"><PinIcon /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold">{pincode ? `Delivering to ${pincode}` : 'Check delivery to your pincode'}</span>
          <span className="block truncate text-[13px] text-ink-2">{est ? estimateText(est) : 'See delivery dates and charges before you order'}</span>
        </span>
        <span className="shrink-0 text-[14px] font-semibold text-forest">{pincode ? 'Change' : 'Check'}</span>
      </button>
      <PincodeSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
