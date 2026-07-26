import { getRedis } from '../../shared/redis/client.js';

export async function connectRedis() {
  try {
    const redis = getRedis();
    await redis.ping();
    console.log('Backend: Redis connected');
  } catch (err) {
    console.error('Backend: Redis connection error:', err);
    process.exit(1);
  }
}
