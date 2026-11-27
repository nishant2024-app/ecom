'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { longDate } from '@/lib/format';

interface Result {
  genuine: true;
  code: string;
  product: { name: string; slug: string; packSize: string };
  manufacturedOn: string;
  bestBefore: string;
  expired: boolean;
}

export function VerifyForm() {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function check(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim();
    if (c.length < 3) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await api<Result>(`/v1/store/verify/${encodeURIComponent(c)}`));
    } catch (err) {
      setError(err instanceof ApiError ? (err.problem.detail ?? err.problem.title) : 'Could not check right now. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6">
      <form onSubmit={check} className="flex gap-2">
        <label htmlFor="batch" className="sr-only">
          Batch code
        </label>
        <input
          id="batch"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Batch code, e.g. GH-A2-500-B"
          autoComplete="off"
          spellCheck={false}
          className="num h-12 min-w-0 flex-1 rounded-pill border border-rule bg-paper-2 px-5 text-[16px] focus:border-forest focus:bg-paper"
        />
        <button disabled={busy || code.trim().length < 3} className="h-12 shrink-0 rounded-pill bg-forest px-6 font-semibold text-on-forest disabled:opacity-50">
          {busy ? 'Checking…' : 'Verify'}
        </button>
      </form>
      {result && (
        <div role="status" className={`mt-5 rounded-5 border-2 p-5 ${result.expired ? 'border-alert bg-paper' : 'border-forest bg-meadow'}`}>
          <p className="flex items-center gap-2 text-lg font-extrabold">
            <span className={`grid h-8 w-8 place-items-center rounded-pill text-on-forest ${result.expired ? 'bg-alert' : 'bg-forest'}`} aria-hidden>
              {result.expired ? '!' : '✓'}
            </span>
            {result.expired ? 'Genuine, but past its best-before date' : 'Genuine Mulshi Dairy pack'}
          </p>
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[15px]">
            <dt className="text-ink-2">Product</dt>
            <dd className="font-semibold">
              <Link href={`/p/${result.product.slug}`} className="hover:underline">
                {result.product.name}
              </Link>{' '}
              · {result.product.packSize}
            </dd>
            <dt className="text-ink-2">Batch</dt>
            <dd className="num font-semibold">{result.code}</dd>
            <dt className="text-ink-2">Made on</dt>
            <dd className="font-semibold">{longDate(result.manufacturedOn)}</dd>
            <dt className="text-ink-2">Best before</dt>
            <dd className="font-semibold">{longDate(result.bestBefore)}</dd>
          </dl>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-5 rounded-4 bg-paper-2 p-4 text-[15px] text-alert">
          {error}
        </p>
      )}
    </div>
  );
}
