import Redis from 'ioredis';
import { getEnv } from './env.js';
import { logger } from '../utils/logger.js';

let _redis: Redis;

export function initRedis(): Redis {
  const env = getEnv();

  // Log masked URL to help debug connection issues
  const maskedUrl = env.REDIS_URL.replace(/\/\/([^:]*):([^@]*)@/, '//***:***@');
  logger.info({ url: maskedUrl }, 'Initializing Redis connection');

  _redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 15) return null;
      const delay = Math.min(times * 500, 5000);
      return delay;
    },
    lazyConnect: true,
    connectTimeout: 15000,
    enableReadyCheck: true,
  });

  _redis.on('connect', () => logger.info('Redis connected'));
  _redis.on('ready', () => logger.info('Redis ready'));
  _redis.on('error', (err) => logger.error({ err: err.message }, 'Redis error'));

  return _redis;
}

export function getRedis(): Redis {
  if (!_redis) throw new Error('Redis not initialized. Call initRedis() first.');
  return _redis;
}

export async function closeRedis() {
  if (_redis) await _redis.quit();
}
