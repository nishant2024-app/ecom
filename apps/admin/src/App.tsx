import { useCallback, useEffect, useState } from 'react';
import { api } from './lib/api';
import { DashboardPage } from './pages/Dashboard';
import { InventoryPage } from './pages/Inventory';
import { OrderDetailPage, OrdersPage } from './pages/Orders';
import { CustomerDetailPage, CustomersPage, SettingsPage } from './pages/People';
import { CategoriesPage } from './pages/Categories';
import { ProductsPage } from './pages/Products';
import { StorefrontPage } from './pages/Storefront';
import { SignIn } from './pages/SignIn';

export interface StaffMe {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
}

const NAV = [
  { id: 'dashboard', label: 'Dashboard', key: 'g', permission: 'dashboard.read' },
  { id: 'orders', label: 'Orders', key: 'o', permission: 'orders.read' },
  { id: 'products', label: 'Products', key: 'p', permission: 'catalog.read' },
  { id: 'categories', label: 'Categories', key: 'k', permission: 'catalog.read' },
  { id: 'inventory', label: 'Inventory', key: 'i', permission: 'catalog.read' },
  { id: 'storefront', label: 'Storefront', key: 'f', permission: 'catalog.read' },
  { id: 'customers', label: 'Customers', key: 'c', permission: 'customers.read' },
  { id: 'settings', label: 'Settings', key: 's', permission: 'catalog.read' },
] as const;

function parseHash() {
  const [path = '', query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const [section = '', id] = path.split('/');
  return { section, id, params: new URLSearchParams(query) };
}

export function App() {
  const [me, setMe] = useState<StaffMe | null | 'signed-out'>(null);
  const [route, setRoute] = useState(parseHash());

  const load = useCallback(() => {
    api<StaffMe>('/v1/admin/me')
      .then(setMe)
      .catch(() => setMe('signed-out'));
  }, []);
  useEffect(load, [load]);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
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
  const section = allowed.some((n) => n.id === route.section) ? route.section : (allowed[0]?.id ?? '');
  const perms = me.permissions;

  return (
    <div className="grid min-h-dvh grid-cols-[220px_1fr] bg-paper-2">
      <aside className="sticky top-0 flex h-dvh flex-col border-r border-rule bg-paper">
        <div className="flex items-center gap-2 px-5 py-5">
          <svg width="28" height="28" viewBox="0 0 40 40" aria-hidden>
            <rect width="40" height="40" rx="12" fill="var(--forest)" />
            <path d="M20 8c4.5 6 8 10.3 8 14.5a8 8 0 0 1-16 0C12 18.3 15.5 14 20 8Z" fill="#fff" />
          </svg>
          <div>
            <p className="text-lg font-extrabold leading-none tracking-[-0.03em]">Mulshi Dairy</p>
            <p className="mt-1 text-xs uppercase tracking-[0.14em] text-ink-3">Admin</p>
          </div>
        </div>
        <nav aria-label="Admin" className="flex-1 space-y-0.5 px-3">
          {allowed.map((n) => (
            <a
              key={n.id}
              href={`#/${n.id}`}
              aria-current={section === n.id ? 'page' : undefined}
              className={`flex items-center justify-between rounded-pill px-3 py-2 transition-colors ${section === n.id ? 'bg-meadow font-semibold text-forest' : 'text-ink-2 hover:bg-paper-2 hover:text-ink'}`}
            >
              {n.label}
              <kbd className={`num rounded-1 px-1 text-xs ${section === n.id ? 'text-forest/60' : 'text-ink-3'}`}>{n.key}</kbd>
            </a>
          ))}
        </nav>
        <div className="mx-3 mb-3 rounded-3 bg-paper-2 p-3 text-xs">
          <p className="font-semibold">{me.name}</p>
          <p className="capitalize text-ink-2">{me.role.replace('_', ' ')}</p>
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
        {section === 'dashboard' && <DashboardPage />}
        {section === 'orders' && (route.id ? <OrderDetailPage id={route.id} permissions={perms} /> : <OrdersPage key={route.params.get('status') ?? ''} status={route.params.get('status') ?? ''} permissions={perms} />)}
        {section === 'products' && <ProductsPage permissions={perms} />}
        {section === 'categories' && <CategoriesPage permissions={perms} />}
        {section === 'storefront' && <StorefrontPage permissions={perms} />}
        {section === 'inventory' && <InventoryPage permissions={perms} />}
        {section === 'customers' && (route.id ? <CustomerDetailPage id={route.id} /> : <CustomersPage />)}
        {section === 'settings' && <SettingsPage permissions={perms} meId={me.id} />}
        {!section && <p className="p-6 text-ink-2">Your role doesn&rsquo;t include any admin pages yet.</p>}
      </main>
    </div>
  );
}
