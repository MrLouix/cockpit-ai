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
const { processTaskJob, processSubtaskJob } = await import('../processor.js');

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
// No tasks — non-existent task ID
// ---------------------------------------------------------------------------

describe('Worker behavior — no tasks', () => {
  it('processTaskJob with non-existent task is a no-op', async () => {
    const job = makeJob({
      type: 'task',
      taskId: 'non-existent-id',
      sessionId: 'non-existent-session',
      prompt: 'test',
      agent: 'claude',
    });

    // Should not throw; task not found → early return
    await processTaskJob(job, 'test-token');
    expect(mockRunAgent).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Single pending task
// ---------------------------------------------------------------------------

describe('Worker behavior — single pending task', () => {
  it('processes pending task to success', async () => {
    mockRunAgent.mockResolvedValue({ success: true, result: 'ok' });
    const session = await sessionStore.createSession({ directory: '/proj', titre: 'Test' });
    const task = await taskStore.createTask({ sessionId: session._id, prompt: 'do it', agent: 'claude' });

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
});

// ---------------------------------------------------------------------------
// Task with subtask decomposition — full flow
// ---------------------------------------------------------------------------

describe('Worker behavior — task with subtask decomposition', () => {
  it('processTaskJob creates subtasks, then processSubtaskJob completes them and finalizes parent', async () => {
    // Step 1: processTaskJob with decomposition
    mockRunAgent.mockResolvedValue({ success: true, result: 'decomposed output' });
    mockDetectSubtasks.mockReturnValue(['sub1', 'sub2']);

    const session = await sessionStore.createSession({ directory: '/proj', titre: 'Test' });
    const task = await taskStore.createTask({ sessionId: session._id, prompt: 'parent', agent: 'claude' });

    const taskJob = makeJob({
      type: 'task',
      taskId: task._id,
      sessionId: session._id,
      prompt: task.prompt,
      agent: 'claude',
    });

    await processTaskJob(taskJob, 'test-token');

    // Parent should be running with subtasks created
    let updated = await taskStore.getTask(task._id, { populate: false });
    expect(updated.status).toBe('running');
    expect(updated.subtasks).toHaveLength(2);

    // Step 2: process each subtask
    mockDetectSubtasks.mockReturnValue(null);
    mockRunAgent.mockResolvedValue({ success: true, result: 'sub done' });

    for (const subtask of updated.subtasks) {
      const subJob = makeJob({
        type: 'subtask',
        subtaskId: subtask._id,
        taskId: task._id,
        sessionId: session._id,
        prompt: subtask.prompt,
        agent: 'claude',
      });
      await processSubtaskJob(subJob, 'test-token');
    }

    // Parent should now be finalized
    updated = await taskStore.getTask(task._id, { populate: false });
    expect(updated.status).toBe('success');
    expect(updated.subtasks[0].status).toBe('success');
    expect(updated.subtasks[1].status).toBe('success');
  });
});

// ---------------------------------------------------------------------------
// Already-terminal tasks are skipped
// ---------------------------------------------------------------------------

describe('Worker behavior — terminal status tasks', () => {
  it.each(['success', 'failed', 'skipped'])(
    'processTaskJob is a no-op for task with status "%s"',
    async (status) => {
      const session = await sessionStore.createSession({ directory: '/proj', titre: 'Test' });
      const task = await taskStore.createTask({ sessionId: session._id, prompt: 'test', agent: 'claude' });
      await taskStore.updateTask(task._id, { status });

      const job = makeJob({
        type: 'task',
        taskId: task._id,
        sessionId: session._id,
        prompt: task.prompt,
        agent: 'claude',
      });

      await processTaskJob(job, 'test-token');

      expect(mockRunAgent).not.toHaveBeenCalled();
      const updated = await taskStore.getTask(task._id, { populate: false });
      expect(updated.status).toBe(status);
    }
  );
});
