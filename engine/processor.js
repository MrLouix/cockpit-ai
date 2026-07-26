import crypto from 'node:crypto';
import { DelayedError } from 'bullmq';
import { runAgent, detectSubtasks } from './agents/index.js';
import { getRedis } from '../shared/redis/client.js';
import { KEYS } from '../shared/redis/keys.js';
import * as taskStore from '../shared/redis/taskStore.js';
import { acquireSessionLock, renewSessionLock, releaseSessionLock } from '../shared/redis/locks.js';
import { getAgentRateLimitUntil, reportAgentRateLimit, clearAgentRateLimit } from '../shared/redis/rateLimitStore.js';
import { enqueueSubtask } from '../shared/queue/taskQueue.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SESSION_LOCK_TTL_MS = parseInt(process.env.SESSION_LOCK_TTL_MS, 10) || 30000;
const SESSION_LOCK_RENEW_MS = parseInt(process.env.SESSION_LOCK_RENEW_MS, 10) || 10000;
const LOCK_RETRY_DELAY_MS = parseInt(process.env.POLL_INTERVAL, 10) || 5000;

const RATE_LIMIT_BASE_DELAY_MS = parseInt(process.env.RATE_LIMIT_BASE_DELAY_MS, 10) || 300_000; // 5 min
const RATE_LIMIT_MAX_DELAY_MS = parseInt(process.env.RATE_LIMIT_MAX_DELAY_MS, 10) || 21_600_000; // 6h
const RATE_LIMIT_MAX_WAIT_MS = parseInt(process.env.RATE_LIMIT_MAX_WAIT_MS, 10) || 604_800_000; // 7 days

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calcRateLimitDelay(retryCount, retryAfterMs) {
  if (retryAfterMs && retryAfterMs > 0) return retryAfterMs;
  const delay = RATE_LIMIT_BASE_DELAY_MS * Math.pow(2, retryCount);
  return Math.min(delay, RATE_LIMIT_MAX_DELAY_MS);
}

function jitter(ms) {
  return ms + Math.floor(Math.random() * 60_000); // 0–60s jitter
}

// ---------------------------------------------------------------------------
// Processor — dispatches by job.data.type
// ---------------------------------------------------------------------------

export async function processor(job, token) {
  const { type } = job.data;
  if (type === 'subtask') {
    return processSubtaskJob(job, token);
  }
  return processTaskJob(job, token);
}

// ---------------------------------------------------------------------------
// processTaskJob
// ---------------------------------------------------------------------------

export async function processTaskJob(job, token) {
  const { taskId, sessionId, agent } = job.data;
  const lockToken = `${process.pid}-${Date.now()}-${crypto.randomUUID()}`;

  // 1. Check global rate limit for this agent type
  const rateLimitUntil = await getAgentRateLimitUntil(agent);
  if (rateLimitUntil && Date.now() < rateLimitUntil) {
    const delayMs = jitter(rateLimitUntil - Date.now());
    await job.moveToDelayed(Date.now() + delayMs, token);
    throw new DelayedError();
  }

  // 2. Acquire session lock
  const acquired = await acquireSessionLock(sessionId, lockToken, SESSION_LOCK_TTL_MS);
  if (!acquired) {
    await job.moveToDelayed(Date.now() + LOCK_RETRY_DELAY_MS, token);
    throw new DelayedError();
  }

  const heartbeat = setInterval(() => {
    renewSessionLock(sessionId, lockToken, SESSION_LOCK_TTL_MS).catch(() => {});
  }, SESSION_LOCK_RENEW_MS);

  try {
    // 3. Re-check business status
    const task = await taskStore.getTask(taskId, { populate: false });
    if (!task || task.status !== 'pending') return;

    // 4. Transition to running
    await taskStore.updateTask(taskId, { status: 'running' });

    // 5. Get working directory from session
    const redis = getRedis();
    const sessionData = await redis.hgetall(KEYS.session(sessionId));
    const workingDirectory = sessionData?.directory;

    // 6. Run the agent
    const result = await runAgent(agent, task.prompt, { workingDirectory });

    // 7. Re-check status (skip protection)
    const freshTask = await taskStore.getTask(taskId, { populate: false });
    if (freshTask && freshTask.status === 'skipped') {
      console.log(`Task ${taskId} was skipped during execution, discarding result`);
      return;
    }

    if (result.success) {
      await clearAgentRateLimit(agent);
      const subtasks = detectSubtasks(result.result);

      if (subtasks && subtasks.length > 0) {
        // Parent stays running; create and enqueue subtasks
        await taskStore.updateTask(taskId, {
          result: result.result,
          executedByAgent: agent,
        });

        for (const prompt of subtasks) {
          const subtask = await taskStore.addSubtask(taskId, { prompt, agent });
          await enqueueSubtask(subtask._id, {
            taskId,
            sessionId,
            prompt,
            agent,
          });
        }
        console.log(`Decomposition detected for task ${taskId}: ${subtasks.length} subtasks created`);
      } else {
        await taskStore.updateTask(taskId, {
          status: 'success',
          result: result.result,
          executedByAgent: agent,
          endDate: new Date().toISOString(),
        });
      }
    } else if (result.errorType === 'rate_limit') {
      await handleRateLimit(job, token, agent, taskId, result);
    } else {
      await taskStore.updateTask(taskId, {
        status: 'failed',
        result: result.error || 'Unknown error',
        executedByAgent: agent,
        endDate: new Date().toISOString(),
      });
    }
  } finally {
    clearInterval(heartbeat);
    await releaseSessionLock(sessionId, lockToken).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// processSubtaskJob
// ---------------------------------------------------------------------------

export async function processSubtaskJob(job, token) {
  const { subtaskId, taskId, sessionId, agent } = job.data;
  const lockToken = `${process.pid}-${Date.now()}-${crypto.randomUUID()}`;

  // 1. Check global rate limit
  const rateLimitUntil = await getAgentRateLimitUntil(agent);
  if (rateLimitUntil && Date.now() < rateLimitUntil) {
    const delayMs = jitter(rateLimitUntil - Date.now());
    await job.moveToDelayed(Date.now() + delayMs, token);
    throw new DelayedError();
  }

  // 2. Acquire session lock
  const acquired = await acquireSessionLock(sessionId, lockToken, SESSION_LOCK_TTL_MS);
  if (!acquired) {
    await job.moveToDelayed(Date.now() + LOCK_RETRY_DELAY_MS, token);
    throw new DelayedError();
  }

  const heartbeat = setInterval(() => {
    renewSessionLock(sessionId, lockToken, SESSION_LOCK_TTL_MS).catch(() => {});
  }, SESSION_LOCK_RENEW_MS);

  try {
    // 3. Re-check subtask status
    const subtask = await taskStore.getSubtask(taskId, subtaskId);
    if (!subtask || subtask.status !== 'pending') return;

    // 4. Transition to running
    await taskStore.updateSubtask(taskId, subtaskId, { status: 'running' });

    // 5. Get working directory
    const redis = getRedis();
    const sessionData = await redis.hgetall(KEYS.session(sessionId));
    const workingDirectory = sessionData?.directory;

    // 6. Run the agent
    const agentToUse = subtask.agent || agent;
    const result = await runAgent(agentToUse, subtask.prompt, { workingDirectory });

    // 7. Re-check status (skip protection)
    const freshSubtask = await taskStore.getSubtask(taskId, subtaskId);
    if (freshSubtask && freshSubtask.status === 'skipped') {
      console.log(`Subtask ${subtaskId} was skipped during execution, discarding result`);
      // Still try to finalize parent
      await taskStore.maybeFinalizeParent(taskId);
      return;
    }

    if (result.success) {
      await clearAgentRateLimit(agentToUse);
      await taskStore.updateSubtask(taskId, subtaskId, {
        status: 'success',
        result: result.result,
        executedByAgent: agentToUse,
        endDate: new Date().toISOString(),
      });
    } else if (result.errorType === 'rate_limit') {
      await handleRateLimit(job, token, agentToUse, taskId, result, subtaskId);
      return; // Don't finalize parent — subtask will retry
    } else {
      await taskStore.updateSubtask(taskId, subtaskId, {
        status: 'failed',
        result: result.error || 'Unknown error',
        executedByAgent: agentToUse,
        endDate: new Date().toISOString(),
      });
    }

    // 8. Maybe finalize parent
    const parentStatus = await taskStore.maybeFinalizeParent(taskId);
    if (parentStatus) {
      console.log(`All subtasks completed for task ${taskId}, marked as ${parentStatus}`);
    }
  } finally {
    clearInterval(heartbeat);
    await releaseSessionLock(sessionId, lockToken).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Rate limit handler (shared by task and subtask processors)
// ---------------------------------------------------------------------------

async function handleRateLimit(job, token, agent, taskId, result, subtaskId) {
  const retries = (job.data.rateLimitRetries || 0) + 1;
  const delayMs = calcRateLimitDelay(retries - 1, result.retryAfterMs);
  const untilMs = Date.now() + delayMs;

  // Check cumulative wait against max
  const createdAt = job.timestamp || Date.now();
  const cumulativeWait = Date.now() - createdAt + delayMs;
  if (cumulativeWait > RATE_LIMIT_MAX_WAIT_MS) {
    const failMsg = `Rate limit not resolved after ${Math.round(cumulativeWait / 86_400_000)}d of waiting`;
    if (subtaskId) {
      await taskStore.updateSubtask(taskId, subtaskId, {
        status: 'failed',
        result: failMsg,
        executedByAgent: agent,
        endDate: new Date().toISOString(),
      });
      await taskStore.maybeFinalizeParent(taskId);
    } else {
      await taskStore.updateTask(taskId, {
        status: 'failed',
        result: failMsg,
        executedByAgent: agent,
        endDate: new Date().toISOString(),
      });
    }
    return;
  }

  // Report global rate limit
  await reportAgentRateLimit(agent, untilMs);

  // Update job data with incremented counter
  await job.updateData({ ...job.data, rateLimitRetries: retries });

  // Reschedule without consuming a retry attempt
  await job.moveToDelayed(Date.now() + jitter(delayMs), token);
  throw new DelayedError();
}
