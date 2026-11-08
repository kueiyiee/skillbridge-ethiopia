import { createHmac } from 'node:crypto';
import type { ClientRateLimitInfo, Options, Store } from 'express-rate-limit';
import { db } from '../infrastructure/database/drizzle';

type RateLimitQuery = typeof db.query;

type RateLimitRow = {
  hits: number;
  remainingMicros: number | string;
};

export class MysqlRateLimitStore implements Store {
  localKeys = false;
  prefix = 'mysql-login:';

  private windowMs = 15 * 60 * 1000;
  private cleanupTimer: NodeJS.Timeout | undefined;

  constructor(
    private readonly query: RateLimitQuery,
    private readonly keySecret: string,
  ) {}

  init(options: Options): void {
    this.windowMs = options.windowMs;
    this.cleanupTimer = setInterval(() => {
      void this.query(
        'DELETE FROM auth_login_rate_limits WHERE expiresAt <= UTC_TIMESTAMP(3)',
      ).catch((error: unknown) => {
        console.error('[SKILLBRIDGE] Rate-limit cleanup failed:', error instanceof Error ? error.name : 'UnknownError');
      });
    }, this.windowMs);
    this.cleanupTimer.unref();
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const keyHash = this.hashKey(key);
    await this.query(
      `INSERT INTO auth_login_rate_limits (keyHash, hits, expiresAt)
       VALUES (?, 1, TIMESTAMPADD(MICROSECOND, ?, UTC_TIMESTAMP(3)))
       ON DUPLICATE KEY UPDATE
         hits = IF(expiresAt <= UTC_TIMESTAMP(3), 1, hits + 1),
         expiresAt = IF(expiresAt <= UTC_TIMESTAMP(3), TIMESTAMPADD(MICROSECOND, ?, UTC_TIMESTAMP(3)), expiresAt)`,
      [keyHash, this.windowMs * 1000, this.windowMs * 1000],
    );

    const result = await this.query<RateLimitRow>(
      `SELECT hits,
              GREATEST(TIMESTAMPDIFF(MICROSECOND, UTC_TIMESTAMP(3), expiresAt), 0) AS remainingMicros
       FROM auth_login_rate_limits
       WHERE keyHash = ?`,
      [keyHash],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Login rate-limit counter was not available after increment.');

    return {
      totalHits: Number(row.hits),
      resetTime: new Date(Date.now() + Number(row.remainingMicros) / 1000),
    };
  }

  async decrement(key: string): Promise<void> {
    await this.query(
      'UPDATE auth_login_rate_limits SET hits = GREATEST(hits - 1, 0) WHERE keyHash = ?',
      [this.hashKey(key)],
    );
  }

  async resetKey(key: string): Promise<void> {
    await this.query('DELETE FROM auth_login_rate_limits WHERE keyHash = ?', [this.hashKey(key)]);
  }

  shutdown(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  private hashKey(key: string): string {
    return createHmac('sha256', this.keySecret).update(key).digest('hex');
  }
}
