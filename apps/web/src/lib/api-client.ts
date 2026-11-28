'use client';

/** Problem details returned by the API (RFC 9457). */
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

function cookie(name: string): string | undefined {
  return document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

let refreshing: Promise<boolean> | null = null;
async function refresh(): Promise<boolean> {
  refreshing ??= fetch('/api/v1/auth/refresh', {
    method: 'POST',
    credentials: 'include',
    headers: { 'x-csrf-token': cookie('csrf_token') ?? '' },
  })
    .then((r) => r.ok)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** True when this browser holds a sign-in. Anonymous visitors should not ask the API who they are (it would answer 401). */
export const hasSession = () => !!cookie('csrf_token');

/** Browser call to the API through the storefront's /api proxy, with one automatic token refresh. */
export async function api<T>(path: string, init: RequestInit & { idempotencyKey?: string } = {}, retried = false): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const csrf = cookie('csrf_token');
  if (csrf) headers.set('x-csrf-token', csrf);
  if (init.idempotencyKey) headers.set('idempotency-key', init.idempotencyKey);
  headers.set('x-client', 'web/0.1.0');
  const res = await fetch(`/api${path}`, { ...init, headers, credentials: 'include' });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (res.ok) return body as T;
  if (res.status === 401 && body?.code === 'AUTH_TOKEN_EXPIRED' && !retried && (await refresh())) {
    return api<T>(path, init, true);
  }
  throw new ApiError(body ?? { code: 'INTERNAL', title: 'Network error', status: res.status, requestId: '' });
}
