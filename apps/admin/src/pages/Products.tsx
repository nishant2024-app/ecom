import { PackShot } from '@dairy/ui';
import { useEffect, useState } from 'react';
import { PhotoManager } from '../components/PhotoManager';
import { Btn, Card, Drawer, Field, Page, input, td, th } from '../components/ui';
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

const blankVariant = (): VariantForm => ({ sku: '', packSize: '', pricePaise: 10000, mrpPaise: 10000, weightGrams: 500, hsnCode: '0405', gstRateBps: 500, shelfLifeDays: 180, storage: 'ambient', lowStockThreshold: 20, maxPerOrder: 10 });

export function ProductsPage({ permissions }: { permissions: string[] }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<ProductForm | null>(null);
  const [categories, setCategories] = useState<{ id: string; nameEn: string }[]>([]);
  const canWrite = permissions.includes('catalog.write');
  const load = () => api<{ data: Row[] }>(`/v1/admin/products${q ? `?q=${encodeURIComponent(q)}` : ''}`).then((r) => setRows(r.data));
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  useEffect(() => {
    api<{ data: { id: string; nameEn: string }[] }>('/v1/admin/categories').then((r) => setCategories(r.data));
  }, []);

  async function open(id?: string) {
    if (!id) {
      setEditing({ slug: '', categoryId: categories[0]?.id ?? '', nameEn: '', nameHi: '', tagline: '', descriptionEn: '', searchTerms: '', pack: { kind: 'jar', color: '#E9B44C', accent: '#14432F' }, featured: false, status: 'draft', variants: [blankVariant()] });
      return;
    }
    const p = await api<Omit<ProductForm, 'variants'> & { variants: (VariantForm & { status: string })[] }>(`/v1/admin/products/${id}`);
    const pick = (v: VariantForm & { status: string }): VariantForm => ({
      id: v.id, sku: v.sku, packSize: v.packSize, pricePaise: v.pricePaise, mrpPaise: v.mrpPaise, weightGrams: v.weightGrams, hsnCode: v.hsnCode,
      gstRateBps: v.gstRateBps, shelfLifeDays: v.shelfLifeDays, storage: v.storage, lowStockThreshold: v.lowStockThreshold, maxPerOrder: v.maxPerOrder,
    });
    setEditing({
      id: p.id, slug: p.slug, categoryId: p.categoryId, nameEn: p.nameEn, nameHi: p.nameHi, tagline: p.tagline, descriptionEn: p.descriptionEn,
      searchTerms: p.searchTerms, pack: p.pack, featured: p.featured, status: p.status,
      variants: p.variants.filter((v) => v.status === 'active').map(pick),
    });
  }

  return (
    <Page title="Products" subtitle={`${rows.length} products`} actions={canWrite && <Btn variant="primary" onClick={() => open()}>+ New product</Btn>}>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" aria-label="Search products" className={`${input} mb-4 max-w-xs`} />
      <div className="overflow-x-auto rounded-4 border border-rule bg-paper">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="rule-b">
              <th className={th}>Product</th>
              <th className={th}>Sizes</th>
              <th className={`${th} text-right`}>Price</th>
              <th className={`${th} text-right`}>Available</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const active = p.variants.filter((v) => v.status === 'active');
              return (
                <tr key={p.id} onClick={() => open(p.id)} className="cursor-pointer rule-b hover:bg-paper-2">
                  <td className={td}>
                    <span className="flex items-center gap-3">
                      {p.image ? (
                        <img src={p.image} alt="" className="h-12 w-12 rounded-2 object-cover" />
                      ) : (
                        <PackShot kind={p.pack.kind} color={p.pack.color} accent={p.pack.accent} label={p.name} className="h-12 w-9" />
                      )}
                      <span>
                        {p.name} {p.featured && <span className="ml-1 rounded-pill bg-meadow text-forest px-2 py-0.5 text-xs">Featured</span>}
                        <span className="block text-xs text-ink-2">
                          {p.category} · {p.photoCount ? `${p.photoCount} photo${p.photoCount > 1 ? 's' : ''}` : <span className="text-alert">no photos</span>}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className={td}>{active.map((v) => v.packSize).join(', ')}</td>
                  <td className={`${td} num text-right`}>{active.map((v) => rupees(v.price.amount)).join(' · ')}</td>
                  <td className={`${td} num text-right`}>
                    {active.map((v) => (
                      <span key={v.id} className={`ml-2 ${v.available <= v.lowStockThreshold ? 'text-alert' : ''}`}>
                        {v.available}
                      </span>
                    ))}
                  </td>
                  <td className={td}>
                    <span className={`rounded-pill px-2.5 py-0.5 text-xs ${p.status === 'active' ? 'bg-meadow' : 'bg-paper-3'}`}>{p.status}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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

function ProductEditor({ initial, categories, onSaved, readOnly }: { initial: ProductForm; categories: { id: string; nameEn: string }[]; onSaved: (id: string, created: boolean) => void; readOnly: boolean }) {
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
          <Field label="Name (English)"><input value={f.nameEn} onChange={(e) => set('nameEn', e.target.value)} className={input} /></Field>
          <Field label="Name (Hindi)"><input value={f.nameHi} onChange={(e) => set('nameHi', e.target.value)} className={input} lang="hi" /></Field>
          <Field label="URL slug" hint="Lowercase letters, numbers, dashes"><input value={f.slug} onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} className={`${input} num`} /></Field>
          <Field label="Category">
            <select value={f.categoryId} onChange={(e) => set('categoryId', e.target.value)} className={input}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.nameEn}</option>)}
            </select>
          </Field>
          <div className="sm:col-span-2"><Field label="Tagline"><input value={f.tagline} onChange={(e) => set('tagline', e.target.value)} className={input} /></Field></div>
          <div className="sm:col-span-2"><Field label="Description"><textarea value={f.descriptionEn} onChange={(e) => set('descriptionEn', e.target.value)} rows={3} className={`${input} h-auto py-2`} /></Field></div>
          <div className="sm:col-span-2"><Field label="Search words" hint="Hindi/Hinglish spellings people type: ghi, doodh, pedha"><input value={f.searchTerms} onChange={(e) => set('searchTerms', e.target.value)} className={input} /></Field></div>
        </div>
        <div>
          <div className="rounded-4 bg-paper-2 p-3">
            <PackShot kind={f.pack.kind} color={f.pack.color} accent={f.pack.accent} label={f.nameEn || 'Product'} size={f.variants[0]?.packSize} className="w-full" />
          </div>
          <div className="mt-3 space-y-2">
            <Field label="Pack">
              <select value={f.pack.kind} onChange={(e) => set('pack', { ...f.pack, kind: e.target.value })} className={input}>
                {['jar', 'tin', 'tetra', 'can', 'box', 'pouch'].map((k) => <option key={k}>{k}</option>)}
              </select>
            </Field>
            <div className="flex gap-2">
              <Field label="Colour"><input type="color" value={f.pack.color} onChange={(e) => set('pack', { ...f.pack, color: e.target.value.toUpperCase() })} className="h-9 w-full rounded-2" /></Field>
              <Field label="Label"><input type="color" value={f.pack.accent} onChange={(e) => set('pack', { ...f.pack, accent: e.target.value.toUpperCase() })} className="h-9 w-full rounded-2" /></Field>
            </div>
          </div>
        </div>
      </div>

      <Card title="Photos">
        {f.id ? <PhotoManager productId={f.id} readOnly={readOnly} /> : <p className="text-sm text-ink-2">Save the product first, then add photos.</p>}
      </Card>

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

      <Card title="Sizes" action={<Btn variant="ghost" onClick={() => set('variants', [...f.variants, blankVariant()])}>+ Add size</Btn>}>
        <div className="space-y-4">
          {f.variants.map((v, i) => (
            <div key={v.id ?? i} className="grid gap-2 rounded-3 bg-paper-2 p-3 sm:grid-cols-4">
              <Field label="SKU"><input value={v.sku} onChange={(e) => setV(i, { sku: e.target.value.toUpperCase() })} className={`${input} num`} /></Field>
              <Field label="Pack size"><input value={v.packSize} onChange={(e) => setV(i, { packSize: e.target.value })} placeholder="500 ml" className={input} /></Field>
              {rupeeInput(v.pricePaise, (p) => setV(i, { pricePaise: p }), 'Price ₹')}
              {rupeeInput(v.mrpPaise, (p) => setV(i, { mrpPaise: p }), 'MRP ₹')}
              <Field label="Shipping weight (g)"><input type="number" value={v.weightGrams} onChange={(e) => setV(i, { weightGrams: Number(e.target.value) })} className={`${input} num`} /></Field>
              <Field label="Shelf life (days)"><input type="number" value={v.shelfLifeDays} onChange={(e) => setV(i, { shelfLifeDays: Number(e.target.value) })} className={`${input} num`} /></Field>
              <Field label="HSN"><input value={v.hsnCode} onChange={(e) => setV(i, { hsnCode: e.target.value })} className={`${input} num`} /></Field>
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
              <Field label="Reorder at"><input type="number" value={v.lowStockThreshold} onChange={(e) => setV(i, { lowStockThreshold: Number(e.target.value) })} className={`${input} num`} /></Field>
              <Field label="Max per order"><input type="number" value={v.maxPerOrder} onChange={(e) => setV(i, { maxPerOrder: Number(e.target.value) })} className={`${input} num`} /></Field>
              <div className="flex items-end">
                {f.variants.length > 1 && <Btn variant="ghost" className="text-alert" onClick={() => set('variants', f.variants.filter((_, j) => j !== i))}>Remove size</Btn>}
              </div>
            </div>
          ))}
        </div>
      </Card>
      {error && <p role="alert" className="text-alert">{error}</p>}
      {!readOnly && <Btn variant="primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save product'}</Btn>}
      {readOnly && <p className="text-ink-2">Your role can view products but not change them.</p>}
    </fieldset>
  );
}
