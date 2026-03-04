import crypto from 'node:crypto';
import { getRedis } from '../../config/redis.js';
import { logger } from '../../utils/logger.js';

const CACHE_PREFIX = 'algonit:cache:';

// TTL per endpoint category (seconds) — aligned to /api/algo/* routes
const CACHE_TTLS: Record<string, number> = {
  '/me': 600,                           // 10 min (profile rarely changes)
  '/credits': 300,                       // 5 min
  '/posts': 300,                         // 5 min
  '/campaigns': 300,                     // 5 min
  '/email-campaigns': 600,              // 10 min
  '/market-radar/summary': 600,         // 10 min
  '/summary': 120,                       // 2 min (dashboard snapshot)
  '/hot-leads': 120,                     // 2 min (leads change often)
  '/buying-intent': 300,                 // 5 min
  '/follow-ups': 120,                    // 2 min
  '/deals': 300,                         // 5 min
  '/engagement': 300,                    // 5 min
  '/leads': 120,                         // 2 min
  '/insights': 1800,                     // 30 min (slow-moving analytical data)
  '/metrics': 300,                       // 5 min (daily snapshots)
  '/metrics/growth': 600,               // 10 min (pre-computed growth)
};

// Campaign performance uses dynamic paths: /campaigns/:id/performance
// Matched via startsWith in getCacheTtl()
const DYNAMIC_TTLS: Array<{ prefix: string; ttl: number }> = [
  { prefix: '/campaigns/', ttl: 300 },  // /campaigns/:id/performance → 5 min
];

// Endpoints that should NEVER be cached (trigger live side effects)
const NO_CACHE_ENDPOINTS = new Set(['/social/sync']);

// Map of endpoints to cache keys they should invalidate after a successful call
const INVALIDATION_MAP: Record<string, string[]> = {
  'PATCH:/campaigns/': ['/campaigns', '/summary'],  // pause/resume invalidates campaign lists + summary
  'GET:/social/sync': ['/engagement', '/metrics', '/metrics/growth', '/summary'],  // sync refreshes all social data
};

function getCacheTtl(endpoint: string): number | null {
  // Never cache certain endpoints
  if (NO_CACHE_ENDPOINTS.has(endpoint)) return null;

  // Exact match first
  if (CACHE_TTLS[endpoint] !== undefined) return CACHE_TTLS[endpoint];

  // Dynamic path match (e.g. /campaigns/abc/performance)
  for (const { prefix, ttl } of DYNAMIC_TTLS) {
    if (endpoint.startsWith(prefix)) return ttl;
  }

  return null;
}

export class AlgonitCache {
  async get<T>(tenantId: string, endpoint: string, params: Record<string, unknown>): Promise<T | null> {
    const ttl = getCacheTtl(endpoint);
    if (ttl === null) return null;

    const key = this.buildKey(tenantId, endpoint, params);
    const redis = getRedis();

    try {
      const cached = await redis.get(key);
      if (cached) {
        logger.debug({ tenantId, endpoint }, 'Algonit cache hit');
        return JSON.parse(cached) as T;
      }
    } catch (err) {
      logger.warn({ err, key }, 'Algonit cache read error');
    }

    return null;
  }

  async set(tenantId: string, endpoint: string, params: Record<string, unknown>, data: unknown): Promise<void> {
    const ttl = getCacheTtl(endpoint);
    if (ttl === null) return;

    const key = this.buildKey(tenantId, endpoint, params);
    const redis = getRedis();

    try {
      await redis.setex(key, ttl, JSON.stringify(data));
    } catch (err) {
      logger.warn({ err, key }, 'Algonit cache write error');
    }
  }

  async invalidate(tenantId: string, method: string, endpoint: string): Promise<void> {
    const redis = getRedis();

    for (const [pattern, targets] of Object.entries(INVALIDATION_MAP)) {
      const [m, path] = pattern.split(':');
      if (m === method && endpoint.startsWith(path)) {
        for (const target of targets) {
          const scanPattern = `${CACHE_PREFIX}${tenantId}:${target}:*`;
          try {
            let cursor = '0';
            do {
              const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', scanPattern, 'COUNT', 100);
              cursor = nextCursor;
              if (keys.length > 0) {
                await redis.del(...keys);
                logger.debug({ tenantId, pattern: scanPattern, count: keys.length }, 'Algonit cache invalidated');
              }
            } while (cursor !== '0');
          } catch (err) {
            logger.warn({ err, scanPattern }, 'Algonit cache invalidation error');
          }
        }
        break;
      }
    }
  }

  async clearTenant(tenantId: string): Promise<void> {
    const redis = getRedis();
    const pattern = `${CACHE_PREFIX}${tenantId}:*`;

    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } while (cursor !== '0');
    } catch (err) {
      logger.warn({ err, tenantId }, 'Algonit tenant cache clear error');
    }
  }

  private buildKey(tenantId: string, endpoint: string, params: Record<string, unknown>): string {
    const sortedParams = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('&');

    const hash = crypto.createHash('md5').update(sortedParams).digest('hex').substring(0, 8);
    return `${CACHE_PREFIX}${tenantId}:${endpoint}:${hash}`;
  }
}
