import Link from 'next/link';

export const metadata = { title: 'Page not found', robots: { index: false, follow: true } };

export default function NotFound() {
  return (
    <div className="mx-auto max-w-[640px] px-4 py-20 text-center md:py-28">
      <p className="text-[13px] font-semibold text-forest">Error 404</p>
      <h1 className="mt-2 text-[34px] font-extrabold tracking-[-0.03em] md:text-[44px]">We couldn&rsquo;t find that page</h1>
      <p className="mt-3 text-[16px] text-ink-2">The link may be old, or the product may have been removed. Try searching, or start from the shop.</p>
      <form action="/products" role="search" className="mx-auto mt-6 flex max-w-md gap-2">
        <label htmlFor="nf-q" className="sr-only">
          Search products
        </label>
        <input id="nf-q" name="q" placeholder="Search ghee, milk powder, peda…" className="h-12 min-w-0 flex-1 rounded-pill border border-rule bg-paper-2 px-5 focus:border-forest focus:bg-paper" />
        <button className="h-12 rounded-pill bg-forest px-6 font-semibold text-on-forest hover:bg-forest-2">Search</button>
      </form>
      <div className="mt-6 flex flex-wrap justify-center gap-3 text-[15px] font-semibold text-forest">
        <Link href="/" className="rounded-pill px-4 py-2 hover:bg-meadow">
          Home
        </Link>
        <Link href="/products" className="rounded-pill px-4 py-2 hover:bg-meadow">
          All products
        </Link>
        <Link href="/contact" className="rounded-pill px-4 py-2 hover:bg-meadow">
          Contact us
        </Link>
      </div>
    </div>
  );
}
