import Link from 'next/link';
import { Logo } from './Header';

export function Footer({ fssai, phone, email }: { fssai?: string; phone?: string; email?: string }) {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-16 bg-paper-2 pb-32 md:mt-24 md:pb-0">
      <div className="mx-auto grid max-w-[1280px] gap-8 px-4 py-12 md:grid-cols-12 md:px-6">
        <div className="md:col-span-4">
          <div className="flex items-center gap-2">
            <Logo />
            <p className="text-xl font-extrabold tracking-[-0.03em]">Mulshi Dairy</p>
          </div>
          <p className="mt-3 max-w-xs text-[14px] leading-relaxed text-ink-2">Ghee, milk powder, long-life milk and mithai from our farm in Mulshi, Pune. Shipped across India.</p>
          {fssai && <p className="mt-4 text-[13px] text-ink-2">FSSAI Lic. No. <span className="num">{fssai}</span></p>}
        </div>
        <Col title="Shop">
          <Link href="/products?category=ghee">Ghee</Link>
          <Link href="/products?category=milk-powder">Milk powder</Link>
          <Link href="/products?category=uht-flavoured">UHT & flavoured milk</Link>
          <Link href="/products?category=condensed-sweets">Condensed milk & mithai</Link>
        </Col>
        <Col title="Help">
          <Link href="/account">My orders</Link>
          <Link href="/shipping-policy">Shipping</Link>
          <Link href="/refunds">Cancellation & refunds</Link>
          <Link href="/contact">Contact us</Link>
        </Col>
        <Col title="Contact">
          {phone && <a href={`tel:${phone.replace(/\s/g, '')}`} className="num">{phone}</a>}
          {email && <a href={`mailto:${email}`}>{email}</a>}
          <Link href="/terms">Terms & conditions</Link>
          <Link href="/privacy">Privacy policy</Link>
        </Col>
      </div>
      <div className="border-t border-rule">
        <p className="mx-auto flex max-w-[1280px] flex-wrap justify-between gap-2 px-4 py-4 text-[13px] text-ink-3 md:px-6">
          <span>© {year} Mulshi Dairy. All prices include GST.</span>
          <span>Secure payments by Cashfree · UPI, cards, net banking</span>
        </p>
      </div>
    </footer>
  );
}

function Col({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="md:col-span-2 md:[&:last-child]:col-span-4">
      <p className="text-[14px] font-bold">{title}</p>
      <div className="mt-3 flex flex-col gap-2 text-[14px] text-ink-2 [&_a:hover]:text-forest">{children}</div>
    </div>
  );
}
