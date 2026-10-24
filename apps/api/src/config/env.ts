import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Attempt to load .env from workspace root or current directory
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config();

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
  console.error('Invalid environment variables in apps/api:', parsed.error.format());
  throw new Error('Environment validation failed');
}

export const env = parsed.data;
