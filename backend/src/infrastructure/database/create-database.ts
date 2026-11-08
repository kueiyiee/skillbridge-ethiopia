import 'dotenv/config';
import { createMysqlPool } from './connection';

async function createDatabase(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required to create MySQL database.');

  const target = new URL(databaseUrl);
  const databaseName = decodeURIComponent(target.pathname.replace(/^\/+/, ''));
  if (!/^[A-Za-z0-9_]+$/.test(databaseName) || ['information_schema', 'mysql', 'performance_schema', 'sys'].includes(databaseName.toLowerCase())) {
    throw new Error('DATABASE_URL must name a valid application database.');
  }

  target.pathname = '/';
  const pool = createMysqlPool(target.toString());
  try {
    const [existing] = await pool.execute(
      'SELECT SCHEMA_NAME FROM information_schema.schemata WHERE SCHEMA_NAME = ?',
      [databaseName]
    );
    if (Array.isArray(existing) && existing.length > 0) {
      console.log(`Database ${databaseName} already exists; no changes made.`);
      return;
    }

    await pool.query(`CREATE DATABASE \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`Created empty database ${databaseName} with utf8mb4_unicode_ci.`);
  } finally {
    await pool.end();
  }
}

createDatabase().catch((error) => {
  const databaseError = error as { code?: string };
  console.error(`Database creation failed (${databaseError.code ?? 'UNKNOWN'}).`);
  process.exitCode = 1;
});