/** Public origin of the storefront, used for canonical URLs, sitemaps and structured data. */
export const SITE_URL = (process.env.SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
export const SITE_NAME = process.env.SITE_NAME ?? 'Mulshi Dairy';
export const abs = (path: string) => `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
