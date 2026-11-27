import type { Metadata, Viewport } from 'next';
import { AnnouncementBar } from '@/components/AnnouncementBar';
import { Footer } from '@/components/Footer';
import { Shell } from '@/components/Shell';
import { apiGet } from '@/lib/api-server';
import { getContent } from '@/lib/content';
import { SITE_NAME, SITE_URL } from '@/lib/site';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const { seo } = await getContent();
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: seo.title, template: `%s · ${SITE_NAME}` },
    description: seo.description,
    applicationName: SITE_NAME,
    alternates: { canonical: '/' },
    openGraph: { type: 'website', siteName: SITE_NAME, locale: 'en_IN', title: seo.title, description: seo.description, url: '/', images: [{ url: '/og', width: 1200, height: 630, alt: SITE_NAME }] },
    twitter: { card: 'summary_large_image', title: seo.title, description: seo.description },
    formatDetection: { telephone: false },
    robots: process.env.SITE_NOINDEX === 'true' ? { index: false, follow: false } : { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0e1511' },
  ],
};

interface AppConfig {
  legal: { fssai: string };
  support: { phone: string; email: string };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [config, content] = await Promise.all([apiGet<AppConfig>('/v1/app-config', { revalidate: 300 }), getContent()]);
  const org = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#org`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: `${SITE_URL}/icon.svg`,
        ...(config?.support.email ? { email: config.support.email } : {}),
        ...(config?.support.phone
          ? { contactPoint: { '@type': 'ContactPoint', telephone: config.support.phone, contactType: 'customer service', areaServed: 'IN', availableLanguage: ['en', 'hi', 'mr'] } }
          : {}),
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#site`,
        name: SITE_NAME,
        url: SITE_URL,
        publisher: { '@id': `${SITE_URL}/#org` },
        potentialAction: { '@type': 'SearchAction', target: `${SITE_URL}/products?q={query}`, 'query-input': 'required name=query' },
      },
    ],
  };
  return (
    <html lang="en-IN">
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(org) }} />
        <AnnouncementBar text={content.announcement} />
        <Shell>
          <main id="main">{children}</main>
          <Footer fssai={config?.legal.fssai} phone={config?.support.phone} email={config?.support.email} />
        </Shell>
      </body>
    </html>
  );
}
