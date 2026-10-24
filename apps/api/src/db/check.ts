import { checkDatabaseConnection, client } from './index.js';

async function main() {
  console.log('Checking database connection to Neon PostgreSQL...');
  const res = await checkDatabaseConnection();
  if (res.ok) {
    console.log('Database connection successful (SELECT 1 OK).');
    await client.end();
    process.exit(0);
  } else {
    console.error('Database connection failed:', res.error);
    await client.end();
    process.exit(1);
  }
}

main();
