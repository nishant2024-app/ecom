import Link from 'next/link';

export function Footer({ fssai, phone, email }: { fssai?: string; phone?: string; email?: string }) {
  return (
    <footer className="mt-24 rule-t">
      <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-10 text-sm text-ink-2 md:grid-cols-12 md:px-6">
        <div className="md:col-span-5">
          <p className="font-display text-xl text-ink">Mulshi Dairy</p>
          <p className="mt-2 max-w-sm">
            Milk from our herd in Mulshi, packed at 3 AM and delivered before 8 across Baner, Balewadi and Aundh.
          </p>
        </div>
        <div className="md:col-span-3">
          <p className="text-ink">Help</p>
          <ul className="mt-2 space-y-1">
            {phone && <li className="num">{phone}</li>}
            {email && <li>{email}</li>}
            <li>
              <Link href="/account" className="hover:underline">
                Pause or change deliveries
              </Link>
            </li>
          </ul>
        </div>
        <div className="md:col-span-4">
          <p className="text-ink">Legal</p>
          <ul className="mt-2 space-y-1">
            {fssai && <li>FSSAI licence <span className="num">{fssai}</span></li>}
            <li>Prices include GST</li>
            <li>
              <Link href="/account/delete" className="hover:underline">
                Delete my account
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
