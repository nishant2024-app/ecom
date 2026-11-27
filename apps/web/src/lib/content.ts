import 'server-only';
import { apiGet } from './api-server';
import type { StoreContent } from './types';

/** Storefront copy edited in Admin → Storefront. Falls back to safe defaults if the API is down. */
export async function getContent(): Promise<StoreContent> {
  const c = await apiGet<StoreContent>('/v1/store/content', { revalidate: 60 });
  return (
    c ?? {
      announcement: '',
      hero: { eyebrow: '', title: 'Ghee, milk powder and mithai, made the slow way.', subtitle: 'Shipped across India.', ctaLabel: 'Shop the pantry', imageId: null },
      story: { title: '', paragraphs: [], signature: '', imageId: null },
      promises: [],
      banners: [],
      seo: { title: 'Mulshi Dairy', description: 'Ghee, milk powder and mithai shipped across India.' },
      images: { hero: null, story: null, banners: [] },
    }
  );
}
