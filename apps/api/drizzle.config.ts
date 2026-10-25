import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';
import path from 'path';

// Ensure .env is read whether running from workspace root or apps/api
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

const connectionUrl =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.DATABASE_MIGRATION_URL ||
  process.env.DATABASE_URL ||
  '';

if (!connectionUrl) {
  console.warn('[WARN] No database connection URL found in environment variables for drizzle.config.ts');
}

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: connectionUrl,
  },
});
