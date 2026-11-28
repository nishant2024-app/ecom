import { useEffect, useMemo, useRef, useState } from 'react';
import type { ColumnDefinition } from 'tabulator-tables';
import { button, el } from '../components/cells';
import { DataTable } from '../components/DataTable';
import { Btn, ConfirmDialog, Field, Page, input } from '../components/ui';
import { api, ApiError } from '../lib/api';

interface Category {
  id: string;
  slug: string;
  nameEn: string;
  nameHi: string;
  blurb: string;
  sort: number;
  productCount: number;
}
type Form = Omit<Category, 'id' | 'productCount'> & { id?: string };

const blank: Form = { slug: '', nameEn: '', nameHi: '', blurb: '', sort: 0 };
const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function categoryColumns(act: { current: { edit: (c: Category) => void; del: (c: Category) => void; canWrite: boolean } }): ColumnDefinition[] {
  return [
    { title: '#', field: 'sort', width: 70, responsive: 3, sorter: 'number', formatter: (c) => el('span', { class: 'dt-num dt-muted', text: String(c.getValue()) }) },
    {
      title: 'Category',
      field: 'nameEn',
      minWidth: 240,
      responsive: 0,
      formatter: (cell) => {
        const c = cell.getData() as Category;
        return el('div', {}, el('span', {}, c.nameEn, el('span', { class: 'dt-muted', text: ` · ${c.nameHi}` })), el('span', { class: 'dt-sub dt-num', text: `/products?category=${c.slug}` }));
      },
    },
    { title: 'Description', field: 'blurb', minWidth: 200, responsive: 2, formatter: (c) => el('span', { class: 'dt-muted', text: String(c.getValue() ?? '') }) },
    {
      title: 'Products',
      field: 'productCount',
      width: 120,
      responsive: 1,
      hozAlign: 'right',
      cssClass: 'dt-right',
      sorter: 'number',
      formatter: (c) => el('span', { class: 'dt-num', text: String(c.getValue()) }),
    },
    {
      title: 'Actions',
      field: 'actions',
      width: 170,
      responsive: 0,
      hozAlign: 'right',
      cssClass: 'dt-right',
      headerSort: false,
      resizable: false,
      formatter: (cell) => {
        const c = cell.getData() as Category;
        const box = el('span', { class: 'dt-actions' });
        if (!act.current.canWrite) return box;
        box.append(button('Edit', () => act.current.edit(c), { ariaLabel: `Edit ${c.nameEn}` }));
        box.append(
          button('Delete', () => act.current.del(c), {
            ariaLabel: `Delete ${c.nameEn}`,
            danger: true,
            disabled: c.productCount > 0,
            title: c.productCount > 0 ? 'Move its products first' : undefined,
          }),
        );
        return box;
      },
    },
  ];
}

export function CategoriesPage({ permissions }: { permissions: string[] }) {
  const [rows, setRows] = useState<Category[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Category | null>(null);
  const canWrite = permissions.includes('catalog.write');
  const load = () => api<{ data: Category[] }>('/v1/admin/categories').then((r) => setRows(r.data));
  useEffect(() => {
    void load();
  }, []);

  async function save() {
    if (!form) return;
    setMsg(null);
    const { id, ...body } = form;
    try {
      await api(id ? `/v1/admin/categories/${id}` : '/v1/admin/categories', { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) });
      setForm(null);
      await load();
    } catch (e) {
      setMsg(e instanceof ApiError ? (e.problem.errors?.[0] ? `${e.problem.errors[0].field}: ${e.problem.errors[0].message}` : (e.problem.detail ?? e.problem.title)) : 'Could not save');
    }
  }
  async function remove() {
    if (!toDelete) return;
    try {
      await api(`/v1/admin/categories/${toDelete.id}`, { method: 'DELETE' });
      setToDelete(null);
      await load();
    } catch (e) {
      setToDelete(null);
      setMsg(e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : 'Could not delete');
    }
  }
  const act = useRef({ edit: (_c: Category) => {}, del: (_c: Category) => {}, canWrite });
  act.current = { edit: (c) => setForm({ id: c.id, slug: c.slug, nameEn: c.nameEn, nameHi: c.nameHi, blurb: c.blurb, sort: c.sort }), del: (c) => setToDelete(c), canWrite };
  const columns = useMemo<ColumnDefinition[]>(() => categoryColumns(act), []);

  return (
    <Page
      title="Categories"
      subtitle="Groups that customers browse by. Order sets their position in the menu."
      actions={
        canWrite && (
          <Btn variant="primary" onClick={() => setForm({ ...blank, sort: rows.length + 1 })}>
            + New category
          </Btn>
        )
      }
    >
      {form && (
        <div className="mb-4 grid gap-3 rounded-4 border border-rule bg-paper-2 p-4 md:grid-cols-5">
          <Field label="Name (English)">
            <input autoFocus value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value, slug: form.id ? form.slug : slugify(e.target.value) })} className={input} />
          </Field>
          <Field label="Name (Hindi)">
            <input lang="hi" value={form.nameHi} onChange={(e) => setForm({ ...form, nameHi: e.target.value })} className={input} />
          </Field>
          <Field label="URL slug">
            <input value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} className={`${input} num`} />
          </Field>
          <Field label="Order">
            <input type="number" min={0} value={form.sort} onChange={(e) => setForm({ ...form, sort: Number(e.target.value) })} className={`${input} num`} />
          </Field>
          <div className="md:col-span-5">
            <Field label="One-line description">
              <input value={form.blurb} onChange={(e) => setForm({ ...form, blurb: e.target.value })} className={input} />
            </Field>
          </div>
          <div className="flex gap-2 md:col-span-5">
            <Btn variant="primary" onClick={save}>
              Save
            </Btn>
            <Btn variant="ghost" onClick={() => setForm(null)}>
              Cancel
            </Btn>
          </div>
        </div>
      )}
      {msg && (
        <p role="alert" className="mb-3 text-alert">
          {msg}
        </p>
      )}
      <DataTable label="Categories" data={rows} columns={columns} initialSort={[{ column: 'sort', dir: 'asc' }]} placeholder="No categories yet." />
      <ConfirmDialog open={!!toDelete} danger title={`Delete ${toDelete?.nameEn ?? ''}?`} confirmLabel="Delete category" onConfirm={() => void remove()} onCancel={() => setToDelete(null)}>
        <p>The category disappears from the shop menu. This cannot be undone. A category that still has products cannot be deleted.</p>
      </ConfirmDialog>
    </Page>
  );
}
