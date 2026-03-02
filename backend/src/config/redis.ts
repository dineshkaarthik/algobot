import Redis from 'ioredis';
import { getEnv } from './env.js';
import { logger } from '../utils/logger.js';

let _redis: Redis;

export function initRedis(): Redis {
  const env = getEnv();
  _redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 200, 5000);
      return delay;
    },
    lazyConnect: true,
  });

  _redis.on('connect', () => logger.info('Redis connected'));
  _redis.on('error', (err) => logger.error({ err }, 'Redis error'));

  return _redis;
}

export function getRedis(): Redis {
  if (!_redis) throw new Error('Redis not initialized. Call initRedis() first.');
  return _redis;
}

export async function closeRedis() {
  if (_redis) await _redis.quit();
}
