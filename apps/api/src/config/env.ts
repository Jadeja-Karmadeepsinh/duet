import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Attempt to load .env from workspace root or current directory
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config();

const isTestOrBuild = process.env.NODE_ENV === 'test' || process.env.BUILD_PHASE === 'true';

// If DATABASE_URL is missing, fail with an actionable message at runtime,
// but provide a placeholder during test/build so commands remain usable.
if (!process.env.DATABASE_URL) {
  if (isTestOrBuild) {
    process.env.DATABASE_URL = 'postgresql://placeholder:placeholder@localhost:5432/placeholder';
  } else {
    console.error('\n' + '='.repeat(60));
    console.error('❌ [CONFIG ERROR] DATABASE_URL is missing!');
    console.error('Please configure DATABASE_URL in your root .env file.');
    console.error('Copy .env.example to .env and provide your Neon PostgreSQL connection string:');
    console.error('  DATABASE_URL="postgresql://user:password@host/neondb?sslmode=require"');
    console.error('='.repeat(60) + '\n');
  }
}

const envSchema = z.object({
  PORT: z.coerce.number().default(8000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET must be at least 16 characters').default('dev-session-secret-at-least-32-characters-long-123456'),
  INVITE_CODE: z.string().min(1).default('focus-team-2026'),
  JOB_SECRET: z.string().min(1).default('dev-job-secret-token'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables in apps/api:', parsed.error.format());
  throw new Error('Environment validation failed. Please check your .env configuration.');
}

export const env = parsed.data;
