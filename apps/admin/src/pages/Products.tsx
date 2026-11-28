import { PackShot } from '@dairy/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PhotoManager } from '../components/PhotoManager';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ColumnDefinition } from 'tabulator-tables';
import { button, el, menuButton, pill } from '../components/cells';
import { DataTable } from '../components/DataTable';
import { Btn, Card, ConfirmDialog, Drawer, Empty, Field, FloatingMenu, Page, RowMenu, input, type MenuAction } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { rupees, type Money } from '../lib/format';

interface Pack {
  kind: string;
  color: string;
  accent: string;
}
interface Row {
  id: string;
  slug: string;
  name: string;
  category: string;
  status: string;
  featured: boolean;
  pack: Pack;
  image: string | null;
  photoCount: number;
  variants: { id: string; sku: string; packSize: string; price: Money; mrp: Money; status: string; available: number; lowStockThreshold: number }[];
}
interface VariantForm {
  id?: string;
  sku: string;
  packSize: string;
  pricePaise: number;
  mrpPaise: number;
  weightGrams: number;
  hsnCode: string;
  gstRateBps: number;
  shelfLifeDays: number;
  storage: 'ambient' | 'cool_dry' | 'chilled';
  lowStockThreshold: number;
  maxPerOrder: number;
}
interface ProductForm {
  id?: string;
  slug: string;
  categoryId: string;
  nameEn: string;
  nameHi: string;
  tagline: string;
  descriptionEn: string;
  searchTerms: string;
  pack: Pack;
  featured: boolean;
  status: 'draft' | 'active' | 'archived';
  variants: VariantForm[];
}

const blankVariant = (): VariantForm => ({
  sku: '',
  packSize: '',
  pricePaise: 10000,
  mrpPaise: 10000,
  weightGrams: 500,
  hsnCode: '0405',
  gstRateBps: 500,
  shelfLifeDays: 180,
  storage: 'ambient',
  lowStockThreshold: 20,
  maxPerOrder: 10,
});

type ProductRow = Row & { minPrice: number; totalStock: number };

type ProductActions = {
  open: (id?: string) => Promise<void>;
  openMenu: (row: Row, anchor: HTMLElement) => void;
  canWrite: boolean;
  canPrice: boolean;
  priceOf: (variantId: string, fallbackPaise: number) => number;
  savePrice: (row: Row, variantId: string, packSize: string, paise: number) => Promise<void>;
};

/** One size's price: a box you can type in. Enter or leaving the box saves, Esc puts the old price back. */
function priceLine(act: { current: ProductActions }, p: ProductRow, v: ProductRow['variants'][number]): HTMLElement {
  const line = el('div', {}, null);
  const row = el('div', { class: 'dt-price' }, el('span', { class: 'dt-price-size', text: p.variants.filter((x) => x.status === 'active').length > 1 ? v.packSize : '' }));
  line.append(row);
  const current = act.current.priceOf(v.id, v.price.amount);
  if (!act.current.canPrice) {
    row.append(el('span', { class: 'dt-num', text: rupees(current) }));
    return line;
  }
  const field = el('label', { class: 'dt-price-field', title: `MRP ${rupees(v.mrp.amount)}. The price cannot be above it.` }, '₹');
  const input = document.createElement('input');
  input.inputMode = 'decimal';
  input.value = String(current / 100);
  input.setAttribute('aria-label', `Price of ${p.name}${p.variants.filter((x) => x.status === 'active').length > 1 ? ` ${v.packSize}` : ''}, in rupees`);
  field.append(input);
  row.append(field);
  const note = el('span', { class: 'dt-sub dt-alert' });
  note.setAttribute('role', 'alert');
  line.append(note);
  let saved = current;
  const fail = (text: string) => {
    field.dataset.state = 'error';
    note.textContent = text;
    input.value = String(saved / 100);
  };
  input.addEventListener('focus', () => input.select());
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') {
      input.value = String(saved / 100);
      note.textContent = '';
      delete field.dataset.state;
      input.blur();
    }
  });
  input.addEventListener('change', async () => {
    note.textContent = '';
    const rupeesValue = Number(input.value.replace(/,/g, ''));
    const paise = Math.round(rupeesValue * 100);
    if (!Number.isFinite(rupeesValue) || input.value.trim() === '') return fail('Enter a price in rupees.');
    if (paise < 100) return fail('The price must be at least ₹1.');
    if (paise > v.mrp.amount) return fail(`Above the MRP of ${rupees(v.mrp.amount)}. Raise the MRP in the product editor first.`);
    if (paise === saved) return void delete field.dataset.state;
    field.dataset.state = 'saving';
    try {
      await act.current.savePrice(p, v.id, v.packSize, paise);
      saved = paise;
      input.value = String(paise / 100);
      field.dataset.state = 'saved';
      setTimeout(() => field.dataset.state === 'saved' && delete field.dataset.state, 1600);
    } catch (e) {
      fail(e instanceof Error ? e.message : 'Could not save the price.');
    }
  });
  return line;
}

function productColumns(act: { current: ProductActions }): ColumnDefinition[] {
  return [
    {
      title: 'Product',
      field: 'name',
      minWidth: 280,
      responsive: 0,
      formatter: (cell) => {
        const p = cell.getData() as ProductRow;
        const thumb = el('span', { class: 'dt-thumb-wrap' });
        if (p.image) {
          const img = el('img', { class: 'dt-thumb' }) as HTMLImageElement;
          img.src = p.image;
          img.alt = '';
          thumb.append(img);
        } else {
          const wrap = el('span', { class: 'dt-thumb' });
          wrap.innerHTML = renderToStaticMarkup(<PackShot kind={p.pack.kind} color={p.pack.color} accent={p.pack.accent} label={p.name} className="h-12 w-9" />);
          thumb.append(wrap);
        }
        const photos = p.photoCount ? `${p.photoCount} photo${p.photoCount > 1 ? 's' : ''}` : 'no photos';
        thumb.append(
          el(
            'span',
            {},
            el(
              'span',
              { class: 'dt-line' },
              el('a', { class: 'dt-link', href: '#/products', text: p.name, onClick: (e) => (e.preventDefault(), void act.current.open(p.id)) }),
              p.featured ? pill('Featured', 'on') : null,
            ),
            el('span', { class: 'dt-sub' }, `${p.category} · `, p.photoCount ? photos : el('span', { class: 'dt-alert', text: 'no photos' })),
          ),
        );
        return thumb;
      },
    },
    {
      title: 'Sizes',
      field: 'sizes',
      minWidth: 120,
      responsive: 3,
      headerSort: false,
      formatter: (cell) =>
        el('span', {
          text: (cell.getData() as ProductRow).variants
            .filter((v) => v.status === 'active')
            .map((v) => v.packSize)
            .join(', '),
        }),
    },
    {
      title: 'Price',
      field: 'minPrice',
      width: 210,
      responsive: 1,
      hozAlign: 'right',
      cssClass: 'dt-right',
      sorter: 'number',
      formatter: (cell) => {
        const p = cell.getData() as ProductRow;
        const box = el('div', {});
        for (const v of p.variants.filter((x) => x.status === 'active')) box.append(priceLine(act, p, v));
        return box;
      },
    },
    {
      title: 'In stock',
      field: 'totalStock',
      width: 180,
      responsive: 2,
      hozAlign: 'right',
      cssClass: 'dt-right',
      sorter: 'number',
      formatter: (cell) => {
        const p = cell.getData() as ProductRow;
        const active = p.variants.filter((v) => v.status === 'active');
        const low = active.some((v) => v.available <= v.lowStockThreshold);
        const box = el('div', { class: 'dt-num' });
        box.style.textAlign = 'right';
        box.append(el('span', { class: p.totalStock === 0 ? 'dt-alert' : low ? 'dt-alert' : '', text: p.totalStock === 0 ? 'Out of stock' : String(p.totalStock) }));
        if (active.length > 1) box.append(el('span', { class: 'dt-sub', text: active.map((v) => `${v.packSize}: ${v.available}`).join(' · ') }));
        if (low && p.totalStock > 0) box.append(el('span', { class: 'dt-sub dt-alert', text: active.length > 1 ? 'low on one size' : 'running low' }));
        return box;
      },
    },
    {
      title: 'Status',
      field: 'status',
      width: 110,
      responsive: 4,
      formatter: (cell) => pill(cell.getValue() === 'active' ? 'On sale' : cell.getValue() === 'draft' ? 'Hidden' : 'Archived', cell.getValue() === 'active' ? 'on' : 'off'),
    },
    {
      title: 'Actions',
      field: 'actions',
      width: 150,
      responsive: 0,
      hozAlign: 'right',
      cssClass: 'dt-right',
      headerSort: false,
      resizable: false,
      formatter: (cell) => {
        const p = cell.getData() as ProductRow;
        const box = el('span', { class: 'dt-actions' });
        box.append(button(act.current.canWrite ? 'Edit' : 'View', () => void act.current.open(p.id), { ariaLabel: `${act.current.canWrite ? 'Edit' : 'View'} ${p.name}` }));
        if (act.current.canWrite) box.append(menuButton(`More actions for ${p.name}`, (anchor) => act.current.openMenu(p, anchor)));
        return box;
      },
    },
  ];
}

export function ProductsPage({ permissions }: { permissions: string[] }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<ProductForm | null>(null);
  const [categories, setCategories] = useState<{ id: string; nameEn: string }[]>([]);
  const [tab, setTab] = useState<'all' | 'active' | 'draft' | 'archived'>('all');
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [confirm, setConfirm] = useState<{ row: Row; kind: 'archive' | 'delete' } | null>(null);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState<{ row: Row; anchor: HTMLElement } | null>(null);
  const canWrite = permissions.includes('catalog.write');
  const load = () =>
    api<{ data: Row[] }>(`/v1/admin/products${q ? `?q=${encodeURIComponent(q)}` : ''}`).then((r) => {
      priceEdits.current.clear(); // the server's prices are the truth again
      setRows(r.data);
    });
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  useEffect(() => {
    api<{ data: { id: string; nameEn: string }[] }>('/v1/admin/categories').then((r) => setCategories(r.data));
  }, []);

  const problem = (e: unknown, fallback: string) => (e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : fallback);

  async function setStatus(row: Row, status: 'active' | 'draft' | 'archived') {
    setNotice(null);
    try {
      await api(`/v1/admin/products/${row.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      await load();
      setNotice({
        kind: 'ok',
        text: status === 'active' ? `${row.name} is now on sale.` : status === 'draft' ? `${row.name} is hidden from the shop.` : `${row.name} is archived and hidden from the shop.`,
      });
    } catch (e) {
      setNotice({ kind: 'error', text: problem(e, 'Could not change the status') });
    }
  }

  async function runConfirmed() {
    if (!confirm) return;
    setBusy(true);
    setNotice(null);
    try {
      if (confirm.kind === 'delete') {
        await api(`/v1/admin/products/${confirm.row.id}`, { method: 'DELETE' });
        setNotice({ kind: 'ok', text: `${confirm.row.name} was deleted.` });
        await load();
      } else {
        await setStatus(confirm.row, 'archived');
      }
      setConfirm(null);
    } catch (e) {
      setConfirm(null);
      setNotice({ kind: 'error', text: problem(e, 'Could not complete that') });
    } finally {
      setBusy(false);
    }
  }

  const actionsFor = (p: Row): MenuAction[] =>
    !canWrite
      ? []
      : [
          p.status === 'active' ? { label: 'Hide from shop', onSelect: () => void setStatus(p, 'draft') } : { label: 'Show in shop', onSelect: () => void setStatus(p, 'active') },
          ...(p.status !== 'archived' ? [{ label: 'Archive…', onSelect: () => setConfirm({ row: p, kind: 'archive' }) }] : []),
          { label: 'Delete…', danger: true, onSelect: () => setConfirm({ row: p, kind: 'delete' }) },
        ];

  const counts = {
    all: rows.length,
    active: rows.filter((r) => r.status === 'active').length,
    draft: rows.filter((r) => r.status === 'draft').length,
    archived: rows.filter((r) => r.status === 'archived').length,
  };
  const shown = useMemo(() => (tab === 'all' ? rows : rows.filter((r) => r.status === tab)), [rows, tab]);

  // Columns are built once; they reach the page's latest handlers through this ref.
  const canPrice = permissions.includes('pricing.write');
  // Prices typed into the table are remembered here, so the table does not need to redraw (which would drop your cursor).
  const priceEdits = useRef(new Map<string, number>());
  const act = useRef<ProductActions>({ open: () => Promise.resolve(), openMenu: () => {}, canWrite, canPrice, priceOf: (_id, fallback) => fallback, savePrice: () => Promise.resolve() });
  async function savePrice(row: Row, variantId: string, packSize: string, paise: number) {
    try {
      await api(`/v1/admin/variants/${variantId}/price`, { method: 'PATCH', body: JSON.stringify({ pricePaise: paise }) });
    } catch (e) {
      throw new Error(problem(e, 'Could not save the price.'));
    }
    priceEdits.current.set(variantId, paise);
    setNotice({ kind: 'ok', text: `Price of ${row.name}${row.variants.filter((v) => v.status === 'active').length > 1 ? ` (${packSize})` : ''} is now ${rupees(paise)}.` });
  }
  const tableRows = useMemo(
    () =>
      shown.map((p) => {
        const active = p.variants.filter((v) => v.status === 'active');
        return { ...p, minPrice: Math.min(...active.map((v) => v.price.amount), Infinity), totalStock: active.reduce((n, v) => n + v.available, 0) };
      }),
    [shown],
  );
  const columns = useMemo<ColumnDefinition[]>(() => productColumns(act), []);

  async function open(id?: string) {
    if (!id) {
      setEditing({
        slug: '',
        categoryId: categories[0]?.id ?? '',
        nameEn: '',
        nameHi: '',
        tagline: '',
        descriptionEn: '',
        searchTerms: '',
        pack: { kind: 'jar', color: '#E9B44C', accent: '#14432F' },
        featured: false,
        status: 'draft',
        variants: [blankVariant()],
      });
      return;
    }
    const p = await api<Omit<ProductForm, 'variants'> & { variants: (VariantForm & { status: string })[] }>(`/v1/admin/products/${id}`);
    const pick = (v: VariantForm & { status: string }): VariantForm => ({
      id: v.id,
      sku: v.sku,
      packSize: v.packSize,
      pricePaise: v.pricePaise,
      mrpPaise: v.mrpPaise,
      weightGrams: v.weightGrams,
      hsnCode: v.hsnCode,
      gstRateBps: v.gstRateBps,
      shelfLifeDays: v.shelfLifeDays,
      storage: v.storage,
      lowStockThreshold: v.lowStockThreshold,
      maxPerOrder: v.maxPerOrder,
    });
    setEditing({
      id: p.id,
      slug: p.slug,
      categoryId: p.categoryId,
      nameEn: p.nameEn,
      nameHi: p.nameHi,
      tagline: p.tagline,
      descriptionEn: p.descriptionEn,
      searchTerms: p.searchTerms,
      pack: p.pack,
      featured: p.featured,
      status: p.status,
      variants: p.variants.filter((v) => v.status === 'active').map(pick),
    });
  }

  act.current = { open, openMenu: (row, anchor) => setMenu({ row, anchor }), canWrite, canPrice, priceOf: (id, fallback) => priceEdits.current.get(id) ?? fallback, savePrice };

  return (
    <Page
      title="Products"
      subtitle={`${counts.all} products · ${counts.active} on sale`}
      actions={
        canWrite && (
          <Btn variant="primary" onClick={() => open()}>
            + New product
          </Btn>
        )
      }
    >
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" aria-label="Search products" className={`${input} mb-3 max-w-xs`} />
      <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Filter by status">
        {(
          [
            ['all', 'All'],
            ['active', 'On sale'],
            ['draft', 'Hidden'],
            ['archived', 'Archived'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`rounded-pill border px-3.5 py-1.5 text-sm ${tab === key ? 'border-forest bg-forest text-on-forest' : 'border-rule bg-paper hover:border-forest'}`}
          >
            {label} <span className="num ml-1 font-semibold">{counts[key]}</span>
          </button>
        ))}
      </div>
      {notice && (
        <p role={notice.kind === 'error' ? 'alert' : 'status'} className={`mb-3 rounded-3 p-3 text-sm ${notice.kind === 'error' ? 'bg-paper-3 text-alert' : 'bg-meadow text-forest'}`}>
          {notice.text}
        </p>
      )}
      {shown.length === 0 && <Empty>{rows.length === 0 ? 'No products yet. Use "+ New product" to add the first one.' : 'No products in this view.'}</Empty>}
      <ul className="space-y-3 md:hidden" aria-label="Products">
        {shown.map((p) => {
          const active = p.variants.filter((v) => v.status === 'active');
          const total = active.reduce((n, v) => n + v.available, 0);
          return (
            <li key={p.id} className="rounded-4 border border-rule bg-paper p-3">
              <div className="flex items-start gap-3">
                {p.image ? (
                  <img src={p.image} alt="" className="h-14 w-14 rounded-2 object-cover" />
                ) : (
                  <PackShot kind={p.pack.kind} color={p.pack.color} accent={p.pack.accent} label={p.name} className="h-14 w-10" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-xs text-ink-2">{p.category}</p>
                  <p className="num mt-1 text-sm">{active.map((v) => rupees(v.price.amount)).join(' · ')}</p>
                  <p className={`text-sm ${total === 0 ? 'font-semibold text-alert' : 'text-ink-2'}`}>{total === 0 ? 'Out of stock' : `${total} in stock`}</p>
                </div>
                <span className={`rounded-pill px-2.5 py-0.5 text-xs ${p.status === 'active' ? 'bg-meadow text-forest' : 'bg-paper-3 text-ink-2'}`}>
                  {p.status === 'active' ? 'On sale' : p.status === 'draft' ? 'Hidden' : 'Archived'}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-end gap-2">
                <Btn variant="outline" onClick={() => open(p.id)}>
                  {canWrite ? 'Edit' : 'View'}
                </Btn>
                {canWrite && <RowMenu label={`More actions for ${p.name}`} actions={actionsFor(p)} />}
              </div>
            </li>
          );
        })}
      </ul>
      <div className={`hidden md:block ${shown.length === 0 ? 'md:hidden' : ''}`}>
        <DataTable
          label="Products"
          data={tableRows}
          columns={columns}
          onRowClick={(p) => void act.current.open(p.id)}
          initialSort={[{ column: 'name', dir: 'asc' }]}
          placeholder="No products in this view."
        />
      </div>
      {menu && <FloatingMenu anchor={menu.anchor} label={`More actions for ${menu.row.name}`} actions={actionsFor(menu.row)} onClose={() => setMenu(null)} />}
      <ConfirmDialog
        open={!!confirm}
        danger={confirm?.kind === 'delete'}
        busy={busy}
        title={confirm?.kind === 'delete' ? `Delete ${confirm.row.name}?` : `Archive ${confirm?.row.name ?? ''}?`}
        confirmLabel={confirm?.kind === 'delete' ? 'Delete product' : 'Archive product'}
        onConfirm={() => void runConfirmed()}
        onCancel={() => setConfirm(null)}
      >
        {confirm?.kind === 'delete' ? (
          <p>This permanently removes the product and its photos. It only works for products that have never been ordered or stocked; otherwise use Archive. This cannot be undone.</p>
        ) : (
          <p>The product disappears from the shop but stays in your order history, and you can show it again any time.</p>
        )}
      </ConfirmDialog>
      <Drawer open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? `Edit ${editing.nameEn}` : 'New product'} wide>
        {editing && (
          <ProductEditor
            key={editing.id ?? 'new'}
            initial={editing}
            categories={categories}
            readOnly={!canWrite}
            onSaved={(id, created) => {
              void load();
              // A new product stays open so photos can be added straight away.
              if (created) void open(id);
              else setEditing(null);
            }}
          />
        )}
      </Drawer>
    </Page>
  );
}

function ProductEditor({
  initial,
  categories,
  onSaved,
  readOnly,
}: {
  initial: ProductForm;
  categories: { id: string; nameEn: string }[];
  onSaved: (id: string, created: boolean) => void;
  readOnly: boolean;
}) {
  const [f, setF] = useState<ProductForm>(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof ProductForm>(k: K, v: ProductForm[K]) => setF((x) => ({ ...x, [k]: v }));
  const setV = (i: number, patch: Partial<VariantForm>) => setF((x) => ({ ...x, variants: x.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)) }));

  async function save() {
    setBusy(true);
    setError(null);
    const { id, ...body } = f;
    try {
      const out = await api<{ id: string }>(id ? `/v1/admin/products/${id}` : '/v1/admin/products', { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) });
      onSaved(out.id, !id);
    } catch (e) {
      setError(e instanceof ApiError ? (e.problem.errors?.[0] ? `${e.problem.errors[0].field}: ${e.problem.errors[0].message}` : (e.problem.detail ?? e.problem.title)) : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  const rupeeInput = (paise: number, onChange: (p: number) => void, label: string) => (
    <Field label={label}>
      <input type="number" min={1} step="0.01" value={paise / 100} onChange={(e) => onChange(Math.round(Number(e.target.value) * 100))} className={`${input} num`} />
    </Field>
  );

  return (
    <fieldset disabled={readOnly || busy} className="space-y-5">
      <div className="grid gap-5 md:grid-cols-[1fr_160px]">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name (English)">
            <input value={f.nameEn} onChange={(e) => set('nameEn', e.target.value)} className={input} />
          </Field>
          <Field label="URL slug" hint="Lowercase letters, numbers, dashes">
            <input value={f.slug} onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} className={`${input} num`} />
          </Field>
          <Field label="Category">
            <select value={f.categoryId} onChange={(e) => set('categoryId', e.target.value)} className={input}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameEn}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Tagline">
              <input value={f.tagline} onChange={(e) => set('tagline', e.target.value)} className={input} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Description">
              <textarea value={f.descriptionEn} onChange={(e) => set('descriptionEn', e.target.value)} rows={3} className={`${input} h-auto py-2`} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Search words" hint="Hindi/Hinglish spellings people type: ghi, doodh, pedha">
              <input value={f.searchTerms} onChange={(e) => set('searchTerms', e.target.value)} className={input} />
            </Field>
          </div>
        </div>
        <div>
          <div className="rounded-4 bg-paper-2 p-3">
            <PackShot kind={f.pack.kind} color={f.pack.color} accent={f.pack.accent} label={f.nameEn || 'Product'} size={f.variants[0]?.packSize} className="w-full" />
          </div>
          <div className="mt-3 space-y-2">
            <Field label="Drawn pack shape" hint="Shown until you add photos">
              <select value={f.pack.kind} onChange={(e) => set('pack', { ...f.pack, kind: e.target.value })} className={input}>
                {['jar', 'tin', 'tetra', 'can', 'box', 'pouch'].map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </Field>
            <div className="flex gap-2">
              <Field label="Pack colour">
                <input type="color" value={f.pack.color} onChange={(e) => set('pack', { ...f.pack, color: e.target.value.toUpperCase() })} className="h-9 w-full rounded-2" />
              </Field>
              <Field label="Label colour">
                <input type="color" value={f.pack.accent} onChange={(e) => set('pack', { ...f.pack, accent: e.target.value.toUpperCase() })} className="h-9 w-full rounded-2" />
              </Field>
            </div>
          </div>
        </div>
      </div>

      <Card title="Photos">{f.id ? <PhotoManager productId={f.id} readOnly={readOnly} /> : <p className="text-sm text-ink-2">Save the product first, then add photos.</p>}</Card>

      <div className="flex flex-wrap gap-4">
        <Field label="Status">
          <select value={f.status} onChange={(e) => set('status', e.target.value as ProductForm['status'])} className={input}>
            <option value="draft">Draft (hidden)</option>
            <option value="active">Active (on sale)</option>
            <option value="archived">Archived</option>
          </select>
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input type="checkbox" checked={f.featured} onChange={(e) => set('featured', e.target.checked)} className="accent-[var(--forest)]" /> Feature on home page
        </label>
      </div>

      <Card
        title="Sizes"
        action={
          <Btn variant="ghost" onClick={() => set('variants', [...f.variants, blankVariant()])}>
            + Add size
          </Btn>
        }
      >
        <div className="space-y-4">
          {f.variants.map((v, i) => (
            <div key={v.id ?? i} className="grid gap-2 rounded-3 bg-paper-2 p-3 sm:grid-cols-4">
              <Field label="SKU">
                <input value={v.sku} onChange={(e) => setV(i, { sku: e.target.value.toUpperCase() })} className={`${input} num`} />
              </Field>
              <Field label="Pack size">
                <input value={v.packSize} onChange={(e) => setV(i, { packSize: e.target.value })} placeholder="500 ml" className={input} />
              </Field>
              {rupeeInput(v.pricePaise, (p) => setV(i, { pricePaise: p }), 'Price ₹')}
              {rupeeInput(v.mrpPaise, (p) => setV(i, { mrpPaise: p }), 'MRP ₹')}
              <Field label="Shipping weight (g)">
                <input type="number" value={v.weightGrams} onChange={(e) => setV(i, { weightGrams: Number(e.target.value) })} className={`${input} num`} />
              </Field>
              <Field label="Shelf life (days)">
                <input type="number" value={v.shelfLifeDays} onChange={(e) => setV(i, { shelfLifeDays: Number(e.target.value) })} className={`${input} num`} />
              </Field>
              <Field label="HSN">
                <input value={v.hsnCode} onChange={(e) => setV(i, { hsnCode: e.target.value })} className={`${input} num`} />
              </Field>
              <Field label="GST %" hint="Confirm with your CA">
                <input type="number" step="0.01" value={v.gstRateBps / 100} onChange={(e) => setV(i, { gstRateBps: Math.round(Number(e.target.value) * 100) })} className={`${input} num`} />
              </Field>
              <Field label="Storage">
                <select value={v.storage} onChange={(e) => setV(i, { storage: e.target.value as VariantForm['storage'] })} className={input}>
                  <option value="ambient">Room temperature</option>
                  <option value="cool_dry">Cool, dry</option>
                  <option value="chilled">Chilled</option>
                </select>
              </Field>
              <Field label="Reorder at">
                <input type="number" value={v.lowStockThreshold} onChange={(e) => setV(i, { lowStockThreshold: Number(e.target.value) })} className={`${input} num`} />
              </Field>
              <Field label="Max per order">
                <input type="number" value={v.maxPerOrder} onChange={(e) => setV(i, { maxPerOrder: Number(e.target.value) })} className={`${input} num`} />
              </Field>
              <div className="flex items-end">
                {f.variants.length > 1 && (
                  <Btn
                    variant="ghost"
                    className="text-alert"
                    onClick={() =>
                      set(
                        'variants',
                        f.variants.filter((_, j) => j !== i),
                      )
                    }
                  >
                    Remove size
                  </Btn>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
      {(!readOnly || error) && (
        <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-wrap items-center gap-3 border-t border-rule bg-paper px-5 py-3">
          {!readOnly && (
            <Btn variant="primary" onClick={save} disabled={busy}>
              {busy ? 'Saving…' : 'Save product'}
            </Btn>
          )}
          {error && (
            <p role="alert" className="text-sm text-alert">
              {error}
            </p>
          )}
        </div>
      )}
      {readOnly && <p className="text-ink-2">Your role can view products but not change them.</p>}
    </fieldset>
  );
}
