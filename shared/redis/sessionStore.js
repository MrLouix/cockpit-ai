import crypto from 'node:crypto';
import { getRedis } from './client.js';
import { KEYS } from './keys.js';

// ---------------------------------------------------------------------------
// Session CRUD — backed by Redis hashes + ZSET/SET indexes
// ---------------------------------------------------------------------------

/**
 * Create a new session.
 * @returns {object} The created session object.
 */
export async function createSession({ directory, titre }) {
  const redis = getRedis();
  const id = crypto.randomUUID();
  const now = Date.now();
  const nowISO = new Date(now).toISOString();

  const data = { _id: id, directory, titre, createdAt: nowISO, updatedAt: nowISO };

  const multi = redis.multi();
  multi.hset(KEYS.session(id), data);
  multi.zadd(KEYS.sessionsAll, now, id);
  multi.sadd(KEYS.sessionsByDirectory(directory), id);
  await multi.exec();

  return data;
}

/**
 * Get a session by ID. Returns null if not found.
 */
export async function getSession(id) {
  const redis = getRedis();
  const data = await redis.hgetall(KEYS.session(id));
  if (!data || !data._id) return null;
  return data;
}

/**
 * Get all sessions, sorted by createdAt descending (most recent first).
 */
export async function getAllSessions() {
  const redis = getRedis();
  const ids = await redis.zrevrange(KEYS.sessionsAll, 0, -1);
  if (ids.length === 0) return [];

  const pipeline = redis.pipeline();
  for (const id of ids) {
    pipeline.hgetall(KEYS.session(id));
  }
  const results = await pipeline.exec();
  return results.map(([err, data]) => data).filter((d) => d && d._id);
}

/**
 * Update a session. Only updates the fields provided.
 * Handles directory index migration if directory changes.
 * Returns the updated session or null if not found.
 */
export async function updateSession(id, fields) {
  const redis = getRedis();
  const existing = await getSession(id);
  if (!existing) return null;

  const updates = { ...fields, updatedAt: new Date().toISOString() };
  // Don't allow overwriting _id or createdAt
  delete updates._id;
  delete updates.createdAt;

  const multi = redis.multi();
  multi.hset(KEYS.session(id), updates);

  // If directory changed, update the by-directory index
  if (fields.directory !== undefined && fields.directory !== existing.directory) {
    multi.srem(KEYS.sessionsByDirectory(existing.directory), id);
    multi.sadd(KEYS.sessionsByDirectory(fields.directory), id);
  }

  await multi.exec();

  return { ...existing, ...updates };
}

/**
 * Delete a session and cascade-delete all its tasks (hashes + indexes + subtasks).
 * Returns true if the session existed, false otherwise.
 */
export async function deleteSession(id) {
  const redis = getRedis();
  const existing = await getSession(id);
  if (!existing) return false;

  // Gather task IDs belonging to this session
  const taskIds = await redis.zrange(KEYS.tasksBySession(id), 0, -1);

  const multi = redis.multi();

  // Delete each task's hash, subtask hashes, subtask list, and index entries
  for (const taskId of taskIds) {
    // Get subtask IDs for this task
    const subtaskIds = await redis.lrange(KEYS.subtasksList(taskId), 0, -1);
    for (const subtaskId of subtaskIds) {
      multi.del(KEYS.subtask(taskId, subtaskId));
    }
    multi.del(KEYS.subtasksList(taskId));

    // Read task to get its status for index cleanup
    const task = await redis.hgetall(KEYS.task(taskId));
    if (task && task.status) {
      multi.zrem(KEYS.tasksByStatus(task.status), taskId);
    }
    multi.zrem(KEYS.tasksAll, taskId);
    multi.del(KEYS.task(taskId));
  }

  // Delete session indexes
  multi.del(KEYS.tasksBySession(id));
  multi.zrem(KEYS.sessionsAll, id);
  multi.srem(KEYS.sessionsByDirectory(existing.directory), id);
  multi.del(KEYS.session(id));

  await multi.exec();
  return true;
}

/**
 * Get session IDs for a given directory.
 */
export async function getSessionIdsByDirectory(directory) {
  const redis = getRedis();
  return redis.smembers(KEYS.sessionsByDirectory(directory));
}
