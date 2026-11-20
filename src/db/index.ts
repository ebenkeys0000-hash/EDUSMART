import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, PoolConfig } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

function buildPoolConfig(): PoolConfig {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  const maxConnections = process.env.VERCEL ? 5 : 10;

  if (connectionString) {
    const isLocalHost =
      connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
    const useSsl = process.env.SQL_SSL === 'true' || (!isLocalHost && process.env.SQL_SSL !== 'false');

    return {
      connectionString,
      max: maxConnections,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    };
  }

  const host = process.env.SQL_HOST;
  const port = process.env.SQL_PORT ? Number(process.env.SQL_PORT) : 5432;
  const useSsl = process.env.SQL_SSL === 'true';

  return {
    host,
    port,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_DB_NAME,
    max: maxConnections,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  };
}

export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool(buildPoolConfig());

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });
export { pool };
