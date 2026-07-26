import { Queue } from 'bullmq';
import { getBullMQConnection } from './connection.js';
import { QUEUE_NAME } from '../redis/keys.js';

// ---------------------------------------------------------------------------
// Singleton BullMQ Queue for task dispatch
// ---------------------------------------------------------------------------

let queue = null;

export function getTaskQueue() {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, {
      connection: getBullMQConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });
  }
  return queue;
}

/**
 * Enqueue a task job.
 */
export async function enqueueTask(taskId, { sessionId, prompt, agent }) {
  const q = getTaskQueue();
  return q.add('task', { type: 'task', taskId, sessionId, prompt, agent, rateLimitRetries: 0 }, { jobId: taskId });
}

/**
 * Enqueue a subtask job.
 */
export async function enqueueSubtask(subtaskId, { taskId, sessionId, prompt, agent }) {
  const q = getTaskQueue();
  return q.add('subtask', { type: 'subtask', subtaskId, taskId, sessionId, prompt, agent, rateLimitRetries: 0 }, { jobId: subtaskId });
}

/**
 * Remove a job by ID (tolerates "not found").
 */
export async function removeJob(jobId) {
  const q = getTaskQueue();
  try {
    const job = await q.getJob(jobId);
    if (job) await job.remove();
  } catch {
    // Job may already be gone — ignore
  }
}

/**
 * Close the queue connection.
 */
export async function closeTaskQueue() {
  if (queue) {
    await queue.close();
    queue = null;
  }
}

/**
 * Reset singleton (for tests).
 */
export function resetTaskQueue() {
  queue = null;
}
