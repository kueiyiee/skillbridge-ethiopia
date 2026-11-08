import { getDatabaseHealth, getMigrationLedgerStatus, listSkills, probeDatabaseConnection } from './system.repository';
import { getAIProviderStatus, verifyAIProviderAccess } from '../ai-nexus/ai-provider.service';

export function resolveSystemStatus(
  health: { connected: boolean; tableCounts: Record<string, number> },
  migrations: { status: string },
  aiProviders: { providers: Record<string, { configured: boolean; availability: string }> },
): 'operational' | 'degraded' {
  const allTablesAvailable = Object.values(health.tableCounts).every((count) => count >= 0);
  const configuredProviders = Object.values(aiProviders.providers).filter((provider) => provider.configured);
  const providersHealthy = configuredProviders.every((provider) => provider.availability === 'available');
  return health.connected && allTablesAvailable && migrations.status === 'up-to-date' && providersHealthy ? 'operational' : 'degraded';
}

export async function isDatabaseReady(): Promise<boolean> {
  try {
    await probeDatabaseConnection();
    return true;
  } catch {
    return false;
  }
}

export async function getSystemStatus() {
  await verifyAIProviderAccess();
  const [health, migrations] = await Promise.all([getDatabaseHealth(), getMigrationLedgerStatus()]);
  const aiProviders = getAIProviderStatus();
  const gemini = aiProviders.providers.gemini;
  return {
    status: resolveSystemStatus(health, migrations, aiProviders),
    database: {
      type: health.engine,
      version: health.version,
      orm: 'Drizzle',
      connected: health.connected,
      activeAdapter: 'Drizzle ORM / MySQL',
      message: `${health.engine} connection verified.`,
      tableCounts: health.tableCounts,
      migrations,
    },
    gemini,
    aiProviders,
    mlExtension: {
      model: 'SkillBridgeRanker',
      specVersion: '1.0.0',
      status: 'Optional and not connected to application routes; no action required.',
    },
    version: '1.0.0-final-year-edition',
    timestamp: new Date().toISOString(),
  };
}

export async function getSkillCatalog() {
  return listSkills();
}
