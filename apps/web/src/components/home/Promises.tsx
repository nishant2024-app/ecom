import type { StoreContent } from '@/lib/types';

export function Promises({ items }: { items: StoreContent['promises'] }) {
  if (!items.length) return null;
  return (
    <section aria-label="Our promises" className="border-y border-ink">
      <ul className="mx-auto grid max-w-[1320px] sm:grid-cols-2 lg:grid-cols-4">
        {items.map((p, i) => (
          <li key={p.title} className="border-rule px-4 py-6 md:px-8 sm:[&:nth-child(odd)]:border-r lg:border-r lg:last:border-r-0 max-sm:[&:not(:last-child)]:border-b">
            <p className="label text-ink-3">{String(i + 1).padStart(2, '0')}</p>
            <p className="mt-2 font-display text-xl">{p.title}</p>
            <p className="mt-1 text-[15px] text-ink-2">{p.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
