import express, { Request, Response } from 'express';
import path from 'path';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { apiModules } from './modules';
import { databaseReadinessController } from './modules/system/system.controller';
import { appCors } from './config/cors';
import { securityHeaders } from './config/security';
import { requestIdMiddleware } from './middleware/request-id';
import { requestLogger } from './middleware/request-logger';
import { errorHandler } from './middleware/error-handler';
import { MysqlRateLimitStore } from './middleware/mysql-rate-limit-store';
import { db } from './infrastructure/database/drizzle';

export async function createApp() {
  const app = express();
  if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  app.use(cors(appCors));
  app.use(securityHeaders);
  app.use(requestIdMiddleware);
  app.use(requestLogger);
  app.use(express.json({ limit: '8mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  const rateLimitSecret = process.env.JWT_SECRET ?? '';
  const loginRateLimitStore = new MysqlRateLimitStore(db.query.bind(db), rateLimitSecret);
  const passwordRecoveryRateLimitStore = new MysqlRateLimitStore(db.query.bind(db), rateLimitSecret);
  passwordRecoveryRateLimitStore.prefix = 'mysql-password-recovery:';
  const registrationRateLimitStore = new MysqlRateLimitStore(db.query.bind(db), rateLimitSecret);
  registrationRateLimitStore.prefix = 'mysql-registration:';
  const aiRateLimitStore = new MysqlRateLimitStore(db.query.bind(db), rateLimitSecret);
  aiRateLimitStore.prefix = 'mysql-ai:';

  const passwordRecoveryIpLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    store: passwordRecoveryRateLimitStore,
    message: { success: false, error: 'Password recovery is temporarily rate limited. Please try again later.' }
  });
  app.use('/api/auth/forgot-password', passwordRecoveryIpLimit);
  app.use('/api/auth/resend-reset-otp', passwordRecoveryIpLimit);
  app.use('/api/auth/reset-password', passwordRecoveryIpLimit);
  app.use('/api/auth/login', rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    skip: () => !isProduction,
    store: loginRateLimitStore,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { success: false, error: 'Too many sign-in attempts. Please try again later.' }
  }));
  app.use('/api/auth/register', rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 8,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    store: registrationRateLimitStore,
    message: { success: false, error: 'Too many registration attempts. Please try again later.' }
  }));
  app.use('/api/ai', rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    store: aiRateLimitStore,
    message: { success: false, error: 'AI request limit reached. Please try again later.' }
  }));

  for (const apiModule of apiModules) {
    app.use(apiModule.path, apiModule.router);
  }

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'SKILLBRIDGE Ethiopia API', timestamp: new Date().toISOString() });
  });

  app.get('/api/health/ready', databaseReadinessController);

  app.all('/api/*', (req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: `API endpoint ${req.method} ${req.originalUrl} not found`,
      timestamp: new Date().toISOString()
    });
  });

  // cPanel/Passenger can continue serving the bundled SPA. Render runs this
  // same API process separately and disables static hosting with SERVE_FRONTEND=false.
  if (isProduction && process.env.SERVE_FRONTEND !== 'false') {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else if (!isProduction) {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }

  app.use(errorHandler);

  console.log(`[SKILLBRIDGE] ${isProduction ? 'Production' : 'Development'} app configured for port ${port}.`);
  return app;
}
