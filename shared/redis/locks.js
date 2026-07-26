import { getRedis } from './client.js';
import { KEYS } from './keys.js';

// ---------------------------------------------------------------------------
// Session lock — Redis SET NX PX + Lua scripts for conditional renew/release
// ---------------------------------------------------------------------------

const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

const RENEW_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("pexpire", KEYS[1], ARGV[2])
else
  return 0
end
`;

/**
 * Try to acquire a session lock. Returns true if acquired.
 */
export async function acquireSessionLock(sessionId, token, ttlMs) {
  const redis = getRedis();
  const result = await redis.set(KEYS.sessionLock(sessionId), token, 'PX', ttlMs, 'NX');
  return result === 'OK';
}

/**
 * Renew the lock TTL if we still hold it. Returns 1 if renewed, 0 otherwise.
 */
export async function renewSessionLock(sessionId, token, ttlMs) {
  const redis = getRedis();
  return redis.eval(RENEW_SCRIPT, 1, KEYS.sessionLock(sessionId), token, ttlMs);
}

/**
 * Release the lock only if we still hold it. Returns 1 if released, 0 otherwise.
 */
export async function releaseSessionLock(sessionId, token) {
  const redis = getRedis();
  return redis.eval(RELEASE_SCRIPT, 1, KEYS.sessionLock(sessionId), token);
}

/**
 * High-level helper: acquire lock, run fn with periodic heartbeat, release.
 * @param {string} sessionId
 * @param {function} fn - async function to run while holding the lock
 * @param {object} opts - { ttlMs, renewMs }
 * @returns {*} result of fn
 * @throws if the lock cannot be acquired (caller should handle retry/delay)
 */
export async function withSessionLock(sessionId, fn, opts = {}) {
  const ttlMs = opts.ttlMs || parseInt(process.env.SESSION_LOCK_TTL_MS, 10) || 30000;
  const renewMs = opts.renewMs || parseInt(process.env.SESSION_LOCK_RENEW_MS, 10) || 10000;
  const token = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const acquired = await acquireSessionLock(sessionId, token, ttlMs);
  if (!acquired) {
    const err = new Error('Session lock not acquired');
    err.code = 'LOCK_NOT_ACQUIRED';
    throw err;
  }

  const heartbeat = setInterval(() => {
    renewSessionLock(sessionId, token, ttlMs).catch(() => {});
  }, renewMs);

  try {
    return await fn();
  } finally {
    clearInterval(heartbeat);
    await releaseSessionLock(sessionId, token).catch(() => {});
  }
}
