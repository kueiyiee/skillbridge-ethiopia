import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveSystemStatus } from './system.service';

test('system health is degraded when database tables or migrations are incomplete', () => {
  const noProviders = { providers: {} };
  assert.equal(resolveSystemStatus({ connected: true, tableCounts: { users: 1, jobs: 0 } }, { status: 'up-to-date' }, noProviders), 'operational');
  assert.equal(resolveSystemStatus({ connected: true, tableCounts: { users: 1, jobs: -1 } }, { status: 'up-to-date' }, noProviders), 'degraded');
  assert.equal(resolveSystemStatus({ connected: true, tableCounts: { users: 1 } }, { status: 'pending' }, noProviders), 'degraded');
  assert.equal(resolveSystemStatus({ connected: false, tableCounts: { users: 1 } }, { status: 'up-to-date' }, noProviders), 'degraded');
  assert.equal(resolveSystemStatus(
    { connected: true, tableCounts: { users: 1 } },
    { status: 'up-to-date' },
    { providers: { openai: { configured: true, availability: 'unavailable' } } },
  ), 'degraded');
});