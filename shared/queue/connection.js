// ---------------------------------------------------------------------------
// Shared BullMQ connection config
// ---------------------------------------------------------------------------

/**
 * Parse REDIS_URL into the connection object BullMQ expects.
 * BullMQ uses its own ioredis connections internally, so we pass config, not the client.
 */
export function getBullMQConnection() {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  const parsed = new URL(url);
  return {
    host: parsed.hostname || '127.0.0.1',
    port: parseInt(parsed.port, 10) || 6379,
    password: parsed.password || undefined,
    db: parsed.pathname ? parseInt(parsed.pathname.slice(1), 10) || 0 : 0,
    maxRetriesPerRequest: null,
  };
}
