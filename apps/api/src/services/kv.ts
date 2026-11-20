import { Redis } from 'ioredis';

/** Small key-value interface over Valkey, with an in-memory version for tests. */
export interface Kv {
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  get(key: string): Promise<string | null>;
  /** Get and delete atomically (single-use tokens). */
  take(key: string): Promise<string | null>;
  del(key: string): Promise<void>;
  ping(): Promise<boolean>;
  close(): Promise<void>;
  redis?: Redis;
}

export function createRedisKv(url: string): Kv {
  const redis = new Redis(url, { maxRetriesPerRequest: 2, enableOfflineQueue: false, lazyConnect: false });
  redis.on('error', () => {
    /* surfaced via readiness checks */
  });
  return {
    redis,
    async set(key, value, ttl) {
      await redis.set(key, value, 'EX', ttl);
    },
    get: (key) => redis.get(key),
    take: (key) => redis.getdel(key),
    async del(key) {
      await redis.del(key);
    },
    async ping() {
      try {
        return (await redis.ping()) === 'PONG';
      } catch {
        return false;
      }
    },
    async close() {
      redis.disconnect();
    },
  };
}

export function createMemoryKv(): Kv {
  const store = new Map<string, { value: string; expires: number }>();
  const live = (key: string) => {
    const e = store.get(key);
    if (!e) return null;
    if (e.expires < Date.now()) {
      store.delete(key);
      return null;
    }
    return e.value;
  };
  return {
    async set(key, value, ttl) {
      store.set(key, { value, expires: Date.now() + ttl * 1000 });
    },
    async get(key) {
      return live(key);
    },
    async take(key) {
      const v = live(key);
      store.delete(key);
      return v;
    },
    async del(key) {
      store.delete(key);
    },
    async ping() {
      return true;
    },
    async close() {},
  };
}
