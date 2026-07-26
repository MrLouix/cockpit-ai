import { getRedis } from './client.js';
import { KEYS } from './keys.js';

// ---------------------------------------------------------------------------
// Global rate limit coordination per agent type
// ---------------------------------------------------------------------------

// Lua: set key to max(existing, new) with TTL
const REPORT_SCRIPT = `
local key = KEYS[1]
local newUntil = tonumber(ARGV[1])
local ttlMs = tonumber(ARGV[2])
local current = tonumber(redis.call("get", key) or "0")
if newUntil > (current or 0) then
  redis.call("set", key, newUntil, "PX", ttlMs)
  return newUntil
else
  return current
end
`;

/**
 * Get the epoch ms until which an agent type is rate-limited.
 * Returns null if not rate-limited.
 */
export async function getAgentRateLimitUntil(agentType) {
  const redis = getRedis();
  const val = await redis.get(KEYS.agentRateLimitUntil(agentType));
  if (!val) return null;
  const until = parseInt(val, 10);
  if (until <= Date.now()) return null; // expired
  return until;
}

/**
 * Report a rate limit for an agent type. Uses max(existing, new) atomically.
 * TTL is set to untilMs - now + 1h margin, minimum 60s.
 */
export async function reportAgentRateLimit(agentType, untilMs) {
  const redis = getRedis();
  const marginMs = 3600_000; // 1 hour margin
  const ttlMs = Math.max(untilMs - Date.now() + marginMs, 60_000);
  return redis.eval(REPORT_SCRIPT, 1, KEYS.agentRateLimitUntil(agentType), untilMs, ttlMs);
}

/**
 * Clear rate limit for an agent type (e.g., after a successful call).
 */
export async function clearAgentRateLimit(agentType) {
  const redis = getRedis();
  return redis.del(KEYS.agentRateLimitUntil(agentType));
}

/**
 * Get rate limit status for all known agents (for health endpoint).
 */
export async function getAllAgentRateLimits(agentTypes) {
  const result = {};
  for (const agent of agentTypes) {
    result[agent] = await getAgentRateLimitUntil(agent);
  }
  return result;
}
