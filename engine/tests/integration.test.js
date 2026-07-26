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

async function seedTask(overrides = {}) {
  const session = await sessionStore.createSession({ directory: '/proj', titre: 'Integration' });
  const task = await taskStore.createTask({
    sessionId: session._id,
    prompt: 'do the thing',
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
// Full task lifecycle — success
// ---------------------------------------------------------------------------

it('pending task reaches success after processTaskJob', async () => {
  mockRunAgent.mockResolvedValue({ success: true, result: 'AI response' });
  const { session, task } = await seedTask();

  const job = makeJob({
    type: 'task',
    taskId: task._id,
    sessionId: session._id,
    prompt: task.prompt,
    agent: 'claude',
  });

  await processTaskJob(job, 'test-token');

  const updated = await taskStore.getTask(task._id, { populate: false });
  expect(updated.status).toBe('success');
  expect(updated.result).toBe('AI response');
  expect(updated.executedByAgent).toBe('claude');
});

// ---------------------------------------------------------------------------
// Full task lifecycle — failure
// ---------------------------------------------------------------------------

it('pending task reaches failed when runAgent fails', async () => {
  mockRunAgent.mockResolvedValue({ success: false, error: 'tool not found', errorType: 'generic' });
  const { session, task } = await seedTask();

  const job = makeJob({
    type: 'task',
    taskId: task._id,
    sessionId: session._id,
    prompt: task.prompt,
    agent: 'claude',
  });

  await processTaskJob(job, 'test-token');

  const updated = await taskStore.getTask(task._id, { populate: false });
  expect(updated.status).toBe('failed');
  expect(updated.result).toBe('tool not found');
});

// ---------------------------------------------------------------------------
// Task with subtask decomposition — full lifecycle
// ---------------------------------------------------------------------------

it('task with subtask decomposition: processTaskJob + processSubtaskJob completes both', async () => {
  mockRunAgent.mockResolvedValue({ success: true, result: 'decomposed' });
  mockDetectSubtasks.mockReturnValue(['child task']);

  const { session, task } = await seedTask();

  const taskJob = makeJob({
    type: 'task',
    taskId: task._id,
    sessionId: session._id,
    prompt: task.prompt,
    agent: 'claude',
  });

  await processTaskJob(taskJob, 'test-token');

  // Parent is running, subtask created
  let updated = await taskStore.getTask(task._id, { populate: false });
  expect(updated.status).toBe('running');
  expect(updated.subtasks).toHaveLength(1);
  expect(updated.subtasks[0].prompt).toBe('child task');

  // Now process the subtask
  mockDetectSubtasks.mockReturnValue(null);
  mockRunAgent.mockResolvedValue({ success: true, result: 'child done' });

  const subtask = updated.subtasks[0];
  const subJob = makeJob({
    type: 'subtask',
    subtaskId: subtask._id,
    taskId: task._id,
    sessionId: session._id,
    prompt: subtask.prompt,
    agent: 'claude',
  });

  await processSubtaskJob(subJob, 'test-token');

  // Both parent and subtask should be success
  updated = await taskStore.getTask(task._id, { populate: false });
  expect(updated.status).toBe('success');
  expect(updated.subtasks[0].status).toBe('success');
  expect(updated.subtasks[0].result).toBe('child done');
});

// ---------------------------------------------------------------------------
// Skipped task is ignored
// ---------------------------------------------------------------------------

it('skipped task is ignored by processTaskJob', async () => {
  const { session, task } = await seedTask();
  await taskStore.updateTask(task._id, { status: 'skipped' });

  const job = makeJob({
    type: 'task',
    taskId: task._id,
    sessionId: session._id,
    prompt: task.prompt,
    agent: 'claude',
  });

  await processTaskJob(job, 'test-token');

  expect(mockRunAgent).not.toHaveBeenCalled();
});

// ---------------------------------------------------------------------------
// Second processTaskJob does NOT re-run succeeded task
// ---------------------------------------------------------------------------

it('second processTaskJob call does NOT re-run an already-succeeded task', async () => {
  mockRunAgent.mockResolvedValue({ success: true, result: 'AI response' });
  const { session, task } = await seedTask();

  const job1 = makeJob({
    type: 'task',
    taskId: task._id,
    sessionId: session._id,
    prompt: task.prompt,
    agent: 'claude',
  });

  await processTaskJob(job1, 'test-token');
  mockRunAgent.mockClear();

  const job2 = makeJob({
    type: 'task',
    taskId: task._id,
    sessionId: session._id,
    prompt: task.prompt,
    agent: 'claude',
  });

  await processTaskJob(job2, 'test-token');

  expect(mockRunAgent).not.toHaveBeenCalled();
});

// ---------------------------------------------------------------------------
// Multiple pending tasks are all processed
// ---------------------------------------------------------------------------

it('multiple pending tasks are all processed individually', async () => {
  mockRunAgent.mockResolvedValue({ success: true, result: 'ok' });
  const { session: s1, task: t1 } = await seedTask();
  const { session: s2, task: t2 } = await seedTask();

  const job1 = makeJob({
    type: 'task',
    taskId: t1._id,
    sessionId: s1._id,
    prompt: t1.prompt,
    agent: 'claude',
  });
  const job2 = makeJob({
    type: 'task',
    taskId: t2._id,
    sessionId: s2._id,
    prompt: t2.prompt,
    agent: 'claude',
  });

  await processTaskJob(job1, 'test-token');
  await processTaskJob(job2, 'test-token');

  const u1 = await taskStore.getTask(t1._id, { populate: false });
  const u2 = await taskStore.getTask(t2._id, { populate: false });
  expect(u1.status).toBe('success');
  expect(u2.status).toBe('success');
  expect(mockRunAgent).toHaveBeenCalledTimes(2);
});
