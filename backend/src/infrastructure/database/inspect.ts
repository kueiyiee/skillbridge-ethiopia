import 'dotenv/config';
import { type RowDataPacket } from 'mysql2/promise';
import { createMysqlPool } from './connection';

interface TableInfo extends RowDataPacket {
  tableName: string;
  engine: string | null;
  tableCollation: string | null;
}

async function inspectDatabase(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required to inspect MySQL.');

  const configuredDatabase = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\/+/, ''));
  console.log(`Configured database: ${configuredDatabase}`);
  const pool = createMysqlPool(databaseUrl);
  try {
    const [[server]] = await pool.query<RowDataPacket[]>(
      'SELECT DATABASE() AS databaseName, VERSION() AS serverVersion'
    );
    const [tables] = await pool.query<TableInfo[]>(
      `SELECT TABLE_NAME AS tableName, ENGINE AS engine, TABLE_COLLATION AS tableCollation
       FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'
       ORDER BY TABLE_NAME`
    );

    console.log(`Database: ${server.databaseName}`);
    console.log(`Server: ${server.serverVersion}`);
    console.log(`Tables: ${tables.length}`);

    const metadataTables = new Set(['skillbridge_migrations', '_prisma_migrations']);
    let applicationRows = 0;
    for (const table of tables) {
      const safeName = table.tableName.replaceAll('`', '``');
      const [[count]] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS rowCount FROM \`${safeName}\``);
      const rowCount = Number(count.rowCount);
      if (!metadataTables.has(table.tableName)) applicationRows += rowCount;
      const tableType = metadataTables.has(table.tableName) ? 'migration metadata' : 'application data';
      console.log(`${table.tableName}: ${rowCount} rows; ${table.engine ?? 'unknown engine'}; ${table.tableCollation ?? 'no collation'}; ${tableType}`);
    }

    console.log(`Application rows: ${applicationRows}`);
    console.log(`Data state: ${applicationRows === 0 ? 'empty' : 'contains data; preserve before cleanup or export'}`);
    console.log(`Schema state: ${tables.some((table) => table.tableName === 'skillbridge_migrations') ? 'migration ledger present' : 'baseline not applied'}`);
  } finally {
    await pool.end();
  }
}

inspectDatabase().catch((error) => {
  const databaseError = error as { code?: string };
  console.error(`Database inspection failed (${databaseError.code ?? 'UNKNOWN'}).`);
  process.exitCode = 1;
});