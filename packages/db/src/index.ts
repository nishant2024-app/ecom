import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export * from './schema';
export { schema };

export type Db = PostgresJsDatabase<typeof schema>;
/** A database handle or a transaction; both expose the same query API. */
export type DbOrTx = Db | Parameters<Parameters<Db['transaction']>[0]>[0];

export interface DbHandle {
  db: Db;
  sql: postgres.Sql;
  close: () => Promise<void>;
}

export function createDb(url: string, options: { max?: number; appName?: string } = {}): DbHandle {
  const sql = postgres(url, {
    max: options.max ?? 10,
    idle_timeout: 30,
    connect_timeout: 10,
    connection: { application_name: options.appName ?? 'dairy', TimeZone: 'UTC' },
    onnotice: () => {},
  });
  const db = drizzle(sql, { schema });
  return { db, sql, close: () => sql.end({ timeout: 5 }) };
}
