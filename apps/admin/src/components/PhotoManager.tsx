import { Reorder } from 'motion/react';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { api, ApiError, thumb, upload, type Image } from '../lib/api';
import { Btn, ConfirmDialog, input } from './ui';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif';

/** Drop zone + picker. Used for product photos and the storefront image library. */
export function DropZone({ onFiles, busy, label }: { onFiles: (files: File[]) => void; busy: boolean; label: string }) {
  const [over, setOver] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const take = (list: FileList | null) => {
    const files = [...(list ?? [])].filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
    if (files.length) onFiles(files);
  };
  return (
    <div
      onDragOver={(e: DragEvent) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e: DragEvent) => {
        e.preventDefault();
        setOver(false);
        take(e.dataTransfer.files);
      }}
      className={`flex flex-col items-center justify-center gap-2 rounded-3 border-2 border-dashed px-4 py-6 text-center text-sm transition-colors ${over ? 'border-forest bg-meadow/30' : 'border-rule bg-paper-2'}`}
    >
      <p className="text-ink-2">{busy ? 'Uploading and resizing…' : label}</p>
      <Btn variant="outline" disabled={busy} onClick={() => ref.current?.click()}>
        Choose photos
      </Btn>
      <p className="text-xs text-ink-3">JPG, PNG, WebP or HEIC · at least 400 px wide · up to 20 MB</p>
      <input ref={ref} type="file" accept={ACCEPT} multiple hidden onChange={(e) => take(e.target.files)} />
    </div>
  );
}

const errorText = (e: unknown) => (e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : 'Something went wrong');

export function PhotoManager({ productId, readOnly }: { productId: string; readOnly: boolean }) {
  const [photos, setPhotos] = useState<Image[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = `/v1/admin/products/${productId}/media`;

  useEffect(() => {
    api<{ data: Image[] }>(base)
      .then((r) => setPhotos(r.data))
      .catch((e) => setError(errorText(e)));
  }, [base]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const add = (files: File[]) => run(async () => setPhotos((await upload<{ data: Image[] }>(base, files)).data));
  const saveOrder = (list: Image[]) => run(async () => setPhotos((await api<{ data: Image[] }>(`${base}/order`, { method: 'PUT', body: JSON.stringify({ ids: list.map((p) => p.id) }) })).data));
  const [toDelete, setToDelete] = useState<Image | null>(null);
  const remove = (p: Image) => setToDelete(p);
  const confirmRemove = () => {
    const p = toDelete;
    setToDelete(null);
    if (!p) return;
    void run(async () => {
      await api(`/v1/admin/media/${p.id}`, { method: 'DELETE' });
      setPhotos((xs) => xs?.filter((x) => x.id !== p.id) ?? null);
    });
  };
  const saveAlt = (p: Image, alt: string) => {
    if (alt === p.alt) return;
    void run(async () => {
      const out = await api<Image>(`/v1/admin/media/${p.id}`, { method: 'PATCH', body: JSON.stringify({ alt }) });
      setPhotos((xs) => xs?.map((x) => (x.id === p.id ? out : x)) ?? null);
    });
  };

  return (
    <div className="space-y-3">
      <ConfirmDialog open={!!toDelete} danger title="Delete this photo?" confirmLabel="Delete photo" onConfirm={confirmRemove} onCancel={() => setToDelete(null)}>
        <p>The photo is removed from the product and from storage. This cannot be undone.</p>
      </ConfirmDialog>
      {photos && photos.length > 0 && (
        <Reorder.Group axis="x" values={photos} onReorder={setPhotos} className="flex gap-3 overflow-x-auto pb-1" aria-label="Photos, drag to reorder. The first photo is the main image.">
          {photos.map((p, i) => (
            <Reorder.Item
              key={p.id}
              value={p}
              drag={!readOnly}
              onDragEnd={() => photos && saveOrder(photos)}
              className="w-40 shrink-0 cursor-grab rounded-3 border border-rule bg-paper p-2 active:cursor-grabbing"
            >
              <div className="relative">
                <img src={thumb(p)} alt={p.alt} draggable={false} className="aspect-square w-full rounded-2 object-cover" />
                {i === 0 && <span className="absolute left-1 top-1 rounded-1 bg-forest px-1.5 py-0.5 text-[11px] text-on-forest">Main</span>}
              </div>
              <input
                defaultValue={p.alt}
                disabled={readOnly}
                onBlur={(e) => saveAlt(p, e.target.value)}
                aria-label="Describe this photo"
                placeholder="Describe the photo"
                className={`${input} mt-2 h-8 text-xs`}
              />
              {!readOnly && (
                <div className="mt-1 flex justify-between text-xs">
                  <button type="button" disabled={i === 0} className="underline disabled:opacity-30" onClick={() => saveOrder([p, ...photos.filter((x) => x.id !== p.id)])}>
                    Make main
                  </button>
                  <button type="button" className="text-alert underline" onClick={() => remove(p)}>
                    Delete
                  </button>
                </div>
              )}
              <p className="num mt-1 text-[11px] text-ink-3">
                {p.width}×{p.height}
              </p>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      )}
      {photos?.length === 0 && <p className="text-sm text-ink-2">No photos yet. The shop shows a drawn pack until you add one.</p>}
      {!readOnly && <DropZone onFiles={add} busy={busy} label="Drop product photos here. Use a plain background and good daylight." />}
      {error && (
        <p role="alert" className="text-sm text-alert">
          {error}
        </p>
      )}
    </div>
  );
}
