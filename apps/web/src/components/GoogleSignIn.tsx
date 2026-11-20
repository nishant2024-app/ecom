'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import Script from 'next/script';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api-client';

interface GoogleId {
  initialize(opts: { client_id: string; nonce: string; callback: (r: { credential: string }) => void; ux_mode?: string }): void;
  renderButton(el: HTMLElement, opts: Record<string, unknown>): void;
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

/** Google Identity Services button → POST /v1/auth/google (client "web"). */
export function GoogleSignIn() {
  const router = useRouter();
  const next = useSearchParams().get('next') ?? '/account';
  const button = useRef<HTMLDivElement>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [devSignIn, setDevSignIn] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ auth: { googleClientId: string; devSignIn: boolean } }>('/v1/app-config')
      .then((c) => {
        setClientId(c.auth.googleClientId);
        setDevSignIn(c.auth.devSignIn);
      })
      .catch(() => setError('Could not reach the store. Check your connection.'));
  }, []);

  const init = useCallback(async () => {
    if (!clientId || !scriptReady || !window.google || !button.current) return;
    const { nonce } = await api<{ nonce: string }>('/v1/auth/nonce', { method: 'POST' });
    window.google.accounts.id.initialize({
      client_id: clientId,
      nonce,
      callback: async ({ credential }) => {
        try {
          await api('/v1/auth/google', { method: 'POST', body: JSON.stringify({ idToken: credential, client: 'web' }) });
          router.push(next);
          router.refresh();
        } catch (e) {
          setError(e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : 'Sign-in failed. Try again.');
          void init();
        }
      },
    });
    window.google.accounts.id.renderButton(button.current, { theme: 'outline', size: 'large', text: 'continue_with', shape: 'rectangular', width: 320 });
  }, [clientId, scriptReady, next, router]);

  useEffect(() => {
    void init();
  }, [init]);

  const dev = devSignIn && (
    <form
      className="mt-6 border border-dashed border-ink-3 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const email = String(new FormData(e.currentTarget).get('email'));
        try {
          await api('/v1/dev/sign-in', { method: 'POST', body: JSON.stringify({ email, client: 'web' }) });
          router.push(next);
          router.refresh();
        } catch (err) {
          setError(err instanceof ApiError ? (err.problem.detail ?? err.problem.title) : 'Sign-in failed');
        }
      }}
    >
      <p className="text-sm text-ink-2">Development only: sign in as a test customer.</p>
      <div className="mt-2 flex gap-2">
        <input name="email" type="email" required defaultValue="test.customer@example.in" aria-label="Test email" className="h-11 flex-1 border border-rule bg-paper px-4" />
        <button className="h-11 bg-forest px-5 text-on-forest">Continue</button>
      </div>
    </form>
  );

  if (clientId === '') {
    return (
      <div>
        <p className=" border border-rule p-4 text-ink-2">
          Google sign-in isn&rsquo;t configured on this server yet. Set <code className="num">GOOGLE_WEB_CLIENT_ID</code> for the API (see docs/04-authentication.md).
        </p>
        {dev}
        {error && <p role="alert" className="mt-3 text-alert">{error}</p>}
      </div>
    );
  }
  return (
    <div>
      {dev}
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={() => setScriptReady(true)} />
      <div ref={button} className="min-h-[44px]" />
      {error && (
        <p role="alert" className="mt-3 text-alert">
          {error}
        </p>
      )}
      <p className="mt-6 text-sm text-ink-2">By continuing you agree to our terms and privacy policy.</p>
    </div>
  );
}
