import crypto from 'node:crypto';
import { getRedis } from './client.js';
import { KEYS, TASK_STATUSES } from './keys.js';
import { getSession, getSessionIdsByDirectory } from './sessionStore.js';

// ---------------------------------------------------------------------------
// Task & Subtask CRUD — backed by Redis hashes + ZSET/SET/LIST indexes
// ---------------------------------------------------------------------------

// ── Helpers ─────────────────────────────────────────────────────────────────

function parseHashFields(data) {
  if (!data || !data._id) return null;
  // subtasks are not stored in the task hash — they are separate
  return data;
}

/**
 * Populate the sessionId field with the full session object,
 * matching the shape Mongoose `.populate('sessionId', 'directory titre')` produced.
 */
async function populateSession(task) {
  if (!task || !task.sessionId) return task;
  const session = await getSession(task.sessionId);
  if (session) {
    task.sessionId = { _id: session._id, directory: session.directory, titre: session.titre };
  }
  return task;
}

/**
 * Read all subtasks for a task, in order.
 */
async function readSubtasks(taskId) {
  const redis = getRedis();
  const subtaskIds = await redis.lrange(KEYS.subtasksList(taskId), 0, -1);
  if (subtaskIds.length === 0) return [];

  const pipeline = redis.pipeline();
  for (const sid of subtaskIds) {
    pipeline.hgetall(KEYS.subtask(taskId, sid));
  }
  const results = await pipeline.exec();
  return results.map(([, data]) => data).filter((d) => d && d._id);
}

/**
 * Atomic status transition: ZREM from old by-status index, ZADD to new, HSET.
 */
async function transitionStatus(key, id, oldStatus, newStatus, extraFields = {}) {
  const redis = getRedis();
  const now = Date.now();
  const updates = {
    status: newStatus,
    updatedAt: new Date(now).toISOString(),
    ...extraFields,
  };

  const multi = redis.multi();
  multi.hset(key, updates);
  // Only manage task-level indexes (not subtask)
  if (!key.includes(':subtask:')) {
    if (oldStatus) multi.zrem(KEYS.tasksByStatus(oldStatus), id);
    multi.zadd(KEYS.tasksByStatus(newStatus), now, id);
  }
  await multi.exec();
}

// ── Task CRUD ───────────────────────────────────────────────────────────────

export async function createTask({ sessionId, prompt, agent = 'claude' }) {
  const redis = getRedis();
  const id = crypto.randomUUID();
  const now = Date.now();
  const nowISO = new Date(now).toISOString();

  const data = {
    _id: id,
    sessionId,
    prompt,
    agent,
    status: 'pending',
    result: '',
    executedByAgent: '',
    endDate: '',
    createdAt: nowISO,
    updatedAt: nowISO,
  };

  const multi = redis.multi();
  multi.hset(KEYS.task(id), data);
  multi.zadd(KEYS.tasksAll, now, id);
  multi.zadd(KEYS.tasksByStatus('pending'), now, id);
  multi.zadd(KEYS.tasksBySession(sessionId), now, id);
  await multi.exec();

  return data;
}

/**
 * Get a single task by ID, with subtasks embedded and sessionId populated.
 * Returns null if not found.
 */
export async function getTask(id, { populate = true } = {}) {
  const redis = getRedis();
  const data = await redis.hgetall(KEYS.task(id));
  const task = parseHashFields(data);
  if (!task) return null;

  task.subtasks = await readSubtasks(id);
  if (populate) await populateSession(task);
  return task;
}

/**
 * Get tasks with optional filters.
 */
export async function getTasks({ directory, status, limit = 100 } = {}) {
  const redis = getRedis();
  let taskIds;

  if (status && TASK_STATUSES.includes(status)) {
    taskIds = await redis.zrevrange(KEYS.tasksByStatus(status), 0, -1);
  } else {
    taskIds = await redis.zrevrange(KEYS.tasksAll, 0, -1);
  }

  // Filter by directory (find sessions in that directory, then intersect)
  if (directory) {
    const sessionIds = await getSessionIdsByDirectory(directory);
    const sessionSet = new Set(sessionIds);
    // We need to read each task's sessionId to filter — pipeline for efficiency
    const pipeline = redis.pipeline();
    for (const tid of taskIds) {
      pipeline.hget(KEYS.task(tid), 'sessionId');
    }
    const results = await pipeline.exec();
    taskIds = taskIds.filter((_, i) => {
      const [, sid] = results[i];
      return sessionSet.has(sid);
    });
  }

  const total = taskIds.length;

  // Apply limit
  taskIds = taskIds.slice(0, limit);

  // Fetch full task data
  const pipeline = redis.pipeline();
  for (const tid of taskIds) {
    pipeline.hgetall(KEYS.task(tid));
  }
  const results = await pipeline.exec();

  const tasks = [];
  for (let i = 0; i < results.length; i++) {
    const [, data] = results[i];
    const task = parseHashFields(data);
    if (!task) continue;
    task.subtasks = await readSubtasks(task._id);
    await populateSession(task);
    tasks.push(task);
  }

  return { tasks, total };
}

/**
 * Update task fields. If status is changing, uses atomic transition.
 * Returns the updated task or null.
 */
export async function updateTask(id, fields) {
  const redis = getRedis();
  const existing = await redis.hgetall(KEYS.task(id));
  if (!existing || !existing._id) return null;

  const updates = { ...fields, updatedAt: new Date().toISOString() };
  delete updates._id;
  delete updates.createdAt;
  delete updates.subtasks;

  if (fields.status && fields.status !== existing.status) {
    await transitionStatus(KEYS.task(id), id, existing.status, fields.status, updates);
  } else {
    await redis.hset(KEYS.task(id), updates);
  }

  return getTask(id);
}

/**
 * Delete a task and all its subtasks, removing from all indexes.
 */
export async function deleteTask(id) {
  const redis = getRedis();
  const existing = await redis.hgetall(KEYS.task(id));
  if (!existing || !existing._id) return false;

  const subtaskIds = await redis.lrange(KEYS.subtasksList(id), 0, -1);

  const multi = redis.multi();
  for (const sid of subtaskIds) {
    multi.del(KEYS.subtask(id, sid));
  }
  multi.del(KEYS.subtasksList(id));
  multi.zrem(KEYS.tasksAll, id);
  if (existing.status) multi.zrem(KEYS.tasksByStatus(existing.status), id);
  if (existing.sessionId) multi.zrem(KEYS.tasksBySession(existing.sessionId), id);
  multi.del(KEYS.task(id));
  await multi.exec();

  return true;
}

// ── Subtask CRUD ────────────────────────────────────────────────────────────

export async function addSubtask(taskId, { prompt, agent = 'claude' }) {
  const redis = getRedis();
  const id = crypto.randomUUID();
  const now = Date.now();
  const nowISO = new Date(now).toISOString();

  const data = {
    _id: id,
    prompt,
    agent,
    status: 'pending',
    result: '',
    executedByAgent: '',
    endDate: '',
    createdAt: nowISO,
    updatedAt: nowISO,
  };

  const multi = redis.multi();
  multi.hset(KEYS.subtask(taskId, id), data);
  multi.rpush(KEYS.subtasksList(taskId), id);
  await multi.exec();

  return data;
}

export async function getSubtask(taskId, subtaskId) {
  const redis = getRedis();
  const data = await redis.hgetall(KEYS.subtask(taskId, subtaskId));
  if (!data || !data._id) return null;
  return data;
}

export async function updateSubtask(taskId, subtaskId, fields) {
  const redis = getRedis();
  const existing = await redis.hgetall(KEYS.subtask(taskId, subtaskId));
  if (!existing || !existing._id) return null;

  const updates = { ...fields, updatedAt: new Date().toISOString() };
  delete updates._id;
  delete updates.createdAt;

  await redis.hset(KEYS.subtask(taskId, subtaskId), updates);

  return { ...existing, ...updates };
}

/**
 * Check if all subtasks of a parent task are terminal.
 * If so, transition the parent to success or failed.
 * Returns the new parent status or null if not finalized.
 */
export async function maybeFinalizeParent(taskId) {
  const redis = getRedis();
  const subtasks = await readSubtasks(taskId);
  if (subtasks.length === 0) return null;

  const hasPendingOrRunning = subtasks.some(
    (st) => st.status === 'pending' || st.status === 'running'
  );
  if (hasPendingOrRunning) return null;

  const allSuccess = subtasks.every(
    (st) => st.status === 'success' || st.status === 'skipped'
  );
  const newStatus = allSuccess ? 'success' : 'failed';

  await updateTask(taskId, { status: newStatus, endDate: new Date().toISOString() });
  return newStatus;
}

/**
 * Get task count by status (for health endpoint).
 */
export async function getTaskCountByStatus(status) {
  const redis = getRedis();
  return redis.zcard(KEYS.tasksByStatus(status));
}

export async function getTotalTaskCount() {
  const redis = getRedis();
  return redis.zcard(KEYS.tasksAll);
}
