import Link from 'next/link';

export function Footer({ fssai, phone, email }: { fssai?: string; phone?: string; email?: string }) {
  return (
    <footer className="mt-24 px-3 pb-3 md:px-6 md:pb-6">
      <div className="mx-auto max-w-[1240px] overflow-hidden rounded-5 bg-forest text-on-forest">
        <div className="grid gap-10 px-6 py-12 md:grid-cols-12 md:px-12">
          <div className="md:col-span-5">
            <p className="font-display text-3xl">Mulshi Dairy</p>
            <p className="mt-3 max-w-sm text-on-forest/80">Ghee, milk powder, UHT milk and mithai from our herd in Mulshi, packed to last and shipped across India.</p>
          </div>
          <div className="md:col-span-2">
            <p className="text-sm uppercase tracking-[0.12em] text-on-forest/70">Shop</p>
            <ul className="mt-3 space-y-1.5">
              <li><Link href="/products?category=ghee" className="hover:underline">Ghee</Link></li>
              <li><Link href="/products?category=milk-powder" className="hover:underline">Milk powder</Link></li>
              <li><Link href="/products?category=uht-flavoured" className="hover:underline">UHT & flavoured</Link></li>
              <li><Link href="/products?category=condensed-sweets" className="hover:underline">Mithai</Link></li>
            </ul>
          </div>
          <div className="md:col-span-2">
            <p className="text-sm uppercase tracking-[0.12em] text-on-forest/70">Help</p>
            <ul className="mt-3 space-y-1.5">
              <li><Link href="/account" className="hover:underline">Track an order</Link></li>
              {phone && <li className="num">{phone}</li>}
              {email && <li>{email}</li>}
            </ul>
          </div>
          <div className="md:col-span-3">
            <p className="text-sm uppercase tracking-[0.12em] text-on-forest/70">Legal</p>
            <ul className="mt-3 space-y-1.5">
              {fssai && <li>FSSAI licence <span className="num">{fssai}</span></li>}
              <li>Prices include GST</li>
              <li><Link href="/account/delete" className="hover:underline">Delete my account</Link></li>
            </ul>
          </div>
        </div>
        <p aria-hidden className="select-none whitespace-nowrap px-6 pb-2 font-display text-[clamp(44px,9.4vw,132px)] leading-[0.8] text-on-forest/10 md:px-10">
          Pasture to pantry
        </p>
      </div>
    </footer>
  );
}
