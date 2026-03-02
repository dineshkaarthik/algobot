import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyJwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import multipart from '@fastify/multipart';

import { loadEnv } from './config/env.js';
import { initDatabase, closeDatabase } from './config/database.js';
import { initRedis, closeRedis, getRedis } from './config/redis.js';
import { logger } from './utils/logger.js';

// Routes
import { authRoutes } from './routes/auth.routes.js';
import { chatRoutes } from './routes/chat.routes.js';
import { dashboardRoutes } from './routes/dashboard.routes.js';
import { healthRoutes } from './routes/health.routes.js';
import { devicesRoutes } from './routes/devices.routes.js';
import { audioRoutes } from './routes/audio.routes.js';
import { notificationsRoutes } from './routes/notifications.routes.js';
import { webhookRoutes } from './routes/webhooks.routes.js';
import { algonitRoutes } from './routes/algonit.routes.js';
import { recommendationsRoutes } from './routes/recommendations.routes.js';

// Middleware
import { authMiddleware } from './middleware/auth.middleware.js';
import { tenantMiddleware } from './middleware/tenant.middleware.js';
import { auditMiddleware } from './middleware/audit.middleware.js';
import { rbac } from './middleware/rbac.middleware.js';

// Monitoring
import { metricsRoute, metrics, MetricNames } from './services/monitoring/metrics.js';

// LLM Router (circuit breaker + fallback)
import { LLMRouter } from './services/llm/llm.router.js';

// WebSocket
import { registerWebSocket } from './services/websocket/ws.server.js';

// Background workers
import { startAlertWorker } from './workers/alert.worker.js';
import { startCleanupWorker } from './workers/cleanup.worker.js';
import { startInsightsWorker } from './workers/insights.worker.js';
import { startKpiWorker, KpiWorker } from './workers/kpi.worker.js';

async function bootstrap() {
  const env = loadEnv();

  const app = Fastify({
    logger: false,
    trustProxy: true,
  });

  // ─── Plugins ───────────────────────────────────────────
  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await app.register(helmet);

  await app.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: '1 minute',
    redis: initRedis(),
  });

  await app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: env.JWT_EXPIRES_IN },
  });

  await app.register(websocket);

  await app.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  });

  // ─── Infrastructure ────────────────────────────────────
  const db = initDatabase();
  const redis = getRedis();

  // Retry Redis connection (Railway internal DNS may take a moment)
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await redis.connect();
      break;
    } catch (err) {
      logger.warn({ attempt, err: err instanceof Error ? err.message : err }, 'Redis connect attempt failed');
      if (attempt === 5) throw new Error('Could not connect to Redis after 5 attempts');
      await new Promise((r) => setTimeout(r, attempt * 2000));
      try { redis.disconnect(false); } catch { /* ignore */ }
    }
  }

  app.decorate('db', db as any);
  app.decorate('redis', redis as any);

  // ─── Global hooks ──────────────────────────────────────
  app.addHook('onRequest', auditMiddleware);

  // Track HTTP request metrics
  app.addHook('onResponse', (request, reply, done) => {
    metrics.increment(MetricNames.HTTP_REQUESTS_TOTAL, {
      method: request.method,
      route: request.routeOptions?.url || request.url,
      status: String(reply.statusCode),
    });
    if (reply.statusCode >= 400) {
      metrics.increment(MetricNames.HTTP_ERRORS_TOTAL, {
        status: String(reply.statusCode),
      });
    }
    done();
  });

  // ─── WebSocket (real-time streaming + alerts) ──────────
  await registerWebSocket(app);

  // ─── Public routes ─────────────────────────────────────
  await app.register(healthRoutes, { prefix: '/api/v1' });
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(webhookRoutes, { prefix: '/api/v1/webhooks' });
  await app.register(metricsRoute); // Prometheus scrape endpoint

  // ─── Protected routes ──────────────────────────────────
  await app.register(async function protectedRoutes(instance) {
    instance.addHook('onRequest', authMiddleware);
    instance.addHook('onRequest', tenantMiddleware);

    // Core chat (agentic AI) — all authenticated users
    await instance.register(chatRoutes, { prefix: '/api/v1/chat' });

    // Dashboard — viewers and above
    await instance.register(async (scope) => {
      scope.addHook('onRequest', rbac('viewer'));
      await scope.register(dashboardRoutes, { prefix: '/api/v1/dashboard' });
    });

    // Voice / Audio — members and above
    await instance.register(async (scope) => {
      scope.addHook('onRequest', rbac('member'));
      await scope.register(audioRoutes, { prefix: '/api/v1/audio' });
    });

    // Push notification device management — all authenticated users
    await instance.register(devicesRoutes, { prefix: '/api/v1/devices' });

    // Notifications — all authenticated users
    await instance.register(notificationsRoutes, { prefix: '/api/v1/notifications' });

    // Algonit integration management (OAuth connect/disconnect/status)
    await instance.register(algonitRoutes, { prefix: '/api/v1/integrations/algonit' });

    // Growth Copilot recommendations — members and above
    await instance.register(async (scope) => {
      scope.addHook('onRequest', rbac('member'));
      await scope.register(recommendationsRoutes, { prefix: '/api/v1/recommendations' });
    });

    // LLM provider health status — admin only
    instance.get('/api/v1/admin/llm-health', { preHandler: rbac('admin') }, async (_req, reply) => {
      const router = new LLMRouter();
      return reply.send({ providers: router.getHealth() });
    });
  });

  // ─── Static files (dev only — audio uploads) ──────────
  if (env.NODE_ENV === 'development') {
    const path = await import('path');
    const fastifyStatic = await import('@fastify/static');
    await app.register(fastifyStatic.default, {
      root: path.join(process.cwd(), 'uploads'),
      prefix: '/uploads/',
      decorateReply: false,
    });
  }

  // ─── Global error handler ─────────────────────────────
  app.setErrorHandler<Error & { statusCode?: number; code?: string; issues?: unknown[] }>((error, request, reply) => {
    logger.error({ err: error, requestId: request.id }, 'Unhandled error');

    // Handle Zod validation errors
    if (error.name === 'ZodError') {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: error.issues,
        },
        request_id: request.id,
        timestamp: new Date().toISOString(),
      });
    }

    const statusCode = error.statusCode || 500;
    reply.status(statusCode).send({
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message:
          env.NODE_ENV === 'production' && statusCode === 500
            ? 'An internal error occurred'
            : error.message,
      },
      request_id: request.id,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── Background workers ────────────────────────────────
  let alertEngine: ReturnType<typeof startAlertWorker> | null = null;
  let insightsWorker: ReturnType<typeof startInsightsWorker> | null = null;
  let kpiWorker: KpiWorker | null = null;
  let cleanupInterval: ReturnType<typeof setInterval> | null = null;

  // ─── Graceful shutdown ─────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down gracefully...');

    // Stop background workers
    if (alertEngine) alertEngine.stop();
    if (insightsWorker) insightsWorker.stop();
    if (kpiWorker) kpiWorker.stop();
    if (cleanupInterval) clearInterval(cleanupInterval);

    await app.close();
    await closeRedis();
    await closeDatabase();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // ─── Start server ──────────────────────────────────────
  await app.listen({ port: env.PORT, host: env.HOST });
  logger.info(`Algo server running on http://${env.HOST}:${env.PORT}`);

  // Start background workers after server is ready
  alertEngine = startAlertWorker();
  insightsWorker = startInsightsWorker();
  kpiWorker = startKpiWorker();
  cleanupInterval = startCleanupWorker();

  logger.info('All systems operational — Algo is ready');
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
