import type { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../utils/logger.js';

export async function auditMiddleware(request: FastifyRequest, _reply: FastifyReply) {
  const startTime = Date.now();

  // Log every request
  request.log = logger.child({
    requestId: request.id,
    method: request.method,
    url: request.url,
    ip: request.ip,
    userId: (request as any).userId,
    tenantId: (request as any).tenantId,
  });

  // Track response time
  request.log.info('Incoming request');

  // Add response hook for timing
  request.raw.on('close', () => {
    const duration = Date.now() - startTime;
    request.log.info({ duration_ms: duration }, 'Request completed');
  });
}
