import { useEffect, useMemo, useRef, useState } from 'react';
import type { CellComponent, ColumnDefinition } from 'tabulator-tables';
import { button, el } from '../components/cells';
import { DataTable } from '../components/DataTable';
import { Btn, ConfirmDialog, Field, Page, input } from '../components/ui';
import { api, ApiError } from '../lib/api';

interface Category {
  id: string;
  slug: string;
  nameEn: string;
  blurb: string;
  sort: number;
  productCount: number;
}
type Form = Omit<Category, 'id' | 'productCount'> & { id?: string };

const blank: Form = { slug: '', nameEn: '', blurb: '', sort: 0 };
const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

type CategoryActions = { edit: (c: Category) => void; del: (c: Category) => void; save: (cell: CellComponent) => void; canWrite: boolean };

function categoryColumns(act: { current: CategoryActions }): ColumnDefinition[] {
  // Cells the owner can click and type in. Enter saves, Escape cancels, a wrong value is put back with a message.
  const editable = (title: string, field: keyof Category, extra: Partial<ColumnDefinition> = {}): ColumnDefinition => ({
    title,
    field,
    ...(act.current.canWrite ? { editor: 'input', cssClass: 'dt-editable', cellEdited: (cell: CellComponent) => act.current.save(cell) } : {}),
    ...extra,
  });
  return [
    editable('Order', 'sort', {
      width: 110,
      responsive: 3,
      sorter: 'number',
      editor: act.current.canWrite ? 'number' : undefined,
      editorParams: { min: 0, step: 1 },
      formatter: (c) => el('span', { class: 'dt-num', text: String(c.getValue()) }),
    }),
    editable('Name', 'nameEn', {
      minWidth: 170,
      responsive: 0,
      editorParams: { elementAttributes: { maxlength: '60', 'aria-label': 'Category name' } },
      formatter: (c) => el('span', { text: String(c.getValue() ?? '') }),
    }),
    editable('Description', 'blurb', {
      minWidth: 220,
      responsive: 4,
      editorParams: { elementAttributes: { maxlength: '140', 'aria-label': 'Description' } },
      formatter: (c) => el('span', { class: 'dt-muted', text: String(c.getValue() ?? '') }),
    }),
    {
      title: 'Web address',
      field: 'slug',
      width: 190,
      responsive: 5,
      formatter: (c) => el('span', { class: 'dt-num dt-muted', text: `/products?category=${String(c.getValue())}` }),
    },
    {
      title: 'Products',
      field: 'productCount',
      width: 130,
      responsive: 1,
      hozAlign: 'right',
      cssClass: 'dt-right',
      sorter: 'number',
      formatter: (c) => el('span', { class: 'dt-num', text: String(c.getValue()) }),
    },
    {
      title: 'Actions',
      field: 'actions',
      width: 190,
      responsive: 0,
      hozAlign: 'right',
      cssClass: 'dt-right',
      headerSort: false,
      resizable: false,
      formatter: (cell) => {
        const c = cell.getData() as Category;
        const box = el('span', { class: 'dt-actions' });
        if (!act.current.canWrite) return box;
        box.append(button('Edit all', () => act.current.edit(c), { ariaLabel: `Edit all details of ${c.nameEn}` }));
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
  const [saved, setSaved] = useState<string | null>(null);
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
  const act = useRef<CategoryActions>({ edit: () => {}, del: () => {}, save: () => {}, canWrite });
  async function saveCell(cell: CellComponent) {
    const row = cell.getRow().getData() as Category;
    const field = cell.getField() as keyof Category;
    const value = field === 'sort' ? Number(cell.getValue()) : String(cell.getValue() ?? '').trim();
    const back = (text: string) => {
      cell.restoreOldValue();
      setSaved(null);
      setMsg(`${text} Your change was undone.`);
    };
    if (field === 'sort' && (!Number.isInteger(value) || (value as number) < 0)) return back('Order must be a whole number, zero or more.');
    if (field === 'nameEn' && String(value).length < 2) return back('The name needs at least 2 letters.');
    try {
      await api(`/v1/admin/categories/${row.id}`, {
        method: 'PUT',
        body: JSON.stringify({ slug: row.slug, nameEn: row.nameEn, blurb: row.blurb, sort: row.sort, [field]: value }),
      });
      setMsg(null);
      setSaved(`Saved “${field === 'nameEn' ? value : row.nameEn}”.`);
      const el = cell.getElement();
      el.classList.add('dt-saved');
      setTimeout(() => el.classList.remove('dt-saved'), 1500);
    } catch (e) {
      back(e instanceof ApiError ? (e.problem.errors?.[0] ? `${e.problem.errors[0].message}` : (e.problem.detail ?? e.problem.title)) : 'Could not save. Your change was undone.');
    }
  }
  act.current = {
    edit: (c) => setForm({ id: c.id, slug: c.slug, nameEn: c.nameEn, blurb: c.blurb, sort: c.sort }),
    del: (c) => setToDelete(c),
    save: (cell) => void saveCell(cell),
    canWrite,
  };
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
        <div className="mb-4 grid gap-3 rounded-4 border border-rule bg-paper-2 p-4 md:grid-cols-4">
          <Field label="Name (English)">
            <input autoFocus value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value, slug: form.id ? form.slug : slugify(e.target.value) })} className={input} />
          </Field>
          <Field label="URL slug">
            <input value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} className={`${input} num`} />
          </Field>
          <Field label="Order">
            <input type="number" min={0} value={form.sort} onChange={(e) => setForm({ ...form, sort: Number(e.target.value) })} className={`${input} num`} />
          </Field>
          <div className="md:col-span-4">
            <Field label="One-line description">
              <input value={form.blurb} onChange={(e) => setForm({ ...form, blurb: e.target.value })} className={input} />
            </Field>
          </div>
          <div className="flex gap-2 md:col-span-4">
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
        <p role="alert" className="mb-3 rounded-3 bg-paper-3 p-3 text-sm text-alert">
          {msg}
        </p>
      )}
      {saved && !msg && (
        <p role="status" className="mb-3 rounded-3 bg-meadow p-3 text-sm text-forest">
          {saved}
        </p>
      )}
      {canWrite && rows.length > 0 && <p className="mb-3 text-sm text-ink-2">Tip: click a name, description or order to change it. Press Enter to save or Esc to cancel.</p>}
      <DataTable label="Categories" data={rows} columns={columns} initialSort={[{ column: 'sort', dir: 'asc' }]} placeholder="No categories yet." />
      <ConfirmDialog open={!!toDelete} danger title={`Delete ${toDelete?.nameEn ?? ''}?`} confirmLabel="Delete category" onConfirm={() => void remove()} onCancel={() => setToDelete(null)}>
        <p>The category disappears from the shop menu. This cannot be undone. A category that still has products cannot be deleted.</p>
      </ConfirmDialog>
    </Page>
  );
}
