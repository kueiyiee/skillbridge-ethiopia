# Database Resources

The runtime uses Drizzle ORM with MySQL. The active MySQL baseline SQL and migration runner are retained at `../prisma/migrations/` and `../backend/src/infrastructure/database/migrate.ts`; `../prisma/schema.prisma` is a legacy reference and is not used to generate code. PostgreSQL schema and migration archives are not included in this application source; keep database backups separate from the application repository.

For MySQL setup, migration safety, and the still-pending PostgreSQL data transfer, see [database operations](../docs/database.md) and [cPanel deployment](../docs/deployment-cpanel.md).