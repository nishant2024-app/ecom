import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';

declare global {
  interface Window {
    google?: { accounts: { id: { initialize(o: object): void; renderButton(el: HTMLElement, o: object): void } } };
  }
}

export function SignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [dev, setDev] = useState(false);
  const [email, setEmail] = useState('');

  useEffect(() => {
    api<{ auth: { googleClientId: string; devSignIn: boolean } }>('/v1/app-config')
      .then((c) => {
        setClientId(c.auth.googleClientId);
        setDev(c.auth.devSignIn);
      })
      .catch(() => setError('API unreachable'));
  }, []);

  useEffect(() => {
    if (!clientId) return;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = async () => {
      const { nonce } = await api<{ nonce: string }>('/v1/auth/nonce', { method: 'POST' });
      window.google!.accounts.id.initialize({
        client_id: clientId,
        nonce,
        callback: async ({ credential }: { credential: string }) => {
          try {
            await api('/v1/auth/google', { method: 'POST', body: JSON.stringify({ idToken: credential, client: 'admin' }) });
            onSignedIn();
          } catch (e) {
            setError(e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : 'Sign-in failed');
          }
        },
      });
      window.google!.accounts.id.renderButton(ref.current!, { theme: 'outline', size: 'large', text: 'signin_with', shape: 'rectangular' });
    };
    document.head.appendChild(script);
    return () => script.remove();
  }, [clientId, onSignedIn]);

  return (
    <main className="grid min-h-dvh place-items-center bg-paper-2 px-4 py-10">
      <div className="w-full max-w-sm rounded-4 border border-rule bg-paper p-6 shadow-card">
        <div className="flex items-center gap-3">
          <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden>
            <rect width="40" height="40" rx="12" fill="var(--forest)" />
            <path d="M20 8c4.5 6 8 10.3 8 14.5a8 8 0 0 1-16 0C12 18.3 15.5 14 20 8Z" fill="#fff" />
          </svg>
          <div>
            <h1 className="text-xl font-extrabold leading-none tracking-[-0.03em]">Mulshi Dairy</h1>
            <p className="mt-1 text-xs uppercase tracking-[0.14em] text-ink-3">Admin</p>
          </div>
        </div>
        <p className="mt-5 text-ink-2">Sign in with the Google account your owner invited. Team members only.</p>
        <div className={clientId ? 'mt-5 flex min-h-[44px] justify-center' : 'hidden'} ref={ref} />
        {dev && (
          <form
            className="mt-5 rounded-3 border border-dashed border-rule p-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              try {
                await api('/v1/dev/staff-sign-in', { method: 'POST', body: JSON.stringify({ email }) });
                onSignedIn();
              } catch (err) {
                setError(err instanceof ApiError ? (err.problem.detail ?? err.problem.title) : 'Sign-in failed');
              }
            }}
          >
            <p className="text-sm font-semibold">Local testing</p>
            <p className="mt-1 text-xs text-ink-2">Sign in as the owner email you set in SEED_OWNER_EMAIL. This form is off in production.</p>
            <label className="sr-only" htmlFor="staff-email">
              Staff email
            </label>
            <input
              id="staff-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@example.com"
              className="mt-3 h-10 w-full rounded-3 border border-rule bg-paper px-3 text-sm"
            />
            <button className="mt-2 h-10 w-full rounded-pill bg-forest text-sm font-semibold text-on-forest hover:bg-forest-2">Sign in</button>
          </form>
        )}
        {clientId === '' && !dev && <p className="mt-4 text-ink-2">Google sign-in is not set up yet. Add GOOGLE_WEB_CLIENT_ID to the server settings.</p>}
        {error && (
          <p role="alert" className="mt-4 text-alert">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
