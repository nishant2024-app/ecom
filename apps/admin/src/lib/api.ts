export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000';

export interface Problem {
  code: string;
  title: string;
  detail?: string;
  status: number;
  requestId: string;
  errors?: { field: string; code: string; message: string }[];
}
export class ApiError extends Error {
  constructor(public readonly problem: Problem) {
    super(problem.detail ?? problem.title);
  }
}

const cookie = (name: string) =>
  document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1);

let refreshing: Promise<boolean> | null = null;
function refresh() {
  refreshing ??= fetch(`${API_URL}/v1/auth/refresh`, { method: 'POST', credentials: 'include', headers: { 'x-csrf-token': cookie('csrf_token') ?? '' } })
    .then((r) => r.ok)
    .finally(() => (refreshing = null));
  return refreshing;
}

export async function api<T>(path: string, init: RequestInit & { idempotencyKey?: string } = {}, retried = false): Promise<T> {
  const headers = new Headers(init.headers);
  if (typeof init.body === 'string') headers.set('content-type', 'application/json');
  const csrf = cookie('csrf_token');
  if (csrf) headers.set('x-csrf-token', csrf);
  if (init.idempotencyKey) headers.set('idempotency-key', init.idempotencyKey);
  headers.set('x-client', 'admin/0.1.0');
  const res = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: 'include' });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (res.ok) return body as T;
  if (res.status === 401 && body?.code === 'AUTH_TOKEN_EXPIRED' && !retried && (await refresh())) return api<T>(path, init, true);
  throw new ApiError(body ?? { code: 'INTERNAL', title: 'Network error', status: res.status, requestId: '' });
}


/** Download a file from an authenticated endpoint (e.g. CSV export). */
export async function download(path: string, fallbackName: string) {
  const res = await fetch(`${API_URL}${path}`, { credentials: 'include', headers: { 'x-client': 'admin/0.1.0' } });
  if (res.status === 401 && (await refresh())) return download(path, fallbackName);
  if (!res.ok) throw new ApiError((await res.json().catch(() => null)) ?? { code: 'INTERNAL', title: 'Download failed', status: res.status, requestId: '' });
  const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface Image {
  id: string;
  url: string;
  alt: string;
  width: number;
  height: number;
  srcset: { url: string; width: number }[];
}

/** Upload one or more images as multipart/form-data. */
export function upload<T>(path: string, files: File[], alt?: string) {
  const form = new FormData();
  if (alt) form.append('alt', alt);
  for (const f of files) form.append('file', f, f.name);
  return api<T>(path, { method: 'POST', body: form });
}

export const thumb = (img: Image, width = 480) => img.srcset.find((s) => s.width >= width)?.url ?? img.url;
