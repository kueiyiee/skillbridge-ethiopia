import { sql, type SQL } from 'drizzle-orm';
import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2';
import { type ResultSetHeader } from 'mysql2/promise';
import { createMysqlPool } from './connection';

export interface DatabaseHealthInfo {
  engine: string;
  version: string;
  connected: boolean;
  tableCounts: Record<string, number>;
}

export function identifyDatabaseEngine(version: string): string {
  return /mariadb/i.test(version) ? 'MariaDB' : 'MySQL';
}

const applicationTables = [
  'users',
  'email_verification_challenges',
  'user_mfa_factors',
  'user_mfa_recovery_codes',
  'auth_mfa_challenges',
  'issued_reports',
  'password_reset_challenges',
  'job_seeker_profiles',
  'employer_profiles',
  'employer_verification_records',
  'employer_verification_documents',
  'skills',
  'job_seeker_skills',
  'jobs',
  'job_skill_requirements',
  'job_applications',
  'application_messages',
  'employer_message_batches',
  'saved_jobs',
  'skill_assessments',
  'skill_assessment_questions',
  'skill_assessment_responses',
  'skill_gap_results',
  'recommendations',
  'employer_feedbacks',
  'platform_audit_logs',
  'ai_nexus_conversations',
  'ai_nexus_messages'
] as const;

type QueryExecutor = <T = any>(sql: string, params?: unknown[]) => Promise<{ rows: T[]; rowCount: number }>;
type DrizzleExecutor = Pick<MySql2Database, 'execute'>;

function getSafeDatabaseErrorMetadata(error: unknown): Record<string, string | number> {
  if (!(error instanceof Error)) return { name: 'UnknownError' };

  const databaseError = error as Error & { code?: unknown; errno?: unknown; sqlState?: unknown };
  return {
    name: error.name,
    ...(typeof databaseError.code === 'string' ? { code: databaseError.code } : {}),
    ...(typeof databaseError.errno === 'number' ? { errno: databaseError.errno } : {}),
    ...(typeof databaseError.sqlState === 'string' ? { sqlState: databaseError.sqlState } : {}),
  };
}

export function prepareMysqlQuery(sql: string, params: unknown[]): { sql: string; params: unknown[] } {
  const mysqlParams: unknown[] = [];
  const mysqlSql = sql
    .replace(/"([A-Za-z_][A-Za-z0-9_]*)"/g, '`$1`')
    .replace(/\$(\d+)/g, (_placeholder, index: string) => {
      const parameterIndex = Number(index) - 1;
      if (parameterIndex < 0 || parameterIndex >= params.length) {
        throw new Error(`SQL query references missing parameter $${index}.`);
      }
      mysqlParams.push(params[parameterIndex]);
      return '?';
    });

  return { sql: mysqlSql, params: mysqlParams };
}

function toDrizzleQuery(statement: string, params: unknown[]): SQL {
  const fragments = statement.split('?');
  if (fragments.length !== params.length + 1) {
    throw new Error('SQL query parameter count does not match its placeholders.');
  }

  const query = sql.empty();
  fragments.forEach((fragment, index) => {
    query.append(sql.raw(fragment));
    if (index < params.length) query.append(sql`${params[index]}`);
  });
  return query;
}

async function runQuery<T = any>(client: DrizzleExecutor, statement: string, params: unknown[] = []): Promise<{ rows: T[]; rowCount: number }> {
  const prepared = prepareMysqlQuery(statement, params);
  const [result] = await client.execute(toDrizzleQuery(prepared.sql, prepared.params));
  if (/^\s*(SELECT|WITH|SHOW|VALUES)\b/i.test(prepared.sql)) {
    const rows = result as unknown as T[];
    return { rows, rowCount: rows.length };
  }

  return { rows: [], rowCount: (result as ResultSetHeader).affectedRows };
}

class SkillBridgeDatabase {
  private client: MySql2Database | null = null;
  private pool: ReturnType<typeof createMysqlPool> | null = null;
  private initPromise: Promise<void> | null = null;

  public async init(): Promise<void> {
    if (this.client) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.connect();
    try {
      await this.initPromise;
    } catch (error) {
      this.initPromise = null;
      throw error;
    }
  }

  private async connect(): Promise<void> {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required to connect to MySQL.');
    }

    const pool = createMysqlPool(databaseUrl);
    try {
      const client = drizzle(pool);
      await client.execute(sql`SELECT 1`);
      this.pool = pool;
      this.client = client;
    } catch {
      await pool.end().catch(() => undefined);
      throw new Error('Unable to connect to the configured MySQL database. Check the host, database user, password, and network access.');
    }
  }

  public async query<T = any>(statement: string, params: unknown[] = []): Promise<{ rows: T[]; rowCount: number }> {
    await this.init();
    try {
      return await runQuery<T>(this.client!, statement, params);
    } catch (error) {
      console.error('[SKILLBRIDGE DB] Query failed.', getSafeDatabaseErrorMetadata(error));
      throw new Error('Database operation failed.');
    }
  }

  public async transaction<T>(callback: (tx: { query: QueryExecutor }) => Promise<T>): Promise<T> {
    await this.init();
    let callbackError: unknown;

    try {
      return await this.client!.transaction(async (transaction) => {
        try {
          return await callback({
            query: async <Row = any>(statement: string, params: unknown[] = []) => {
              try {
                return await runQuery<Row>(transaction, statement, params);
              } catch (error) {
                console.error('[SKILLBRIDGE DB] Transaction query failed.', getSafeDatabaseErrorMetadata(error));
                throw new Error('Database operation failed.');
              }
            }
          });
        } catch (error) {
          callbackError = error;
          throw error;
        }
      });
    } catch (error) {
      console.error('[SKILLBRIDGE DB] Transaction failed.', getSafeDatabaseErrorMetadata(error));
      if (error === callbackError) throw error;
      throw new Error('Database transaction failed.');
    }
  }

  public async close(): Promise<void> {
    if (!this.pool) return;
    const pool = this.pool;
    this.client = null;
    this.pool = null;
    this.initPromise = null;
    await pool.end();
  }

  public async getHealth(): Promise<DatabaseHealthInfo> {
    await this.init();
    const versionResult = await runQuery<{ version: string }>(this.client!, 'SELECT VERSION() AS version');
    const tableCounts: Record<string, number> = {};

    for (const table of applicationTables) {
      try {
        const result = await runQuery<{ count: bigint | number }>(this.client!, `SELECT count(*) AS count FROM \`${table}\``);
        tableCounts[table] = Number(result.rows[0]?.count ?? 0);
      } catch (error) {
        const databaseError = error as { code?: string; errno?: number };
        if (databaseError.code === 'ER_NO_SUCH_TABLE' || databaseError.errno === 1146) {
          tableCounts[table] = -1;
          continue;
        }
        throw error;
      }
    }

    return {
      engine: identifyDatabaseEngine(versionResult.rows[0]?.version ?? ''),
      version: versionResult.rows[0]?.version ?? 'MySQL version unavailable',
      connected: true,
      tableCounts
    };
  }
}

export const db = new SkillBridgeDatabase();