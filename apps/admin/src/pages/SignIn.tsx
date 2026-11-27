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
    <div className="mx-auto max-w-sm px-6 py-24">
      <p className="text-2xl font-extrabold tracking-[-0.03em]">Mulshi Dairy admin</p>
      <p className="mt-2 text-ink-2">Team members only. Ask the owner to invite your Google account.</p>
      <div className="mt-6" ref={ref} />
      {dev && (
        <form
          className="mt-6 rounded-4 border border-dashed border-rule p-4"
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
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="owner@example.com"
            aria-label="Staff email"
            className="mt-3 h-10 w-full rounded-3 border border-rule bg-paper px-3 text-sm"
          />
          <button className="mt-2 h-10 w-full rounded-pill bg-forest text-sm font-semibold text-on-forest">Sign in</button>
        </form>
      )}
      {clientId === '' && !dev && <p className="mt-4 text-ink-2">Set GOOGLE_WEB_CLIENT_ID on the API to enable sign-in.</p>}
      {error && (
        <p role="alert" className="mt-4 text-alert">
          {error}
        </p>
      )}
    </div>
  );
}
