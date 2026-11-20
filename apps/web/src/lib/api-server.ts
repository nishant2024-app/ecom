import 'server-only';

const base = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

/** Server-side GET against the API. Catalog data is cached and revalidated every 60 s. */
export async function apiGet<T>(path: string, init: { revalidate?: number; lang?: string } = {}): Promise<T | null> {
  try {
    const res = await fetch(`${base}${path}`, {
      headers: { 'accept-language': init.lang ?? 'en' },
      next: { revalidate: init.revalidate ?? 60 },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`${path} → ${res.status}`);
    return (await res.json()) as T;
  } catch (err) {
    console.error('api error', err);
    return null;
  }
}
