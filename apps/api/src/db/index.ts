import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema/index.js';
import { env } from '../config/env.js';

/**
 * PostgreSQL connection client using postgres.js.
 * Configured with SSL for Neon PostgreSQL and connection pooling.
 * Supports full multi-step ACID transactions via db.transaction().
 */
export const client = postgres(env.DATABASE_URL, {
  ssl: 'require',
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });

/**
 * Health check helper to verify active database connectivity
 */
export async function checkDatabaseConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = await client`SELECT 1 as connected`;
    if (result && result.length > 0) {
      return { ok: true };
    }
    return { ok: false, error: 'Empty query result' };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Database connection error' };
  }
}
