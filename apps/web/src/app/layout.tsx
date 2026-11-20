import type { Metadata, Viewport } from 'next';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { apiGet } from '@/lib/api-server';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Mulshi Dairy · Fresh milk delivered by 7 AM', template: '%s · Mulshi Dairy' },
  description: 'Milk, curd, paneer and ghee from our Mulshi herd. Daily subscriptions, delivered before 8 AM in Baner, Balewadi and Aundh.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f2e7' },
    { media: '(prefers-color-scheme: dark)', color: '#0f1424' },
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
        <Header />
        <main id="main">{children}</main>
        <Footer fssai={config?.legal.fssai} phone={config?.support.phone} email={config?.support.email} />
      </body>
    </html>
  );
}
