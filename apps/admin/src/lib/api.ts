export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000';

export interface Problem {
  code: string;
  title: string;
  detail?: string;
  status: number;
  requestId: string;
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
  if (init.body) headers.set('content-type', 'application/json');
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

export const tomorrowIST = () => new Date(Date.now() + 5.5 * 3600_000 + 86_400_000).toISOString().slice(0, 10);
