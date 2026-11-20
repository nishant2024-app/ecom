import type { ImageVariant } from '@dairy/db';
import sharp from 'sharp';
import { AppError } from '../lib/errors';
import type { Storage } from './storage';

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const WIDTHS = [480, 960, 1600];
const ACCEPTED = new Set(['jpeg', 'png', 'webp', 'avif', 'heif']);

/**
 * Validate an uploaded photo, strip its metadata (GPS etc.), and store WebP versions at
 * 480/960/1600 px wide (never upscaled). Returns the variants, largest last.
 */
export async function storeImage(storage: Storage, input: Buffer, keyPrefix: string): Promise<{ width: number; height: number; variants: ImageVariant[] }> {
  if (input.length > MAX_UPLOAD_BYTES) throw new AppError('VALIDATION_FAILED', 400, 'Images must be under 20 MB');
  let meta: sharp.Metadata;
  try {
    meta = await sharp(input).metadata();
  } catch {
    throw new AppError('VALIDATION_FAILED', 400, 'That file is not an image we can read. Use JPG, PNG, WebP or HEIC.');
  }
  if (!meta.format || !ACCEPTED.has(meta.format) || !meta.width || !meta.height) {
    throw new AppError('VALIDATION_FAILED', 400, 'Use a JPG, PNG, WebP or HEIC photo');
  }
  if (meta.width > 10_000 || meta.height > 10_000) throw new AppError('VALIDATION_FAILED', 400, 'Images can be at most 10,000 px on a side');
  if (meta.width < 400) throw new AppError('VALIDATION_FAILED', 400, 'Images need to be at least 400 px wide to look sharp');

  const rotated = sharp(input).rotate(); // apply EXIF orientation, then metadata is dropped
  const { width: w0, height: h0 } = await rotated.clone().toBuffer({ resolveWithObject: true }).then((r) => r.info);
  const widths = [...new Set(WIDTHS.map((w) => Math.min(w, w0)))];
  const variants: ImageVariant[] = [];
  for (const width of widths) {
    const { data, info } = await rotated.clone().resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
    const key = `${keyPrefix}-${info.width}.webp`;
    await storage.put(key, data, 'image/webp');
    variants.push({ width: info.width, height: info.height, key });
  }
  return { width: w0, height: h0, variants };
}

export async function deleteImage(storage: Storage, variants: ImageVariant[]) {
  for (const v of variants) await storage.delete(v.key).catch(() => undefined);
}

/** Public shape of an image for clients. */
export function imageOut(storage: Storage, row: { id: string; width: number | null; height: number | null; variants: ImageVariant[]; alt: string }) {
  const largest = row.variants.at(-1);
  return {
    id: row.id,
    url: largest ? storage.url(largest.key) : '',
    alt: row.alt,
    width: row.width ?? largest?.width ?? 0,
    height: row.height ?? largest?.height ?? 0,
    srcset: row.variants.map((v) => ({ url: storage.url(v.key), width: v.width })),
  };
}
