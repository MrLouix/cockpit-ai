import Redis from 'ioredis';

let redis = null;

/**
 * Returns the singleton ioredis client, creating it on first call.
 * Accepts an optional Redis instance (useful for testing with ioredis-mock).
 */
export function getRedis(instance) {
  if (instance) {
    redis = instance;
    return redis;
  }
  if (!redis) {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    redis = new Redis(url, { maxRetriesPerRequest: null });
  }
  return redis;
}

/**
 * Gracefully close the Redis connection.
 */
export async function closeRedis() {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

/**
 * Reset the singleton (for tests).
 */
export function resetRedis() {
  redis = null;
}
