import Link from 'next/link';
import { Logo } from './Header';

export function Footer({ fssai, phone, email }: { fssai?: string; phone?: string; email?: string }) {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-28 border-t border-ink bg-paper">
      <div className="mx-auto grid max-w-[1320px] gap-10 px-4 py-14 md:grid-cols-12 md:px-8">
        <div className="md:col-span-5">
          <div className="flex items-center gap-3">
            <Logo size={40} />
            <p className="font-display text-3xl">Mulshi Dairy</p>
          </div>
          <p className="mt-4 max-w-sm font-serif text-lg italic leading-snug text-ink-2">Ghee, milk powder, long-life milk and mithai from our herd in Mulshi, near Pune.</p>
        </div>
        <FooterCol title="Shop">
          <Link href="/products?category=ghee">Ghee</Link>
          <Link href="/products?category=milk-powder">Milk powder</Link>
          <Link href="/products?category=uht-flavoured">UHT & flavoured milk</Link>
          <Link href="/products?category=condensed-sweets">Condensed milk & mithai</Link>
        </FooterCol>
        <FooterCol title="Help">
          <Link href="/account">Track an order</Link>
          <Link href="/#questions">Shipping & returns</Link>
          {phone && <a href={`tel:${phone.replace(/\s/g, '')}`} className="num">{phone}</a>}
          {email && <a href={`mailto:${email}`}>{email}</a>}
        </FooterCol>
        <FooterCol title="The fine print">
          {fssai && (
            <span>
              FSSAI licence <span className="num">{fssai}</span>
            </span>
          )}
          <span>All prices include GST</span>
          <Link href="/account/delete">Delete my account</Link>
        </FooterCol>
      </div>
      <div className="border-t border-rule">
        <p className="label mx-auto flex max-w-[1320px] flex-wrap justify-between gap-2 px-4 py-4 text-ink-3 md:px-8">
          <span>© {year} Mulshi Dairy</span>
          <span>Made in Mulshi, Maharashtra</span>
        </p>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="md:col-span-2 md:[&:last-child]:col-span-3">
      <p className="label text-ink-3">{title}</p>
      <div className="mt-4 flex flex-col gap-2 text-[15px] [&_a:hover]:underline [&_a]:underline-offset-4">{children}</div>
    </div>
  );
}
