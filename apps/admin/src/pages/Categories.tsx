import { useEffect, useState } from 'react';
import { Btn, Empty, Field, Page, input, td, th } from '../components/ui';
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

export function CategoriesPage({ permissions }: { permissions: string[] }) {
  const [rows, setRows] = useState<Category[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
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
  async function remove(c: Category) {
    if (!confirm(`Delete the category "${c.nameEn}"?`)) return;
    try {
      await api(`/v1/admin/categories/${c.id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setMsg(e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : 'Could not delete');
    }
  }

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
      <div tabIndex={0} className="overflow-x-auto rounded-4 border border-rule bg-paper">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="rule-b">
              <th className={th}>#</th>
              <th className={th}>Category</th>
              <th className={th}>Description</th>
              <th className={`${th} text-right`}>Products</th>
              <th className={th}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="rule-b">
                <td className={`${td} num text-ink-2`}>{c.sort}</td>
                <td className={td}>
                  {c.nameEn}{' '}
                  <span className="text-ink-2" lang="hi">
                    · {c.nameHi}
                  </span>
                  <span className="num block text-xs text-ink-3">/products?category={c.slug}</span>
                </td>
                <td className={`${td} text-sm text-ink-2`}>{c.blurb}</td>
                <td className={`${td} num text-right`}>{c.productCount}</td>
                <td className={`${td} whitespace-nowrap text-right`}>
                  {canWrite && (
                    <>
                      <Btn variant="ghost" onClick={() => setForm({ id: c.id, slug: c.slug, nameEn: c.nameEn, nameHi: c.nameHi, blurb: c.blurb, sort: c.sort })}>
                        Edit
                      </Btn>
                      <Btn variant="ghost" className="text-alert" disabled={c.productCount > 0} title={c.productCount > 0 ? 'Move its products first' : undefined} onClick={() => remove(c)}>
                        Delete
                      </Btn>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="p-4">
            <Empty>No categories yet.</Empty>
          </div>
        )}
      </div>
    </Page>
  );
}
