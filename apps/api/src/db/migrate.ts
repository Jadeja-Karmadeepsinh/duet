import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { env } from '../config/env.js';

async function runMigrations() {
  console.log('--- Drizzle PostgreSQL Migration Runner ---');

  // Neon Best Practice: Prefer direct unpooled connection string for schema migrations
  const migrationUrl =
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.DATABASE_MIGRATION_URL ||
    env.DATABASE_URL;

  const isPooled = migrationUrl.includes('-pooler');
  if (isPooled) {
    console.warn(
      '⚠️ [NOTICE] Migration URL appears to use a connection pooler (-pooler). For Neon PostgreSQL, using direct unpooled DATABASE_URL_UNPOOLED is strongly recommended for DDL migrations.'
    );
  }

  // Resolve migrations directory robustly across monorepo root, apps/api, or compiled dist
  const candidates = [
    path.resolve(process.cwd(), './drizzle'),
    path.resolve(process.cwd(), './apps/api/drizzle'),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../drizzle'),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../drizzle'),
  ];

  let migrationsFolder: string | null = null;
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.existsSync(path.join(candidate, 'meta'))) {
      migrationsFolder = candidate;
      break;
    }
  }

  if (!migrationsFolder) {
    console.error(
      '❌ Could not locate migrations folder with drizzle metadata in candidates:',
      candidates
    );
    process.exit(1);
  }

  console.log(`Using migrations folder: ${migrationsFolder}`);

  // Create single-connection client dedicated to migration runner
  const migrationClient = postgres(migrationUrl, {
    ssl: 'require',
    max: 1,
    connect_timeout: 20,
  });

  const migrationDb = drizzle(migrationClient);

  try {
    console.log('Applying committed Drizzle migrations...');
    await migrate(migrationDb, { migrationsFolder });
    console.log('✅ Migrations applied successfully!');
    await migrationClient.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    await migrationClient.end();
    process.exit(1);
  }
}

runMigrations();
