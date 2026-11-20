import type { MetadataRoute } from 'next';
import { apiGet } from '@/lib/api-server';
import { SITE_URL } from '@/lib/site';
import type { Category, ProductSummary } from '@/lib/types';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([
    apiGet<{ data: ProductSummary[] }>('/v1/store/products?limit=100', { revalidate: 3600 }),
    apiGet<{ data: Category[] }>('/v1/store/categories', { revalidate: 3600 }),
  ]);
  const now = new Date();
  return [
    { url: SITE_URL, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/products`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    ...['verify', 'privacy', 'terms', 'refunds', 'shipping-policy', 'contact'].map((p) => ({ url: `${SITE_URL}/${p}`, lastModified: now, changeFrequency: 'yearly' as const, priority: 0.2 })),
    ...(categories?.data ?? []).map((c) => ({ url: `${SITE_URL}/products?category=${c.slug}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.8 })),
    ...(products?.data ?? []).map((p) => ({
      url: `${SITE_URL}/p/${p.slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
      ...(p.image ? { images: [p.image.url] } : {}),
    })),
  ];
}
