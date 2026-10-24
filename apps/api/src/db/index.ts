import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema.js';
import { env } from '../config/env.js';

const sql = neon(env.DATABASE_URL);
export const db = drizzle(sql, { schema });

/**
 * Health check helper to verify active database connectivity
 */
export async function checkDatabaseConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = await sql`SELECT 1 as connected`;
    if (result && result.length > 0) {
      return { ok: true };
    }
    return { ok: false, error: 'Empty query result' };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Database connection error' };
  }
}
