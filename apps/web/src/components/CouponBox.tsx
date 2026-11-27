'use client';

import { useState } from 'react';
import { useCart } from '@/lib/cart';
import type { Quote } from '@/lib/types';

/** "Have a coupon?" field. The server checks the code on every quote, so this only holds the text and shows the result. */
export function CouponBox({ quote }: { quote: Quote | null }) {
  const { coupon, setCoupon } = useCart();
  const [text, setText] = useState('');
  const applied = quote?.coupon;
  const error = quote?.couponError;

  if (coupon && applied) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-3 bg-meadow px-3 py-2 text-[14px]">
        <span>
          <span className="font-bold text-forest">{applied.code}</span> applied <span className="text-ink-2">· {applied.description}</span>
        </span>
        <button type="button" onClick={() => setCoupon('')} className="shrink-0 font-semibold text-ink-2 underline underline-offset-2">
          Remove
        </button>
      </div>
    );
  }
  return (
    <div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) setCoupon(text);
        }}
      >
        <label htmlFor="coupon" className="sr-only">
          Coupon code
        </label>
        <input
          id="coupon"
          value={coupon && !applied ? coupon : text}
          onChange={(e) => {
            if (coupon) setCoupon('');
            setText(e.target.value.toUpperCase());
          }}
          placeholder="Coupon code"
          autoComplete="off"
          className="num h-10 min-w-0 flex-1 rounded-pill border border-rule bg-paper-2 px-4 text-[14px] uppercase focus:border-forest focus:bg-paper"
        />
        <button className="h-10 shrink-0 rounded-pill border border-forest px-4 text-[14px] font-semibold text-forest hover:bg-meadow disabled:opacity-50" disabled={!text.trim() && !coupon}>
          Apply
        </button>
      </form>
      {coupon && error && (
        <p role="alert" className="mt-1.5 px-1 text-[13px] text-alert">
          {error}
        </p>
      )}
    </div>
  );
}
