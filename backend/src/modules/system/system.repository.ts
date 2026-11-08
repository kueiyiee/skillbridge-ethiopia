import { db } from '../../infrastructure/database/drizzle';
import { expectedMigrationNames } from '../../infrastructure/database/migrate';

export async function getDatabaseHealth() {
  return db.getHealth();
}

export async function getMigrationLedgerStatus() {
  try {
    const result = await db.query<{ migration_name: string }>('SELECT migration_name FROM skillbridge_migrations');
    const applied = new Set(result.rows.map((row) => row.migration_name));
    return {
      status: expectedMigrationNames.every((name) => applied.has(name)) ? 'up-to-date' : 'pending',
      appliedCount: applied.size,
      expectedCount: expectedMigrationNames.length,
    };
  } catch {
    return { status: 'unknown', appliedCount: null, expectedCount: expectedMigrationNames.length };
  }
}

export async function probeDatabaseConnection(): Promise<void> {
  await db.query('SELECT 1');
}

export async function listSkills() {
  const result = await db.query('SELECT * FROM skills ORDER BY "demandRating" DESC, name ASC');
  return { count: result.rowCount, data: result.rows };
}
