import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getRedis } from '../config/redis.js';
import { getPool } from '../config/database.js';

export async function healthRoutes(app: FastifyInstance) {
  /**
   * GET /health — Basic health check
   */
  app.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    const checks: Record<string, string> = { server: 'ok' };

    try {
      const pool = getPool();
      await pool.query('SELECT 1');
      checks.database = 'ok';
    } catch {
      checks.database = 'error';
    }

    try {
      const redis = getRedis();
      await redis.ping();
      checks.redis = 'ok';
    } catch {
      checks.redis = 'error';
    }

    const allHealthy = Object.values(checks).every((v) => v === 'ok');

    return reply.status(allHealthy ? 200 : 503).send({
      status: allHealthy ? 'healthy' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
    });
  });
}
