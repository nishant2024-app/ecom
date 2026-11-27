'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { longDate } from '@/lib/format';
import type { ReviewPage } from '@/lib/types';

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex" aria-hidden style={{ fontSize: size, lineHeight: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= Math.round(value) ? 'text-[#e3a008]' : 'text-paper-3'}>★</span>
      ))}
    </span>
  );
}

interface Mine {
  eligible: boolean;
  review: { rating: number; title: string; body: string; status: string } | null;
}

/** Verified reviews (delivered orders only, approved by staff) and the form to write one. */
export function Reviews({ slug, initial }: { slug: string; initial: ReviewPage | null }) {
  const [data, setData] = useState<ReviewPage | null>(initial);
  const [mine, setMine] = useState<Mine | 'signed-out' | null>(null);
  const [form, setForm] = useState({ rating: 0, title: '', body: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // The CSRF cookie is readable and only exists for signed-in visitors; skip the call otherwise.
    if (!document.cookie.split('; ').some((c) => c.startsWith('csrf_token='))) return setMine('signed-out');
    api<Mine>(`/v1/store/products/${slug}/reviews/mine`)
      .then((m) => {
        setMine(m);
        if (m.review) setForm({ rating: m.review.rating, title: m.review.title, body: m.review.body });
      })
      .catch(() => setMine('signed-out'));
  }, [slug]);

  async function more() {
    if (!data?.page.nextCursor) return;
    const next = await api<ReviewPage>(`/v1/store/products/${slug}/reviews?cursor=${data.page.nextCursor}`);
    setData({ ...next, data: [...data.data, ...next.data] });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.rating) return setMsg('Choose a star rating.');
    setBusy(true);
    setMsg(null);
    try {
      await api(`/v1/store/products/${slug}/reviews/mine`, { method: 'PUT', body: JSON.stringify(form) });
      setMine((m) => (m && m !== 'signed-out' ? { ...m, review: { ...form, status: 'pending' } } : m));
      setMsg('Thank you. Your review will appear after a quick check.');
    } catch (err) {
      setMsg(err instanceof ApiError ? (err.problem.detail ?? err.problem.title) : 'Could not save your review.');
    } finally {
      setBusy(false);
    }
  }

  const s = data?.summary;
  return (
    <section id="reviews" className="mt-14 scroll-mt-24">
      <h2 className="text-[22px] font-extrabold tracking-[-0.025em] md:text-[28px]">Customer reviews</h2>
      <div className="mt-5 grid gap-6 md:grid-cols-[300px_1fr]">
        <div className="rounded-5 bg-paper-2 p-5">
          {s && s.count > 0 ? (
            <>
              <p className="flex items-end gap-2">
                <span className="text-[40px] font-extrabold leading-none">{s.average.toFixed(1)}</span>
                <span className="pb-1 text-ink-2">out of 5</span>
              </p>
              <Stars value={s.average} size={20} />
              <p className="mt-1 text-[13px] text-ink-2">{s.count} verified review{s.count === 1 ? '' : 's'}</p>
              <ul className="mt-4 space-y-1.5">
                {[5, 4, 3, 2, 1].map((r) => {
                  const n = s.breakdown[String(r)] ?? 0;
                  return (
                    <li key={r} className="flex items-center gap-2 text-[13px]">
                      <span className="w-6 text-ink-2">{r}★</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-pill bg-paper-3"><span className="block h-full rounded-pill bg-[#e3a008]" style={{ width: `${(n / s.count) * 100}%` }} /></span>
                      <span className="num w-6 text-right text-ink-3">{n}</span>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p className="text-[15px] text-ink-2">No reviews yet. Reviews come only from customers whose order was delivered.</p>
          )}
          <p className="mt-4 flex items-center gap-1.5 text-[12px] text-ink-3"><span className="text-forest">✓</span> Every review is from a delivered order</p>
        </div>

        <div>
          {mine && mine !== 'signed-out' && mine.eligible && (
            <form onSubmit={submit} className="mb-6 rounded-5 border border-rule p-5">
              <p className="font-bold">{mine.review ? 'Your review' : 'Rate this product'}</p>
              {mine.review?.status === 'pending' && <p className="mt-1 text-[13px] text-ink-2">Waiting for a quick check before it appears.</p>}
              <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((i) => (
                  <button key={i} type="button" role="radio" aria-checked={form.rating === i} aria-label={`${i} star${i > 1 ? 's' : ''}`} onClick={() => setForm({ ...form, rating: i })} className={`text-[30px] leading-none transition-transform hover:scale-110 ${i <= form.rating ? 'text-[#e3a008]' : 'text-paper-3'}`}>
                    ★
                  </button>
                ))}
              </div>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={80} placeholder="Headline (optional)" aria-label="Review headline" className="mt-3 h-11 w-full rounded-3 border border-rule bg-paper px-3 focus:border-forest" />
              <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} maxLength={2000} rows={3} placeholder="Taste, aroma, packaging, delivery…" aria-label="Review" className="mt-2 w-full rounded-3 border border-rule bg-paper p-3 focus:border-forest" />
              <button disabled={busy} className="mt-3 h-11 rounded-pill bg-forest px-6 font-semibold text-on-forest disabled:opacity-60">{busy ? 'Saving…' : mine.review ? 'Update review' : 'Submit review'}</button>
              {msg && <p role="status" className="mt-2 text-[14px] text-ink-2">{msg}</p>}
            </form>
          )}
          {mine === 'signed-out' && (
            <p className="mb-6 rounded-4 bg-paper-2 p-4 text-[14px] text-ink-2">
              Bought this before? <Link href={`/signin?next=/p/${slug}%23reviews`} className="inline-block py-1.5 font-semibold text-forest underline underline-offset-2">Sign in</Link> to write a review.
            </p>
          )}
          <ul className="space-y-4">
            {data?.data.map((r) => (
              <li key={r.id} className="rounded-4 border border-rule p-4">
                <div className="flex items-center justify-between gap-3">
                  <Stars value={r.rating} />
                  <span className="text-[12px] text-ink-3">{longDate(r.createdAt.slice(0, 10))}</span>
                </div>
                {r.title && <p className="mt-2 font-bold">{r.title}</p>}
                {r.body && <p className="mt-1 text-[15px] leading-relaxed text-ink-2">{r.body}</p>}
                <p className="mt-2 text-[13px] text-ink-3">
                  {r.author} · <span className="text-forest">Verified purchase</span>
                </p>
              </li>
            ))}
          </ul>
          {data?.page.hasMore && (
            <button type="button" onClick={more} className="mt-4 h-11 rounded-pill border border-rule px-5 font-semibold hover:border-forest">
              Show more reviews
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
