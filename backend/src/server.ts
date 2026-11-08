import dotenv from 'dotenv';
import { getAIProviderStatus, validateAIProviderConfiguration, verifyAIProviderAccess } from './modules/ai-nexus/ai-provider.service';
import { startEmailVerificationCleanup } from './modules/auth/email-verification-cleanup';

dotenv.config();

const [databaseModule, appModule] = await Promise.all([
  import('./infrastructure/database/drizzle'),
  import('./app')
]);

const { db } = databaseModule;
const { createApp } = appModule;

function validateEnvironment(isProduction: boolean): void {
  const required = isProduction ? ['DATABASE_URL', 'JWT_SECRET', 'PORT'] : ['DATABASE_URL', 'JWT_SECRET'];
  const missing = required.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing required environment variable${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}.`);
  }

  if (isProduction && (process.env.JWT_SECRET?.length ?? 0) < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters in production.');
  }
}

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  validateEnvironment(isProduction);
  validateAIProviderConfiguration();
  await verifyAIProviderAccess();
  const aiProviders = getAIProviderStatus();
  console.log(`[SKILLBRIDGE] AI providers configured: ${aiProviders.configured ? 'yes' : 'no'}; primary=${aiProviders.primaryProvider}; fallback=${aiProviders.fallbackProvider}.`);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid TCP port.');
  }

  await db.init();
  console.log('[SKILLBRIDGE] Connected to the configured MySQL database via Drizzle.');
  const stopEmailVerificationCleanup = startEmailVerificationCleanup();
  const app = await createApp();

  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`[SKILLBRIDGE] Server active at http://0.0.0.0:${port}`);
  });

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[SKILLBRIDGE] Received ${signal}; shutting down.`);
    stopEmailVerificationCleanup();
    server.close(() => {
      void db.close().finally(() => process.exit(0));
    });
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

startServer().catch((err) => {
  console.error('[SKILLBRIDGE] Fatal startup error:', err instanceof Error ? err.message : 'Unknown startup error');
  process.exit(1);
});
