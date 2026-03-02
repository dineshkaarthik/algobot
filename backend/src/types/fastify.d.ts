import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type Redis from 'ioredis';
import type * as schema from '../models/schema.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: NodePgDatabase<typeof schema>;
    redis: Redis;
  }

  interface FastifyRequest {
    userId: string;
    tenantId: string;
    userRole: string;
    deviceId?: string;
  }
}
