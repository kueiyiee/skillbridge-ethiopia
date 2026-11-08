# Database Operations

## Runtime

The application uses a Drizzle ORM adapter with the mysql2 driver at `backend/src/infrastructure/database/drizzle.ts` and MySQL 8.0.16 or later (MySQL 8.4 LTS recommended). It connects before Express listens, uses parameterized statements and transactions, and closes the connection pool during shutdown. `/api/health/ready` runs `SELECT 1`.

Set `DATABASE_URL` to a MySQL URL supplied by the host. Do not put real credentials in source control or chat; URL-encode reserved characters in the password. The application does not migrate, seed, or reset a database during startup.

## Schema and Migrations

`prisma/migrations/20261012000100_mysql_baseline/migration.sql` is the MySQL baseline. The migration runner records completed migrations in `skillbridge_migrations`; it recognizes a successful legacy Prisma baseline and refuses to apply the baseline to an untracked database that already contains application tables. `prisma/schema.prisma` is retained as a legacy reference and does not generate the runtime client. PostgreSQL schema and migration archives are excluded from the application source and must never be deployed to MySQL.

The MySQL baseline uses InnoDB-compatible types and `utf8mb4_unicode_ci`. That collation is case-insensitive, so unique email and skill-name comparisons are also case-insensitive. Review this behavior against production data before import. Long-form text and JSON-encoded snapshots use `TEXT`; ETB salary fields remain integers, matching existing validation and application behavior.

For local setup, set `DATABASE_URL`, then run `npm run db:create`, `npm run db:migrate`, and `npm run db:inspect`. Creation is idempotent and only creates the target if absent. Inspection is read-only. Never run the baseline against a populated, untracked database. The application does not migrate, seed, or reset a database during startup.

The admin-auth migration adds a nullable unique username to `users` and an `auth_token_revocations` table. It preserves existing rows and applies once through the migration ledger.

The admin-management migration adds nullable archive timestamps to users, employers, jobs, verification records, and applications. Run `npm run db:migrate` against the intended supported MySQL database before using the admin Data Management workspace; archived rows are hidden from normal workflows and can be restored by an administrator.

The email-verification-evidence migration adds nullable `users.emailVerifiedAt` and changes the default for future `users.emailVerified` values to false. It does not rewrite existing account flags or timestamps. The admin user directory reports `Action required` when a legacy flag conflicts with, or lacks, recognized verification evidence; administrators must review those records individually. Public registration still cannot grant the `ADMIN` role. Newly provisioned administrators begin inactive and unverified and must request and complete an OTP by email before signing in.

The application-messaging migration adds application-linked message records. The employer recruitment workflow migration (`20261025000200_employer_recruitment_workflow`) adds `SHORTLISTED` and `HIRED` application statuses, plus idempotency records and a message-batch reference for private bulk delivery. Apply it with `npm run db:migrate` to the intended supported MySQL database before deploying the updated employer workflow. Migrations are not applied automatically at startup; do not run them against an unknown or production database without an approved deployment and backup plan.

## Export

Create exports outside the application repository because database dumps can contain personal information. For MySQL, use `mysqldump --single-transaction --default-character-set=utf8mb4 -u <DATABASE_USER> -p skillbridge_db > skillbridge_db_export.sql`; enter the password at the prompt. Keep the dump in protected storage and verify it by importing into a separate disposable database before relying on it. The current local XAMPP server is MariaDB 10.4.32, below the project's supported MySQL 8.0.16+ target; use MySQL 8.4 for production and export verification.

## PostgreSQL Data Transfer Status

The prior PostgreSQL database has not been exported or migrated. Keep it backed up and unchanged. A production transfer still requires a consistent PostgreSQL backup, an explicit type/data transformation, import into a separate MySQL database, and verification of record counts, IDs, relationships, timestamps, unique constraints, and representative application workflows. No automatic transfer script is included or has been run.

The previous PostgreSQL endpoint on port `5432` was not reachable from the development machine. TCP on the same host's port `3306` is reachable, but MySQL authentication, database identity, schema, and privileges have not been verified. Do not claim the application is live on MySQL until a MySQL connection, migration deployment, and workflow tests succeed.

## Test Safety

`npm test` runs database-independent unit tests. `npm run test:integration` requires `TEST_DATABASE_URL`; it rejects non-MySQL URLs, non-local hosts, and database names without `test`, applies migrations to that target, and uses fixed test fixtures. Use only the disposable MySQL test service documented in [development setup](development-setup.md).

Never run destructive migration commands, `DROP`, or `TRUNCATE` against production. Keep the original PostgreSQL backup until the MySQL deployment and data reconciliation are formally accepted.

See [cPanel deployment](deployment-cpanel.md) for hosting setup.
