import type { Metadata, Viewport } from 'next';
import { Footer } from '@/components/Footer';
import { Shell } from '@/components/Shell';
import { apiGet } from '@/lib/api-server';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Mulshi Dairy · Ghee, milk powder and mithai, shipped across India', template: '%s · Mulshi Dairy' },
  description: 'Bilona A2 ghee, milk powder, UHT and flavoured milk, condensed milk and mithai from our Mulshi farm. Shelf-stable, shipped to your door.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbf7ee' },
    { media: '(prefers-color-scheme: dark)', color: '#0d1a14' },
  ],
};

interface AppConfig {
  legal: { fssai: string };
  support: { phone: string; email: string };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const config = await apiGet<AppConfig>('/v1/app-config', { revalidate: 300 });
  return (
    <html lang="en">
      <body>
        <Shell>
          <main id="main">{children}</main>
          <Footer fssai={config?.legal.fssai} phone={config?.support.phone} email={config?.support.email} />
        </Shell>
      </body>
    </html>
  );
}
