import { createPool } from 'mysql2/promise';

export function createMysqlPool(databaseUrl: string): ReturnType<typeof createPool> {
  const url = new URL(databaseUrl);
  if (url.protocol !== 'mysql:') throw new Error('DATABASE_URL must use the mysql:// protocol.');

  const legacyConnectionLimit = url.searchParams.get('connection_limit');
  if (legacyConnectionLimit && !url.searchParams.has('connectionLimit')) {
    url.searchParams.set('connectionLimit', legacyConnectionLimit);
  }
  url.searchParams.delete('connection_limit');

  return createPool(url.toString());
}