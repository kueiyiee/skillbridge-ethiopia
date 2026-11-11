import 'dotenv/config';
import { type RowDataPacket } from 'mysql2/promise';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createMysqlPool } from './connection';

export const expectedMigrationNames = [
  '20261012000100_mysql_baseline',
  '20261018000100_admin_auth_security',
  '20261019000100_admin_governance_indexes',
  '20261020000100_account_profiles_privacy',
  '20261022000100_admin_crud_archive',
  '20261022000200_email_otp_verification',
  '20261023000100_shared_login_rate_limits',
  '20261023000200_admin_email_verification',
  '20261023000300_employer_verification_documents',
  '20261023000400_password_reset_security',
  '20261023000500_email_verification_evidence',
  '20261025000100_application_messaging',
  '20261025000200_employer_recruitment_workflow',
  '20261026000100_candidate_skill_assessments',
  '20261112000100_verified_report_registry',
  '20261112000200_authenticator_mfa'
];

const migrations = expectedMigrationNames.map((name) => ({
  name,
  path: resolve(process.cwd(), 'prisma/migrations', name, 'migration.sql')
}));

export async function migrateDatabase(databaseUrl = process.env.DATABASE_URL): Promise<void> {
  if (!databaseUrl) throw new Error('DATABASE_URL is required to apply MySQL migrations.');

  const pool = createMysqlPool(databaseUrl);
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS skillbridge_migrations (
        migration_name VARCHAR(191) NOT NULL PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    for (const migration of migrations) {
      const [applied] = await pool.execute<RowDataPacket[]>(
        'SELECT migration_name FROM skillbridge_migrations WHERE migration_name = ?',
        [migration.name]
      );
      if (applied.length > 0) continue;

      if (migration.name === migrations[0].name) {
        try {
          const [legacyApplied] = await pool.execute<RowDataPacket[]>(
            'SELECT migration_name FROM _prisma_migrations WHERE migration_name = ? AND finished_at IS NOT NULL LIMIT 1',
            [migration.name]
          );
          if (legacyApplied.length > 0) {
            await pool.execute('INSERT INTO skillbridge_migrations (migration_name) VALUES (?)', [migration.name]);
            continue;
          }
        } catch (error) {
          const databaseError = error as { code?: string; errno?: number };
          if (databaseError.code !== 'ER_NO_SUCH_TABLE' && databaseError.errno !== 1146) throw error;
        }

        const [existingTables] = await pool.execute<RowDataPacket[]>(
          `SELECT COUNT(*) AS count FROM information_schema.tables
           WHERE table_schema = DATABASE() AND table_name = 'users'`
        );
        if (Number(existingTables[0]?.count ?? 0) > 0) {
          throw new Error('Application tables exist without a recognized migration record; refusing to apply the baseline.');
        }
      }

      const migrationSql = await readFile(migration.path, 'utf8');
      const statements = migrationSql.split(';').map((statement) => statement.trim()).filter(Boolean);
      for (const statement of statements) await pool.query(statement);

      await pool.execute('INSERT INTO skillbridge_migrations (migration_name) VALUES (?)', [migration.name]);
      console.log(`[SKILLBRIDGE DB] Applied migration ${migration.name}.`);
    }
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  migrateDatabase().catch((error) => {
    console.error('[SKILLBRIDGE DB] Migration failed:', error instanceof Error ? error.message : 'UnknownError');
    process.exitCode = 1;
  });
}