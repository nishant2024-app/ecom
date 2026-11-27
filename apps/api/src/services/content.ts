import { schema as s, type DbOrTx } from '@dairy/db';
import { and, eq, inArray } from 'drizzle-orm';
import type { Storage } from './storage';
import { imageOut } from './images';

export interface Banner {
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  href: string;
  /** Colour scheme for the drawn banner when there is no photo. */
  theme: 'ghee' | 'milk' | 'sweets' | 'green';
  /** Products from this category are drawn on the banner. */
  categorySlug: string | null;
  imageId: string | null;
}

/** Storefront copy and images the owner edits in Admin → Storefront. */
export interface StoreContent {
  announcement: string;
  hero: { eyebrow: string; title: string; subtitle: string; ctaLabel: string; imageId: string | null };
  banners: Banner[];
  story: { title: string; paragraphs: string[]; signature: string; imageId: string | null };
  promises: { title: string; body: string }[];
  seo: { title: string; description: string };
}

export const DEFAULT_CONTENT: StoreContent = {
  announcement: 'Free shipping in Pune on orders over ₹499 · Ships across India',
  hero: {
    eyebrow: 'From our farm in Mulshi, Pune',
    title: 'Ghee, milk powder and mithai, made the slow way.',
    subtitle: 'Small batches from our own herd, packed to keep for months and shipped to your door anywhere in India.',
    ctaLabel: 'Shop the pantry',
    imageId: null,
  },
  banners: [
    { eyebrow: 'Bilona A2 ghee', title: 'Slow-churned ghee, golden and granular', subtitle: 'Hand-churned from curd and cooked over a wood fire. Keeps 9 months sealed.', ctaLabel: 'Shop ghee', href: '/products?category=ghee', theme: 'ghee', categorySlug: 'ghee', imageId: null },
    { eyebrow: 'Milk that waits for you', title: 'Milk powder and UHT milk, no fridge needed', subtitle: 'Spray-dried and sealed at our dairy. Real milk in your pantry for months.', ctaLabel: 'Shop milk', href: '/products?category=milk-powder', theme: 'milk', categorySlug: 'milk-powder', imageId: null },
    { eyebrow: 'Festive boxes', title: 'Peda, milk cake and condensed milk', subtitle: 'Made from khoa in small batches and packed to travel across India.', ctaLabel: 'Shop mithai', href: '/products?category=condensed-sweets', theme: 'sweets', categorySlug: 'condensed-sweets', imageId: null },
  ],
  story: {
    title: 'Why we make dairy that keeps',
    paragraphs: [
      'Fresh milk travels badly. Ghee, milk powder and long-life milk travel well, and when they are made carefully they taste of the farm months later.',
      'Every jar and tin carries its batch code and expiry date, and we always send the oldest safe batch first, so nothing sits on a shelf until it spoils.',
    ],
    signature: 'The Mulshi Dairy team',
    imageId: null,
  },
  promises: [
    { title: 'Batch-coded', body: 'Batch number and expiry date printed on every pack.' },
    { title: 'Ships in 1–2 days', body: 'Packed and handed to the courier the next working day.' },
    { title: 'Cancel until packed', body: 'Change your mind before we pack and you get a full refund.' },
    { title: 'Pay your way', body: 'UPI, cards and net banking through Cashfree.' },
  ],
  seo: {
    title: 'Mulshi Dairy · Ghee, milk powder and mithai shipped across India',
    description: 'Bilona A2 ghee, milk powder, UHT and flavoured milk, condensed milk and mithai from our Mulshi farm. Shelf-stable, shipped to your door.',
  },
};

export async function loadContent(db: DbOrTx, sellerId: string): Promise<StoreContent> {
  const [row] = await db.select().from(s.settings).where(and(eq(s.settings.sellerId, sellerId), eq(s.settings.key, 'storefront.content')));
  const saved = (row?.value ?? {}) as Partial<StoreContent>;
  return {
    ...DEFAULT_CONTENT,
    ...saved,
    hero: { ...DEFAULT_CONTENT.hero, ...saved.hero },
    story: { ...DEFAULT_CONTENT.story, ...saved.story },
    seo: { ...DEFAULT_CONTENT.seo, ...saved.seo },
    promises: saved.promises?.length ? saved.promises : DEFAULT_CONTENT.promises,
    banners: saved.banners?.length ? saved.banners : DEFAULT_CONTENT.banners,
  };
}

export async function siteImages(db: DbOrTx, storage: Storage, ids: (string | null)[]) {
  const wanted = ids.filter((x): x is string => !!x);
  if (!wanted.length) return new Map<string, ReturnType<typeof imageOut>>();
  const rows = await db.select().from(s.siteMedia).where(inArray(s.siteMedia.id, wanted));
  return new Map(rows.map((r) => [r.id, imageOut(storage, r)]));
}
