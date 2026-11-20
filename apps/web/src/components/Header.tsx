import Link from 'next/link';

const nav = [
  { href: '/products?category=milk', label: 'Milk' },
  { href: '/products?category=curd-buttermilk', label: 'Curd & Chaas' },
  { href: '/products?category=paneer', label: 'Paneer' },
  { href: '/products?category=ghee-butter', label: 'Ghee & Butter' },
];

export function Header() {
  return (
    <header className="rule-b">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:bg-paper focus:p-2">
        Skip to content
      </a>
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-6 px-4 py-4 md:px-6">
        <Link href="/" className="font-display text-2xl leading-none tracking-tight">
          Mulshi Dairy
        </Link>
        <nav aria-label="Categories" className="hidden gap-6 text-base md:flex">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="hover:underline hover:underline-offset-4">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-4 text-base">
          <Link href="/account" className="hover:underline hover:underline-offset-4">
            My milk card
          </Link>
        </div>
      </div>
      <nav aria-label="Categories" className="flex gap-5 overflow-x-auto px-4 pb-3 text-sm md:hidden">
        {nav.map((n) => (
          <Link key={n.href} href={n.href} className="whitespace-nowrap">
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
