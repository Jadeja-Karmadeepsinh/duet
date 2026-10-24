import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, client } from './index.js';
import path from 'path';

async function runMigrations() {
  console.log('Running Drizzle Kit migrations on PostgreSQL...');
  const migrationsFolder = path.resolve(process.cwd(), './drizzle');
  try {
    await migrate(db, { migrationsFolder });
    console.log('Migrations applied successfully!');
    await client.end();
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    await client.end();
    process.exit(1);
  }
}

runMigrations();
