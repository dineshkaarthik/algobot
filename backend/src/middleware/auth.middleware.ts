import type { FastifyRequest, FastifyReply } from 'fastify';
import { getRedis } from '../config/redis.js';

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  try {
    const decoded = await request.jwtVerify<{
      sub: string;
      tid: string;
      role: string;
      did?: string;
    }>();

    // Check if token is blacklisted (post-logout)
    const redis = getRedis();
    const revoked = await redis.get(`revoked:${decoded.sub}:${decoded.did || 'unknown'}`);
    if (revoked) {
      return reply.status(401).send({
        error: { code: 'TOKEN_REVOKED', message: 'Token has been revoked' },
      });
    }

    request.userId = decoded.sub;
    request.tenantId = decoded.tid;
    request.userRole = decoded.role;
    request.deviceId = decoded.did;
  } catch {
    return reply.status(401).send({
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
    });
  }
}
