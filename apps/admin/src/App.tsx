import { useCallback, useEffect, useState } from 'react';
import { api } from './lib/api';
import { DashboardPage } from './pages/Dashboard';
import { InventoryPage } from './pages/Inventory';
import { OrderDetailPage, OrdersPage } from './pages/Orders';
import { CustomerDetailPage, CustomersPage, SettingsPage } from './pages/People';
import { CategoriesPage } from './pages/Categories';
import { CouponsPage } from './pages/Coupons';
import { ProductsPage } from './pages/Products';
import { ReviewsPage } from './pages/Reviews';
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
  { id: 'dashboard', label: 'Dashboard', permission: 'dashboard.read' },
  { id: 'orders', label: 'Orders', permission: 'orders.read' },
  { id: 'products', label: 'Products', permission: 'catalog.read' },
  { id: 'categories', label: 'Categories', permission: 'catalog.read' },
  { id: 'inventory', label: 'Inventory', permission: 'catalog.read' },
  { id: 'coupons', label: 'Coupons', permission: 'catalog.read' },
  { id: 'reviews', label: 'Reviews', permission: 'catalog.read' },
  { id: 'storefront', label: 'Storefront', permission: 'catalog.read' },
  { id: 'customers', label: 'Customers', permission: 'customers.read' },
  { id: 'settings', label: 'Settings', permission: 'catalog.read' },
] as const;

const ICONS: Record<string, string> = {
  dashboard: 'M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6V11h-6v9Zm0-16v5h6V4h-6Z',
  orders: 'M6 3h12l2 4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7l2-4Zm-2 4h16M9 11h6',
  products: 'M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Zm9 4.5 9-4.5M12 12v9M12 12 3 7.5',
  categories: 'M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 3.5a3.5 3.5 0 1 0 7 0 3.5 3.5 0 0 0-7 0Z',
  inventory: 'M3 8l9-5 9 5v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8Zm5 12v-7h8v7',
  coupons: 'M3 9a2 2 0 0 0 0 6v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a2 2 0 0 1 0-6V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v3Zm6-1 6 8m-6 0h.01M15 8h.01',
  reviews: 'm12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z',
  storefront: 'M3 9l1.5-5h15L21 9M3 9v1a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0V9M5 13v7h14v-7M10 20v-4h4v4',
  customers: 'M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0ZM4 20a8 8 0 0 1 16 0',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-2a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V20a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H4a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H10a1.7 1.7 0 0 0 1-1.5V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V10a1.7 1.7 0 0 0 1.5 1H20a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z',
};

function NavIcon({ id }: { id: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
      <path d={ICONS[id] ?? ICONS.dashboard} />
    </svg>
  );
}

function parseHash() {
  const [path = '', query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const [section = '', id] = path.split('/');
  return { section, id, params: new URLSearchParams(query) };
}

export function App() {
  const [me, setMe] = useState<StaffMe | null | 'signed-out'>(null);
  const [route, setRoute] = useState(parseHash());
  const [menu, setMenu] = useState(false);

  const load = useCallback(() => {
    api<StaffMe>('/v1/admin/me')
      .then(setMe)
      .catch(() => setMe('signed-out'));
  }, []);
  useEffect(load, [load]);

  useEffect(() => {
    const onHash = () => {
      setRoute(parseHash());
      setMenu(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(false);
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
    <div className="min-h-dvh bg-paper-2 md:grid md:grid-cols-[220px_1fr]">
      {/* Phone and tablet: a top bar with a menu button; the sidebar slides over the page. */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-rule bg-paper px-4 py-2.5 md:hidden">
        <button type="button" onClick={() => setMenu(true)} aria-label="Open menu" aria-expanded={menu} className="grid h-11 w-11 place-items-center rounded-pill hover:bg-paper-2">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <span className="text-lg font-extrabold tracking-[-0.03em]">Mulshi Dairy</span>
        <span className="text-xs uppercase tracking-[0.14em] text-ink-3">Admin</span>
      </header>
      {menu && <div className="fixed inset-0 z-40 bg-ink/40 md:hidden" onClick={() => setMenu(false)} aria-hidden />}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-rule bg-paper transition-transform duration-200 md:sticky md:top-0 md:z-auto md:h-dvh md:w-auto md:translate-x-0 ${menu ? 'translate-x-0' : '-translate-x-full'}`}
      >
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
              className={`flex min-h-[44px] items-center gap-3 rounded-pill px-3.5 py-2 transition-colors ${section === n.id ? 'bg-meadow font-semibold text-forest' : 'text-ink-2 hover:bg-paper-2 hover:text-ink'}`}
            >
              <NavIcon id={n.id} />
              {n.label}
            </a>
          ))}
        </nav>
        <div className="mx-3 mb-3 rounded-4 border border-rule p-3">
          <div className="flex items-center gap-3">
            <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-pill bg-forest text-base font-bold text-on-forest">
              {(me.name || me.email).trim().charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{me.name}</p>
              <p className="truncate text-xs capitalize text-ink-2">{me.role.replace('_', ' ')}</p>
            </div>
          </div>
          <button
            type="button"
            className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-pill border border-rule text-sm font-medium text-ink-2 transition-colors hover:border-alert hover:text-alert"
            onClick={async () => {
              await api('/v1/auth/logout', { method: 'POST' }).catch(() => undefined);
              setMe('signed-out');
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M16 8l4 4-4 4M20 12H9" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>
      <main className="min-w-0">
        {section === 'dashboard' && <DashboardPage />}
        {section === 'orders' &&
          (route.id ? <OrderDetailPage id={route.id} permissions={perms} /> : <OrdersPage key={route.params.get('status') ?? ''} status={route.params.get('status') ?? ''} permissions={perms} />)}
        {section === 'products' && <ProductsPage permissions={perms} />}
        {section === 'categories' && <CategoriesPage permissions={perms} />}
        {section === 'coupons' && <CouponsPage permissions={perms} />}
        {section === 'reviews' && <ReviewsPage permissions={perms} />}
        {section === 'storefront' && <StorefrontPage permissions={perms} />}
        {section === 'inventory' && <InventoryPage permissions={perms} />}
        {section === 'customers' && (route.id ? <CustomerDetailPage id={route.id} /> : <CustomersPage />)}
        {section === 'settings' && <SettingsPage permissions={perms} meId={me.id} />}
        {!section && <p className="p-6 text-ink-2">Your role doesn&rsquo;t include any admin pages yet.</p>}
      </main>
    </div>
  );
}
