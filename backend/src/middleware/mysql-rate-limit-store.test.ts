import assert from 'node:assert/strict';
import test from 'node:test';
import type { Options } from 'express-rate-limit';
import { MysqlRateLimitStore } from './mysql-rate-limit-store';

type Counter = { hits: number; expiresAt: Date };

function createSharedQuery() {
  const counters = new Map<string, Counter>();
  const statements: string[] = [];

  const query = async <Row = unknown>(
    statement: string,
    params: unknown[] = [],
  ): Promise<{ rows: Row[]; rowCount: number }> => {
    statements.push(statement);
    const [keyHash, firstWindow, secondWindow] = params;

    if (statement.startsWith('INSERT INTO auth_login_rate_limits')) {
      const current = counters.get(String(keyHash));
      if (!current || current.expiresAt.getTime() <= Date.now()) {
        counters.set(String(keyHash), {
          hits: 1,
          expiresAt: new Date(Date.now() + Number(firstWindow) / 1000),
        });
      } else {
        current.hits += 1;
      }
      void secondWindow;
      return { rows: [], rowCount: 1 };
    }

    if (statement.startsWith('SELECT hits,')) {
      const row = counters.get(String(keyHash));
      return {
        rows: (row ? [{
          hits: row.hits,
          remainingMicros: Math.max(0, row.expiresAt.getTime() - Date.now()) * 1000,
        }] : []) as Row[],
        rowCount: row ? 1 : 0,
      };
    }

    if (statement.startsWith('UPDATE auth_login_rate_limits')) {
      const row = counters.get(String(keyHash));
      if (row) row.hits = Math.max(0, row.hits - 1);
      return { rows: [], rowCount: row ? 1 : 0 };
    }

    if (statement.startsWith('DELETE FROM auth_login_rate_limits WHERE keyHash')) {
      return { rows: [], rowCount: Number(counters.delete(String(keyHash))) };
    }

    if (statement.startsWith('DELETE FROM auth_login_rate_limits WHERE expiresAt')) {
      return { rows: [], rowCount: 0 };
    }

    throw new Error(`Unexpected rate-limit SQL: ${statement}`);
  };

  return { query, statements };
}

const options = { windowMs: 15 * 60 * 1000 } as Options;

test('shares failed-login counters between store instances', async () => {
  const shared = createSharedQuery();
  const firstWorker = new MysqlRateLimitStore(shared.query, 'test-secret');
  const secondWorker = new MysqlRateLimitStore(shared.query, 'test-secret');
  firstWorker.init(options);
  secondWorker.init(options);

  try {
    assert.equal((await firstWorker.increment('203.0.113.4')).totalHits, 1);
    assert.equal((await secondWorker.increment('203.0.113.4')).totalHits, 2);
  } finally {
    firstWorker.shutdown();
    secondWorker.shutdown();
  }
});

test('stores a keyed hash instead of the client IP', async () => {
  const shared = createSharedQuery();
  const store = new MysqlRateLimitStore(shared.query, 'test-secret');
  store.init(options);

  try {
    await store.increment('203.0.113.4');
    assert.deepEqual(
      shared.statements.filter((statement) => statement.includes('keyHash')),
      [
        'INSERT INTO auth_login_rate_limits (keyHash, hits, expiresAt)\n' +
          '       VALUES (?, 1, TIMESTAMPADD(MICROSECOND, ?, UTC_TIMESTAMP(3)))\n' +
          '       ON DUPLICATE KEY UPDATE\n' +
          '         hits = IF(expiresAt <= UTC_TIMESTAMP(3), 1, hits + 1),\n' +
          '         expiresAt = IF(expiresAt <= UTC_TIMESTAMP(3), TIMESTAMPADD(MICROSECOND, ?, UTC_TIMESTAMP(3)), expiresAt)',
          'SELECT hits,\n' +
            '              GREATEST(TIMESTAMPDIFF(MICROSECOND, UTC_TIMESTAMP(3), expiresAt), 0) AS remainingMicros\n' +
            '       FROM auth_login_rate_limits\n' +
            '       WHERE keyHash = ?',
      ],
    );
    assert.ok(!shared.statements.join(' ').includes('203.0.113.4'));
  } finally {
    store.shutdown();
  }
});

test('keeps counters isolated by policy namespace', async () => {
  const shared = createSharedQuery();
  const loginStore = new MysqlRateLimitStore(shared.query, 'test-secret');
  const registrationStore = new MysqlRateLimitStore(shared.query, 'test-secret');
  registrationStore.prefix = 'mysql-registration:';
  loginStore.init(options);
  registrationStore.init(options);

  try {
    assert.equal((await loginStore.increment('203.0.113.4')).totalHits, 1);
    assert.equal((await registrationStore.increment('203.0.113.4')).totalHits, 1);
    assert.equal((await loginStore.increment('203.0.113.4')).totalHits, 2);
    assert.equal((await registrationStore.increment('203.0.113.4')).totalHits, 2);
  } finally {
    loginStore.shutdown();
    registrationStore.shutdown();
  }
});
