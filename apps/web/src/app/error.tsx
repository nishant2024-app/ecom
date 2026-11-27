'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/** Shown when a page crashes while rendering. The rest of the shop (header, cart) keeps working. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto max-w-[640px] px-4 py-20 text-center md:py-28">
      <h1 className="text-[34px] font-extrabold tracking-[-0.03em] md:text-[44px]">Something went wrong</h1>
      <p className="mt-3 text-[16px] text-ink-2">We couldn&rsquo;t load this page. Your cart is safe. Please try again, and if it keeps happening, contact us.</p>
      {error.digest && <p className="num mt-2 text-[12px] text-ink-3">Reference {error.digest}</p>}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="h-12 rounded-pill bg-forest px-6 font-semibold text-on-forest hover:bg-forest-2">
          Try again
        </button>
        <Link href="/" className="inline-flex h-12 items-center rounded-pill border border-rule px-6 font-semibold hover:border-forest">
          Go to the home page
        </Link>
      </div>
    </div>
  );
}
