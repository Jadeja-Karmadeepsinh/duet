import { migrate } from 'drizzle-orm/neon-http/migrator';
import { db } from './index.js';
import path from 'path';

async function runMigrations() {
  console.log('Running Drizzle Kit migrations on Neon PostgreSQL...');
  const migrationsFolder = path.resolve(process.cwd(), './drizzle');
  try {
    await migrate(db, { migrationsFolder });
    console.log('Migrations applied successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

runMigrations();
