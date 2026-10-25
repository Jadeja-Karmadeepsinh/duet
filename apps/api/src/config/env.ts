import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Attempt to load .env from workspace root, parent, or current directory
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

const isTestOrBuild = process.env.NODE_ENV === 'test' || process.env.BUILD_PHASE === 'true';

// Normalize aliases before validation
const rawAppInviteCode = process.env.APP_INVITE_CODE || process.env.INVITE_CODE;
const rawInviteCode = process.env.INVITE_CODE || process.env.APP_INVITE_CODE;
const rawCronSecret = process.env.CRON_SECRET || process.env.JOB_SECRET;
const rawJobSecret = process.env.JOB_SECRET || process.env.CRON_SECRET;

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

const envSchema = z
  .object({
    PORT: z.coerce.number().default(8000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    DATABASE_URL_UNPOOLED: z.string().optional(),
    DATABASE_MIGRATION_URL: z.string().optional(),
    SESSION_SECRET: z
      .string()
      .min(16, 'SESSION_SECRET must be at least 16 characters')
      .default('dev-session-secret-at-least-32-characters-long-123456'),
    APP_INVITE_CODE: z.string().min(1).default(rawAppInviteCode || 'focus-team-2026'),
    INVITE_CODE: z.string().min(1).default(rawInviteCode || 'focus-team-2026'),
    JOB_SECRET: z.string().min(1).default(rawJobSecret || 'dev-job-secret-token'),
    CRON_SECRET: z.string().min(1).default(rawCronSecret || 'dev-cron-secret-token'),
    CLIENT_ORIGIN: z.string().default('http://localhost:3000'),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production') {
      // In production, ensure SESSION_SECRET is not the default fallback and is at least 32 chars
      if (data.SESSION_SECRET === 'dev-session-secret-at-least-32-characters-long-123456') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SESSION_SECRET'],
          message:
            'SESSION_SECRET must be explicitly set to a cryptographically secure random string (at least 32 characters) in production.',
        });
      } else if (data.SESSION_SECRET.length < 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SESSION_SECRET'],
          message: 'SESSION_SECRET must be at least 32 characters in production.',
        });
      }

      // In production, warn if DATABASE_URL lacks sslmode=require
      if (
        !data.DATABASE_URL.includes('sslmode=require') &&
        !data.DATABASE_URL.includes('ssl=true')
      ) {
        console.warn(
          '⚠️ [SECURITY WARNING] DATABASE_URL in production should include ?sslmode=require for secure encrypted PostgreSQL connections.'
        );
      }
    }
  });

const parsed = envSchema.safeParse({
  ...process.env,
  APP_INVITE_CODE: rawAppInviteCode || process.env.APP_INVITE_CODE,
  INVITE_CODE: rawInviteCode || process.env.INVITE_CODE,
  CRON_SECRET: rawCronSecret || process.env.CRON_SECRET,
  JOB_SECRET: rawJobSecret || process.env.JOB_SECRET,
});

if (!parsed.success) {
  console.error('❌ Invalid environment variables in apps/api:', parsed.error.format());
  throw new Error('Environment validation failed. Please check your .env configuration.');
}

export const env = parsed.data;
