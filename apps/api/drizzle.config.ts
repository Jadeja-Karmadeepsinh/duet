import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';
import path from 'path';

// Ensure .env is read whether running from workspace root or apps/api
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config();

if (!process.env.DATABASE_URL) {
  console.warn('[WARN] DATABASE_URL is not set in environment variables for drizzle.config.ts');
}

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || '',
  },
});
