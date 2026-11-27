import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Config } from '../config';

/** Where uploaded images live: Cloudflare R2 (recommended in production) or a local folder (development, or a single server). */
export interface Storage {
  kind: 'r2' | 'local';
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
  url(key: string): string;
  /** Local folder served at /media (local storage only). */
  root?: string;
}

const safeKey = (key: string) => {
  if (!/^[a-z0-9/_.-]+$/i.test(key) || key.includes('..')) throw new Error(`unsafe storage key ${key}`);
  return key;
};

export function createStorage(config: Config): Storage {
  const base = config.R2_PUBLIC_BASE_URL.replace(/\/$/, '');
  if (config.R2_ACCOUNT_ID && config.R2_ACCESS_KEY_ID && config.R2_SECRET_ACCESS_KEY && config.R2_BUCKET_MEDIA) {
    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: config.R2_ACCESS_KEY_ID, secretAccessKey: config.R2_SECRET_ACCESS_KEY },
    });
    return {
      kind: 'r2',
      async put(key, body, contentType) {
        await s3.send(new PutObjectCommand({ Bucket: config.R2_BUCKET_MEDIA, Key: safeKey(key), Body: body, ContentType: contentType, CacheControl: 'public, max-age=31536000, immutable' }));
      },
      async delete(key) {
        await s3.send(new DeleteObjectCommand({ Bucket: config.R2_BUCKET_MEDIA, Key: safeKey(key) }));
      },
      url: (key) => `${base}/${key}`,
    };
  }
  // Production without R2 stores photos on the server's disk. The public URL must then be explicit (https),
  // and the web server (Nginx) or this API serves the folder at /media.
  if (config.isProduction && !/^https:\/\//.test(base)) {
    throw new Error('In production set the R2_* variables, or set R2_PUBLIC_BASE_URL to the public https://…/media address of the local media folder');
  }
  const root = path.resolve(config.MEDIA_DIR);
  return {
    kind: 'local',
    root,
    async put(key, body) {
      const file = path.join(root, safeKey(key));
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, body);
    },
    async delete(key) {
      await rm(path.join(root, safeKey(key)), { force: true });
    },
    url: (key) => `${base}/${key}`,
  };
}
