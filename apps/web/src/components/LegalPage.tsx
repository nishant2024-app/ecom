import type { Metadata } from 'next';
import Link from 'next/link';
import { apiGet } from '@/lib/api-server';
import { legalDocs } from '@/lib/legal';
import { SITE_NAME } from '@/lib/site';

interface AppConfig {
  support: { phone: string; email: string };
  legal: { fssai: string; name?: string; address?: string };
}

async function docFor(slug: string) {
  const c = await apiGet<AppConfig>('/v1/app-config', { revalidate: 300 });
  return legalDocs({
    name: SITE_NAME,
    legalName: c?.legal.name ?? process.env.LEGAL_NAME ?? SITE_NAME,
    address: c?.legal.address ?? process.env.LEGAL_ADDRESS ?? 'Mulshi, Pune, Maharashtra',
    email: c?.support.email ?? 'support@example.in',
    phone: c?.support.phone ?? '',
  })[slug]!;
}

export async function legalMetadata(slug: string): Promise<Metadata> {
  const d = await docFor(slug);
  return { title: d.title, description: d.description, alternates: { canonical: `/${slug}` } };
}

export async function LegalPage({ slug }: { slug: string }) {
  const d = await docFor(slug);
  const links = [
    ['privacy', 'Privacy'],
    ['terms', 'Terms'],
    ['refunds', 'Refunds'],
    ['shipping-policy', 'Shipping'],
    ['contact', 'Contact'],
  ];
  return (
    <div className="mx-auto grid max-w-[1280px] gap-8 px-4 pt-8 md:px-6 lg:grid-cols-12">
      <nav aria-label="Policies" className="flex gap-2 overflow-x-auto text-[14px] font-semibold lg:col-span-3 lg:flex-col lg:gap-1">
        {links.map(([s, l]) => (
          <Link
            key={s}
            href={`/${s}`}
            aria-current={s === slug ? 'page' : undefined}
            className={`whitespace-nowrap rounded-pill px-4 py-2 ${s === slug ? 'bg-meadow text-forest' : 'text-ink-2 hover:bg-paper-2'}`}
          >
            {l}
          </Link>
        ))}
      </nav>
      <article className="max-w-2xl lg:col-span-8">
        <h1 className="font-extrabold tracking-[-0.02em] text-[clamp(36px,4.6vw,60px)] leading-[1.02]">{d.title}</h1>
        <p className="mt-4  text-xl text-ink-2">{d.description}</p>
        {d.sections.map((s) => (
          <section key={s.h} className="mt-8">
            <h2 className="font-extrabold tracking-[-0.02em] text-2xl">{s.h}</h2>
            {s.p.map((p, i) => (
              <p key={i} className="mt-3 text-[17px] leading-relaxed text-ink-2">
                {p}
              </p>
            ))}
          </section>
        ))}
      </article>
    </div>
  );
}
