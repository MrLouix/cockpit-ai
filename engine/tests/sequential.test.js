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
const { processTaskJob } = await import('../processor.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeJob(data, opts = {}) {
  return {
    id: data.taskId || data.subtaskId,
    data,
    timestamp: Date.now(),
    moveToDelayed: jest.fn().mockResolvedValue(undefined),
    updateData: jest.fn().mockResolvedValue(undefined),
    ...opts,
  };
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
// Session lock — sequential execution
// ---------------------------------------------------------------------------

describe('Sequential execution — session lock', () => {
  it('second task in same session is delayed when lock is already held', async () => {
    const session = await sessionStore.createSession({ directory: '/proj', titre: 'Test' });
    const task = await taskStore.createTask({ sessionId: session._id, prompt: 'task2', agent: 'claude' });

    // Manually acquire the session lock to simulate contention
    await redisMock.set(KEYS.sessionLock(session._id), 'some-other-worker', 'PX', 30000, 'NX');

    const job = makeJob({
      type: 'task',
      taskId: task._id,
      sessionId: session._id,
      prompt: task.prompt,
      agent: 'claude',
    });

    // processTaskJob should call moveToDelayed and throw DelayedError
    await expect(processTaskJob(job, 'test-token')).rejects.toThrow();
    expect(job.moveToDelayed).toHaveBeenCalled();
    expect(mockRunAgent).not.toHaveBeenCalled();
  });

  it('task runs normally when session lock is not held', async () => {
    mockRunAgent.mockResolvedValue({ success: true, result: 'ok' });
    const session = await sessionStore.createSession({ directory: '/proj', titre: 'Test' });
    const task = await taskStore.createTask({ sessionId: session._id, prompt: 'task1', agent: 'claude' });

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

  it('tasks from different sessions can both run (different lock keys)', async () => {
    mockRunAgent.mockResolvedValue({ success: true, result: 'ok' });

    const session1 = await sessionStore.createSession({ directory: '/proj1', titre: 'A' });
    const session2 = await sessionStore.createSession({ directory: '/proj2', titre: 'B' });

    const task1 = await taskStore.createTask({ sessionId: session1._id, prompt: 'msg-a', agent: 'claude' });
    const task2 = await taskStore.createTask({ sessionId: session2._id, prompt: 'msg-b', agent: 'claude' });

    const job1 = makeJob({
      type: 'task',
      taskId: task1._id,
      sessionId: session1._id,
      prompt: task1.prompt,
      agent: 'claude',
    });
    const job2 = makeJob({
      type: 'task',
      taskId: task2._id,
      sessionId: session2._id,
      prompt: task2.prompt,
      agent: 'claude',
    });

    await processTaskJob(job1, 'test-token');
    await processTaskJob(job2, 'test-token');

    expect(mockRunAgent).toHaveBeenCalledTimes(2);

    const u1 = await taskStore.getTask(task1._id, { populate: false });
    const u2 = await taskStore.getTask(task2._id, { populate: false });
    expect(u1.status).toBe('success');
    expect(u2.status).toBe('success');
  });

  it('session lock is released after processTaskJob completes', async () => {
    mockRunAgent.mockResolvedValue({ success: true, result: 'ok' });
    const session = await sessionStore.createSession({ directory: '/proj', titre: 'Test' });
    const task = await taskStore.createTask({ sessionId: session._id, prompt: 'task1', agent: 'claude' });

    const job = makeJob({
      type: 'task',
      taskId: task._id,
      sessionId: session._id,
      prompt: task.prompt,
      agent: 'claude',
    });

    await processTaskJob(job, 'test-token');

    // Lock should be released — a new lock acquisition should succeed
    const lockResult = await redisMock.set(KEYS.sessionLock(session._id), 'new-token', 'PX', 30000, 'NX');
    expect(lockResult).toBe('OK');
  });

  it('session lock is released even when runAgent fails', async () => {
    mockRunAgent.mockResolvedValue({ success: false, error: 'boom', errorType: 'generic' });
    const session = await sessionStore.createSession({ directory: '/proj', titre: 'Test' });
    const task = await taskStore.createTask({ sessionId: session._id, prompt: 'task1', agent: 'claude' });

    const job = makeJob({
      type: 'task',
      taskId: task._id,
      sessionId: session._id,
      prompt: task.prompt,
      agent: 'claude',
    });

    await processTaskJob(job, 'test-token');

    // Lock should still be released
    const lockResult = await redisMock.set(KEYS.sessionLock(session._id), 'new-token', 'PX', 30000, 'NX');
    expect(lockResult).toBe('OK');
  });
});
