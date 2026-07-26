import { jest } from '@jest/globals';
import RedisMock from 'ioredis-mock';

const redisMock = new RedisMock();

const mockRunAgent = jest.fn();
const mockDetectSubtasks = jest.fn(() => null);

jest.unstable_mockModule('../../shared/redis/client.js', () => ({
  getRedis: () => redisMock,
  closeRedis: jest.fn(),
  resetRedis: jest.fn(),
}));

jest.unstable_mockModule('../../shared/queue/taskQueue.js', () => ({
  enqueueTask: jest.fn().mockResolvedValue(undefined),
  enqueueSubtask: jest.fn().mockResolvedValue(undefined),
  removeJob: jest.fn().mockResolvedValue(undefined),
  getTaskQueue: jest.fn().mockReturnValue({ getJobCounts: jest.fn().mockResolvedValue({}) }),
  closeTaskQueue: jest.fn(),
  resetTaskQueue: jest.fn(),
}));

jest.unstable_mockModule('../agents/index.js', () => ({
  runAgent: mockRunAgent,
  detectSubtasks: mockDetectSubtasks,
}));

// Dynamic imports AFTER mocks
const sessionStore = await import('../../shared/redis/sessionStore.js');
const taskStore = await import('../../shared/redis/taskStore.js');
const { KEYS } = await import('../../shared/redis/keys.js');
const { processTaskJob, processSubtaskJob } = await import('../processor.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeJob(data, opts = {}) {
  return {
    id: data.taskId || data.subtaskId,
    data: { rateLimitRetries: 0, ...data },
    timestamp: Date.now(),
    moveToDelayed: jest.fn().mockResolvedValue(undefined),
    updateData: jest.fn().mockResolvedValue(undefined),
    ...opts,
  };
}

async function seedTask(overrides = {}) {
  const session = await sessionStore.createSession({ directory: '/proj', titre: 'Test' });
  const task = await taskStore.createTask({
    sessionId: session._id,
    prompt: 'do something',
    agent: 'claude',
    ...overrides,
  });
  return { session, task };
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

afterEach(async () => {
  await redisMock.flushall();
  mockRunAgent.mockReset();
  mockDetectSubtasks.mockReset();
  mockDetectSubtasks.mockReturnValue(null);
});

// ---------------------------------------------------------------------------
// Rate limit from runAgent result
// ---------------------------------------------------------------------------

describe('Rate limit handling — runAgent returns rate_limit error', () => {
  it('calls job.moveToDelayed when runAgent returns errorType rate_limit', async () => {
    mockRunAgent.mockResolvedValue({ success: false, error: 'rate limit exceeded', errorType: 'rate_limit' });
    const { session, task } = await seedTask();
    const job = makeJob({
      type: 'task',
      taskId: task._id,
      sessionId: session._id,
      prompt: task.prompt,
      agent: 'claude',
    });

    // Should throw DelayedError
    await expect(processTaskJob(job, 'test-token')).rejects.toThrow();
    expect(job.moveToDelayed).toHaveBeenCalled();
  });

  it('increments rateLimitRetries in job data via updateData', async () => {
    mockRunAgent.mockResolvedValue({ success: false, error: 'rate limit exceeded', errorType: 'rate_limit' });
    const { session, task } = await seedTask();
    const job = makeJob({
      type: 'task',
      taskId: task._id,
      sessionId: session._id,
      prompt: task.prompt,
      agent: 'claude',
    });

    await expect(processTaskJob(job, 'test-token')).rejects.toThrow();

    expect(job.updateData).toHaveBeenCalledWith(
      expect.objectContaining({ rateLimitRetries: 1 })
    );
  });

  it('releases session lock after rate limit error', async () => {
    mockRunAgent.mockResolvedValue({ success: false, error: 'rate limit exceeded', errorType: 'rate_limit' });
    const { session, task } = await seedTask();
    const job = makeJob({
      type: 'task',
      taskId: task._id,
      sessionId: session._id,
      prompt: task.prompt,
      agent: 'claude',
    });

    await expect(processTaskJob(job, 'test-token')).rejects.toThrow();

    // Session lock should be released — verify by acquiring a new one
    const lockResult = await redisMock.set(
      KEYS.sessionLock(session._id), 'new-token', 'PX', 30000, 'NX'
    );
    expect(lockResult).toBe('OK');
  });

  it('task status is not marked as failed on rate limit (remains running)', async () => {
    mockRunAgent.mockResolvedValue({ success: false, error: 'rate limit exceeded', errorType: 'rate_limit' });
    const { session, task } = await seedTask();
    const job = makeJob({
      type: 'task',
      taskId: task._id,
      sessionId: session._id,
      prompt: task.prompt,
      agent: 'claude',
    });

    await expect(processTaskJob(job, 'test-token')).rejects.toThrow();

    const updated = await taskStore.getTask(task._id, { populate: false });
    // Task was transitioned to running but NOT to failed
    expect(updated.status).toBe('running');
  });
});

// ---------------------------------------------------------------------------
// Max wait exceeded — task marked failed
// ---------------------------------------------------------------------------

describe('Rate limit handling — max wait exceeded', () => {
  it('marks task as failed when cumulative wait exceeds max', async () => {
    mockRunAgent.mockResolvedValue({ success: false, error: 'rate limit exceeded', errorType: 'rate_limit' });
    const { session, task } = await seedTask();

    // Create job with timestamp far in the past to exceed RATE_LIMIT_MAX_WAIT_MS (7 days)
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    const job = makeJob(
      {
        type: 'task',
        taskId: task._id,
        sessionId: session._id,
        prompt: task.prompt,
        agent: 'claude',
        rateLimitRetries: 10,
      },
      { timestamp: eightDaysAgo }
    );

    // Should NOT throw because the task is marked failed instead of delayed
    await processTaskJob(job, 'test-token');

    const updated = await taskStore.getTask(task._id, { populate: false });
    expect(updated.status).toBe('failed');
    expect(updated.result).toMatch(/Rate limit not resolved/);
  });
});

// ---------------------------------------------------------------------------
// Global rate limit coordination
// ---------------------------------------------------------------------------

describe('Rate limit handling — global coordination', () => {
  it('delays job without calling runAgent when global rate limit is active', async () => {
    const { session, task } = await seedTask();

    // Set global rate limit for claude to 10 minutes in the future
    const futureMs = Date.now() + 10 * 60 * 1000;
    await redisMock.set(KEYS.agentRateLimitUntil('claude'), String(futureMs));

    const job = makeJob({
      type: 'task',
      taskId: task._id,
      sessionId: session._id,
      prompt: task.prompt,
      agent: 'claude',
    });

    await expect(processTaskJob(job, 'test-token')).rejects.toThrow();
    expect(job.moveToDelayed).toHaveBeenCalled();
    expect(mockRunAgent).not.toHaveBeenCalled();
  });

  it('proceeds normally when global rate limit is in the past (expired)', async () => {
    mockRunAgent.mockResolvedValue({ success: true, result: 'ok' });
    const { session, task } = await seedTask();

    // Set global rate limit to the past (already expired)
    const pastMs = Date.now() - 1000;
    await redisMock.set(KEYS.agentRateLimitUntil('claude'), String(pastMs));

    const job = makeJob({
      type: 'task',
      taskId: task._id,
      sessionId: session._id,
      prompt: task.prompt,
      agent: 'claude',
    });

    await processTaskJob(job, 'test-token');

    expect(mockRunAgent).toHaveBeenCalledTimes(1);
    const updated = await taskStore.getTask(task._id, { populate: false });
    expect(updated.status).toBe('success');
  });

  it('clears agent rate limit after successful call', async () => {
    mockRunAgent.mockResolvedValue({ success: true, result: 'ok' });
    const { session, task } = await seedTask();

    const job = makeJob({
      type: 'task',
      taskId: task._id,
      sessionId: session._id,
      prompt: task.prompt,
      agent: 'claude',
    });

    await processTaskJob(job, 'test-token');

    // The rate limit key should be deleted
    const val = await redisMock.get(KEYS.agentRateLimitUntil('claude'));
    expect(val).toBeNull();
  });

  it('sets global rate limit key when agent reports rate_limit', async () => {
    mockRunAgent.mockResolvedValue({ success: false, error: 'rate limited', errorType: 'rate_limit' });
    const { session, task } = await seedTask();

    const job = makeJob({
      type: 'task',
      taskId: task._id,
      sessionId: session._id,
      prompt: task.prompt,
      agent: 'claude',
    });

    await expect(processTaskJob(job, 'test-token')).rejects.toThrow();

    // The rate limit key should be set for the agent
    const val = await redisMock.get(KEYS.agentRateLimitUntil('claude'));
    expect(val).not.toBeNull();
    expect(parseInt(val, 10)).toBeGreaterThan(Date.now());
  });
});

// ---------------------------------------------------------------------------
// Subtask rate limit handling
// ---------------------------------------------------------------------------

describe('Rate limit handling — subtask', () => {
  it('delays subtask job on rate_limit error without finalizing parent', async () => {
    mockRunAgent.mockResolvedValue({ success: false, error: 'rate limited', errorType: 'rate_limit' });

    const session = await sessionStore.createSession({ directory: '/proj', titre: 'Test' });
    const task = await taskStore.createTask({ sessionId: session._id, prompt: 'parent', agent: 'claude' });
    await taskStore.updateTask(task._id, { status: 'running' });
    const subtask = await taskStore.addSubtask(task._id, { prompt: 'child', agent: 'claude' });

    const job = makeJob({
      type: 'subtask',
      subtaskId: subtask._id,
      taskId: task._id,
      sessionId: session._id,
      prompt: subtask.prompt,
      agent: 'claude',
    });

    await expect(processSubtaskJob(job, 'test-token')).rejects.toThrow();
    expect(job.moveToDelayed).toHaveBeenCalled();

    // Parent should still be running (not finalized)
    const updatedTask = await taskStore.getTask(task._id, { populate: false });
    expect(updatedTask.status).toBe('running');
  });
});
