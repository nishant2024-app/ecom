import { useEffect, useState } from 'react';
import { DropZone } from '../components/PhotoManager';
import { Btn, Card, Drawer, Field, Page, input } from '../components/ui';
import { api, ApiError, thumb, upload, type Image } from '../lib/api';

interface Content {
  announcement: string;
  hero: { eyebrow: string; title: string; subtitle: string; ctaLabel: string; imageId: string | null };
  story: { title: string; paragraphs: string[]; signature: string; imageId: string | null };
  promises: { title: string; body: string }[];
  banners: Banner[];
  seo: { title: string; description: string };
  images: { hero: Image | null; story: Image | null; banners: (Image | null)[] };
}
interface Banner {
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  href: string;
  theme: 'ghee' | 'milk' | 'sweets' | 'green';
  categorySlug: string | null;
  imageId: string | null;
}
const THEME_LABEL: Record<Banner['theme'], string> = { ghee: 'Ghee gold', milk: 'Milk blue', sweets: 'Mithai brown', green: 'Farm green' };

const area = `${input} h-auto py-2`;

function Counter({ value, max }: { value: string; max: number }) {
  return (
    <span className={`num text-xs ${value.length > max ? 'text-alert' : 'text-ink-3'}`}>
      {value.length}/{max}
    </span>
  );
}

/** Pick an image from the storefront library, or upload a new one. */
function ImagePicker({ value, onChange, readOnly }: { value: Image | null; onChange: (img: Image | null) => void; readOnly: boolean }) {
  const [open, setOpen] = useState(false);
  const [library, setLibrary] = useState<Image[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) api<{ data: Image[] }>('/v1/admin/site-media').then((r) => setLibrary(r.data));
  }, [open]);
  return (
    <div>
      <div className="flex items-center gap-3">
        {value ? (
          <img src={thumb(value)} alt={value.alt} className="h-24 w-36 rounded-2 object-cover" />
        ) : (
          <div className="grid h-24 w-36 place-items-center rounded-2 bg-paper-2 text-xs text-ink-3">No photo</div>
        )}
        {!readOnly && (
          <div className="flex flex-col gap-1">
            <Btn variant="outline" onClick={() => setOpen(true)}>
              {value ? 'Change' : 'Choose photo'}
            </Btn>
            {value && (
              <Btn variant="ghost" onClick={() => onChange(null)}>
                Remove
              </Btn>
            )}
          </div>
        )}
      </div>
      <Drawer open={open} onClose={() => setOpen(false)} title="Storefront photos" wide>
        <DropZone
          busy={busy}
          label="Drop wide photos here: the farm, the kitchen, your products on a table. Landscape works best."
          onFiles={async (files) => {
            setBusy(true);
            setError(null);
            try {
              const r = await upload<{ data: Image[] }>('/v1/admin/site-media', files);
              setLibrary((l) => [...r.data, ...l]);
            } catch (e) {
              setError(e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : 'Upload failed');
            } finally {
              setBusy(false);
            }
          }}
        />
        {error && (
          <p role="alert" className="mt-2 text-sm text-alert">
            {error}
          </p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {library.map((img) => (
            <button
              key={img.id}
              type="button"
              onClick={() => {
                onChange(img);
                setOpen(false);
              }}
              className={`overflow-hidden rounded-3 border-2 text-left ${value?.id === img.id ? 'border-forest' : 'border-transparent hover:border-rule'}`}
            >
              <img src={thumb(img)} alt={img.alt} className="aspect-[4/3] w-full object-cover" />
              <span className="num block px-2 py-1 text-[11px] text-ink-3">
                {img.width}×{img.height}
              </span>
            </button>
          ))}
        </div>
      </Drawer>
    </div>
  );
}

export function StorefrontPage({ permissions }: { permissions: string[] }) {
  const [c, setC] = useState<Content | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [categories, setCategories] = useState<{ slug: string; nameEn: string }[]>([]);
  const readOnly = !permissions.includes('catalog.write');
  useEffect(() => {
    api<Content>('/v1/admin/storefront').then(setC);
    api<{ data: { slug: string; nameEn: string }[] }>('/v1/admin/categories').then((r) => setCategories(r.data));
  }, []);
  if (!c) return <p className="p-6 text-ink-2">Loading…</p>;

  const patch = (p: Partial<Content>) => setC({ ...c, ...p });
  async function save() {
    if (!c) return;
    setBusy(true);
    setMsg(null);
    const { images: _images, ...body } = c;
    try {
      setC(await api<Content>('/v1/admin/storefront', { method: 'PUT', body: JSON.stringify(body) }));
      setMsg({ ok: true, text: 'Saved. The shop updates within a minute.' });
    } catch (e) {
      setMsg({
        ok: false,
        text: e instanceof ApiError ? (e.problem.errors?.[0] ? `${e.problem.errors[0].field}: ${e.problem.errors[0].message}` : (e.problem.detail ?? e.problem.title)) : 'Could not save',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page
      title="Storefront"
      subtitle="Words and photos on the shop's home page."
      actions={
        !readOnly && (
          <Btn variant="primary" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save changes'}
          </Btn>
        )
      }
    >
      <fieldset disabled={readOnly} className="grid gap-4 lg:grid-cols-2">
        <Card title="Announcement bar">
          <Field label="Shown at the very top of every page. Leave empty to hide it.">
            <input value={c.announcement} onChange={(e) => patch({ announcement: e.target.value })} className={input} />
          </Field>
          <Counter value={c.announcement} max={140} />
        </Card>

        <Card title="Search engines and sharing">
          <div className="space-y-3">
            <Field label="Page title">
              <input value={c.seo.title} onChange={(e) => patch({ seo: { ...c.seo, title: e.target.value } })} className={input} />
            </Field>
            <Counter value={c.seo.title} max={70} />
            <Field label="Description (shown under the title in Google)">
              <textarea rows={3} value={c.seo.description} onChange={(e) => patch({ seo: { ...c.seo, description: e.target.value } })} className={area} />
            </Field>
            <Counter value={c.seo.description} max={170} />
          </div>
        </Card>

        <Card title="Banners (rotating slides at the top of the home page)" className="lg:col-span-2">
          <p className="-mt-1 mb-3 text-sm text-ink-2">Each slide shows a colour scene with your products, or your own wide photo if you choose one. Up to 5 slides; they change every 6 seconds.</p>
          <div className="space-y-4">
            {c.banners.map((b, i) => {
              const setB = (patch: Partial<Banner>) => setC({ ...c, banners: c.banners.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
              return (
                <div key={i} className="grid gap-3 rounded-3 bg-paper-2 p-3 md:grid-cols-[1fr_auto]">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Field label="Small line">
                      <input value={b.eyebrow} onChange={(e) => setB({ eyebrow: e.target.value })} className={input} />
                    </Field>
                    <Field label="Button text">
                      <input value={b.ctaLabel} onChange={(e) => setB({ ctaLabel: e.target.value })} className={input} />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field label="Headline">
                        <input value={b.title} onChange={(e) => setB({ title: e.target.value })} className={`${input} font-bold`} />
                      </Field>
                    </div>
                    <div className="sm:col-span-2">
                      <Field label="Sentence">
                        <input value={b.subtitle} onChange={(e) => setB({ subtitle: e.target.value })} className={input} />
                      </Field>
                    </div>
                    <Field label="Colour scene">
                      <select value={b.theme} onChange={(e) => setB({ theme: e.target.value as Banner['theme'] })} className={input}>
                        {Object.entries(THEME_LABEL).map(([k, l]) => (
                          <option key={k} value={k}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Products shown and button link">
                      <select
                        value={b.categorySlug ?? ''}
                        onChange={(e) => setB({ categorySlug: e.target.value || null, href: e.target.value ? `/products?category=${e.target.value}` : '/products' })}
                        className={input}
                      >
                        <option value="">Best sellers → all products</option>
                        {categories.map((cat) => (
                          <option key={cat.slug} value={cat.slug}>
                            {cat.nameEn}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Field label="Photo (optional)">
                      <ImagePicker
                        readOnly={readOnly}
                        value={c.images.banners[i] ?? null}
                        onChange={(img) =>
                          setC({
                            ...c,
                            banners: c.banners.map((x, j) => (j === i ? { ...x, imageId: img?.id ?? null } : x)),
                            images: { ...c.images, banners: c.images.banners.map((x, j) => (j === i ? img : x)) },
                          })
                        }
                      />
                    </Field>
                    {!readOnly && (
                      <div className="flex gap-1 text-xs">
                        <Btn
                          variant="ghost"
                          disabled={i === 0}
                          onClick={() => {
                            const bs = [...c.banners];
                            const im = [...c.images.banners];
                            [bs[i - 1], bs[i]] = [bs[i]!, bs[i - 1]!];
                            [im[i - 1], im[i]] = [im[i] ?? null, im[i - 1] ?? null];
                            setC({ ...c, banners: bs, images: { ...c.images, banners: im } });
                          }}
                        >
                          ↑
                        </Btn>
                        <Btn
                          variant="ghost"
                          disabled={c.banners.length < 2}
                          className="text-alert"
                          onClick={() => setC({ ...c, banners: c.banners.filter((_, j) => j !== i), images: { ...c.images, banners: c.images.banners.filter((_, j) => j !== i) } })}
                        >
                          Remove
                        </Btn>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {!readOnly && c.banners.length < 5 && (
              <Btn
                variant="outline"
                onClick={() =>
                  setC({
                    ...c,
                    banners: [...c.banners, { eyebrow: '', title: 'New banner headline', subtitle: '', ctaLabel: 'Shop now', href: '/products', theme: 'green', categorySlug: null, imageId: null }],
                    images: { ...c.images, banners: [...c.images.banners, null] },
                  })
                }
              >
                + Add banner
              </Btn>
            )}
          </div>
        </Card>

        <Card title="Main heading for Google and screen readers" className="lg:col-span-2">
          <Field label="Not shown on screen; describes the whole shop in one line" hint="Example: Ghee, milk powder and mithai from our farm in Mulshi, shipped across India">
            <input value={c.hero.title} onChange={(e) => patch({ hero: { ...c.hero, title: e.target.value } })} className={input} />
          </Field>
        </Card>

        <Card title="Our story" className="lg:col-span-2">
          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <div className="space-y-3">
              <Field label="Heading">
                <input value={c.story.title} onChange={(e) => patch({ story: { ...c.story, title: e.target.value } })} className={input} />
              </Field>
              {c.story.paragraphs.map((para, i) => (
                <Field key={i} label={`Paragraph ${i + 1}`}>
                  <textarea rows={3} value={para} onChange={(e) => patch({ story: { ...c.story, paragraphs: c.story.paragraphs.map((x, j) => (j === i ? e.target.value : x)) } })} className={area} />
                </Field>
              ))}
              <div className="flex gap-2">
                {c.story.paragraphs.length < 4 && (
                  <Btn variant="ghost" onClick={() => patch({ story: { ...c.story, paragraphs: [...c.story.paragraphs, ''] } })}>
                    + Paragraph
                  </Btn>
                )}
                {c.story.paragraphs.length > 1 && (
                  <Btn variant="ghost" onClick={() => patch({ story: { ...c.story, paragraphs: c.story.paragraphs.slice(0, -1) } })}>
                    Remove last
                  </Btn>
                )}
              </div>
              <Field label="Signed by">
                <input value={c.story.signature} onChange={(e) => patch({ story: { ...c.story, signature: e.target.value } })} className={`${input} max-w-xs`} />
              </Field>
            </div>
            <Field label="Story photo" hint="People, cows, the kitchen. A real photo builds trust.">
              <ImagePicker readOnly={readOnly} value={c.images.story} onChange={(img) => setC({ ...c, story: { ...c.story, imageId: img?.id ?? null }, images: { ...c.images, story: img } })} />
            </Field>
          </div>
        </Card>

        <Card title="Promises (shown as a row of short facts)" className="lg:col-span-2">
          <div className="grid gap-3 md:grid-cols-2">
            {c.promises.map((p, i) => (
              <div key={i} className="rounded-3 bg-paper-2 p-3">
                <Field label="Title">
                  <input value={p.title} onChange={(e) => patch({ promises: c.promises.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} className={input} />
                </Field>
                <Field label="Detail">
                  <input value={p.body} onChange={(e) => patch({ promises: c.promises.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)) })} className={input} />
                </Field>
              </div>
            ))}
          </div>
        </Card>
      </fieldset>
      {msg && (
        <p role="status" className={`mt-4 ${msg.ok ? 'text-forest' : 'text-alert'}`}>
          {msg.text}
        </p>
      )}
    </Page>
  );
}
