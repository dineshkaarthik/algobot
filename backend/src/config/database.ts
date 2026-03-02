import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { getEnv } from './env.js';
import * as schema from '../models/schema.js';

let _db: ReturnType<typeof drizzle>;
let _pool: pg.Pool;

export function initDatabase() {
  const env = getEnv();
  _pool = new pg.Pool({
    connectionString: env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  _db = drizzle(_pool, { schema });
  return _db;
}

export function getDb() {
  if (!_db) throw new Error('Database not initialized. Call initDatabase() first.');
  return _db;
}

export function getPool() {
  return _pool;
}

export async function closeDatabase() {
  if (_pool) await _pool.end();
}
