import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from './lib/api';
import { DispatchPage } from './pages/Dispatch';
import { ProductionPage } from './pages/Production';
import { SignIn } from './pages/SignIn';

export interface StaffMe {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
}

const NAV = [
  { id: 'dispatch', label: 'Dispatch', key: 'd', permission: 'dispatch.manage' },
  { id: 'production', label: 'Production plan', key: 'p', permission: 'inventory.write' },
] as const;
type Page = (typeof NAV)[number]['id'];

const pageFromHash = (): Page => (location.hash.replace('#/', '') as Page) || 'dispatch';

export function App() {
  const [me, setMe] = useState<StaffMe | null | 'signed-out'>(null);
  const [page, setPage] = useState<Page>(pageFromHash());

  const load = useCallback(() => {
    api<StaffMe>('/v1/admin/me')
      .then(setMe)
      .catch((e) => setMe(e instanceof ApiError && [401, 403].includes(e.problem.status) ? 'signed-out' : 'signed-out'));
  }, []);
  useEffect(load, [load]);

  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.metaKey || e.ctrlKey) return;
      const item = NAV.find((n) => n.key === e.key);
      if (item) location.hash = `#/${item.id}`;
    };
    window.addEventListener('hashchange', onHash);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  if (me === null) return <p className="p-6 text-ink-2">Loading…</p>;
  if (me === 'signed-out') return <SignIn onSignedIn={load} />;

  const allowed = NAV.filter((n) => me.permissions.includes(n.permission));
  return (
    <div className="grid min-h-dvh grid-cols-[200px_1fr]">
      <aside className="flex flex-col border-r border-rule bg-paper-2">
        <div className="px-4 py-4 rule-b">
          <p className="font-display text-lg leading-none">Mulshi Dairy</p>
          <p className="mt-1 text-xs uppercase tracking-[0.12em] text-ink-2">Admin</p>
        </div>
        <nav aria-label="Admin" className="flex-1 py-2">
          {allowed.map((n) => (
            <a
              key={n.id}
              href={`#/${n.id}`}
              aria-current={page === n.id ? 'page' : undefined}
              className={`flex items-center justify-between px-4 py-2 ${page === n.id ? 'bg-paper text-ink' : 'text-ink-2 hover:text-ink'}`}
            >
              {n.label}
              <kbd className="num rounded-1 border border-rule px-1 text-xs text-ink-3">{n.key}</kbd>
            </a>
          ))}
        </nav>
        <div className="px-4 py-3 text-xs rule-t">
          <p className="text-ink">{me.name}</p>
          <p className="text-ink-2">{me.role.replace('_', ' ')}</p>
          <button
            type="button"
            className="mt-2 underline underline-offset-2"
            onClick={async () => {
              await api('/v1/auth/logout', { method: 'POST' }).catch(() => undefined);
              setMe('signed-out');
            }}
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="min-w-0">
        {page === 'dispatch' && allowed.some((n) => n.id === 'dispatch') && <DispatchPage />}
        {page === 'production' && allowed.some((n) => n.id === 'production') && <ProductionPage />}
        {!allowed.some((n) => n.id === page) && <p className="p-6 text-ink-2">Your role doesn&rsquo;t include this page.</p>}
      </main>
    </div>
  );
}
