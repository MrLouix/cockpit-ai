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
const { processSubtaskJob } = await import('../processor.js');

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

async function seedSubtask(subtaskOverrides = {}, taskOverrides = {}) {
  const session = await sessionStore.createSession({ directory: '/proj', titre: 'Test' });
  const task = await taskStore.createTask({
    sessionId: session._id,
    prompt: 'parent prompt',
    agent: 'claude',
    ...taskOverrides,
  });
  // Mark parent as running (subtask processing happens while parent is running)
  await taskStore.updateTask(task._id, { status: 'running' });

  const subtask = await taskStore.addSubtask(task._id, {
    prompt: 'subtask prompt',
    agent: 'claude',
    ...subtaskOverrides,
  });
  return { session, task, subtask };
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
// Success path
// ---------------------------------------------------------------------------

describe('processSubtaskJob — success', () => {
  it('sets subtask status to success', async () => {
    mockRunAgent.mockResolvedValue({ success: true, result: 'agent output' });
    const { session, task, subtask } = await seedSubtask();
    const job = makeJob({
      type: 'subtask',
      subtaskId: subtask._id,
      taskId: task._id,
      sessionId: session._id,
      prompt: subtask.prompt,
      agent: 'claude',
    });

    await processSubtaskJob(job, 'test-token');

    const updated = await taskStore.getSubtask(task._id, subtask._id);
    expect(updated.status).toBe('success');
  });

  it('persists agent output in subtask result', async () => {
    mockRunAgent.mockResolvedValue({ success: true, result: 'agent output' });
    const { session, task, subtask } = await seedSubtask();
    const job = makeJob({
      type: 'subtask',
      subtaskId: subtask._id,
      taskId: task._id,
      sessionId: session._id,
      prompt: subtask.prompt,
      agent: 'claude',
    });

    await processSubtaskJob(job, 'test-token');

    const updated = await taskStore.getSubtask(task._id, subtask._id);
    expect(updated.result).toBe('agent output');
  });

  it('sets executedByAgent on the subtask', async () => {
    mockRunAgent.mockResolvedValue({ success: true, result: 'ok' });
    const { session, task, subtask } = await seedSubtask();
    const job = makeJob({
      type: 'subtask',
      subtaskId: subtask._id,
      taskId: task._id,
      sessionId: session._id,
      prompt: subtask.prompt,
      agent: 'claude',
    });

    await processSubtaskJob(job, 'test-token');

    const updated = await taskStore.getSubtask(task._id, subtask._id);
    expect(updated.executedByAgent).toBe('claude');
  });
});

// ---------------------------------------------------------------------------
// Failure path
// ---------------------------------------------------------------------------

describe('processSubtaskJob — failure', () => {
  it('sets subtask status to failed when runAgent returns success:false', async () => {
    mockRunAgent.mockResolvedValue({ success: false, error: 'err msg', errorType: 'generic' });
    const { session, task, subtask } = await seedSubtask();
    const job = makeJob({
      type: 'subtask',
      subtaskId: subtask._id,
      taskId: task._id,
      sessionId: session._id,
      prompt: subtask.prompt,
      agent: 'claude',
    });

    await processSubtaskJob(job, 'test-token');

    const updated = await taskStore.getSubtask(task._id, subtask._id);
    expect(updated.status).toBe('failed');
  });

  it('stores error message in subtask result', async () => {
    mockRunAgent.mockResolvedValue({ success: false, error: 'err msg', errorType: 'generic' });
    const { session, task, subtask } = await seedSubtask();
    const job = makeJob({
      type: 'subtask',
      subtaskId: subtask._id,
      taskId: task._id,
      sessionId: session._id,
      prompt: subtask.prompt,
      agent: 'claude',
    });

    await processSubtaskJob(job, 'test-token');

    const updated = await taskStore.getSubtask(task._id, subtask._id);
    expect(updated.result).toBe('err msg');
  });
});

// ---------------------------------------------------------------------------
// Parent finalization
// ---------------------------------------------------------------------------

describe('processSubtaskJob — parent finalization', () => {
  it('finalizes parent to success when all subtasks succeed', async () => {
    mockRunAgent.mockResolvedValue({ success: true, result: 'done' });
    const { session, task, subtask } = await seedSubtask();
    const job = makeJob({
      type: 'subtask',
      subtaskId: subtask._id,
      taskId: task._id,
      sessionId: session._id,
      prompt: subtask.prompt,
      agent: 'claude',
    });

    await processSubtaskJob(job, 'test-token');

    const updatedTask = await taskStore.getTask(task._id, { populate: false });
    expect(updatedTask.status).toBe('success');
  });

  it('finalizes parent to failed when any subtask fails', async () => {
    mockRunAgent.mockResolvedValue({ success: false, error: 'boom', errorType: 'generic' });
    const { session, task, subtask } = await seedSubtask();
    const job = makeJob({
      type: 'subtask',
      subtaskId: subtask._id,
      taskId: task._id,
      sessionId: session._id,
      prompt: subtask.prompt,
      agent: 'claude',
    });

    await processSubtaskJob(job, 'test-token');

    const updatedTask = await taskStore.getTask(task._id, { populate: false });
    expect(updatedTask.status).toBe('failed');
  });

  it('does not finalize parent when some subtasks are still pending', async () => {
    mockRunAgent.mockResolvedValue({ success: true, result: 'done' });
    const session = await sessionStore.createSession({ directory: '/proj', titre: 'Test' });
    const task = await taskStore.createTask({ sessionId: session._id, prompt: 'parent', agent: 'claude' });
    await taskStore.updateTask(task._id, { status: 'running' });

    const sub1 = await taskStore.addSubtask(task._id, { prompt: 'sub1', agent: 'claude' });
    await taskStore.addSubtask(task._id, { prompt: 'sub2', agent: 'claude' });

    const job = makeJob({
      type: 'subtask',
      subtaskId: sub1._id,
      taskId: task._id,
      sessionId: session._id,
      prompt: 'sub1',
      agent: 'claude',
    });

    await processSubtaskJob(job, 'test-token');

    const updatedTask = await taskStore.getTask(task._id, { populate: false });
    // Parent should still be running because sub2 is still pending
    expect(updatedTask.status).toBe('running');
  });
});

// ---------------------------------------------------------------------------
// Agent selection
// ---------------------------------------------------------------------------

describe('processSubtaskJob — agent selection', () => {
  it('uses the subtask agent from the job data', async () => {
    mockRunAgent.mockResolvedValue({ success: true, result: '' });
    const { session, task, subtask } = await seedSubtask({ agent: 'hermes' });
    const job = makeJob({
      type: 'subtask',
      subtaskId: subtask._id,
      taskId: task._id,
      sessionId: session._id,
      prompt: subtask.prompt,
      agent: 'hermes',
    });

    await processSubtaskJob(job, 'test-token');

    expect(mockRunAgent).toHaveBeenCalledWith('hermes', subtask.prompt, { workingDirectory: '/proj' });
    const updated = await taskStore.getSubtask(task._id, subtask._id);
    expect(updated.executedByAgent).toBe('hermes');
  });
});

// ---------------------------------------------------------------------------
// Skip protection
// ---------------------------------------------------------------------------

describe('processSubtaskJob — skip protection', () => {
  it('does not call runAgent when subtask is already skipped', async () => {
    const { session, task, subtask } = await seedSubtask();
    await taskStore.updateSubtask(task._id, subtask._id, { status: 'skipped' });
    const job = makeJob({
      type: 'subtask',
      subtaskId: subtask._id,
      taskId: task._id,
      sessionId: session._id,
      prompt: subtask.prompt,
      agent: 'claude',
    });

    await processSubtaskJob(job, 'test-token');

    expect(mockRunAgent).not.toHaveBeenCalled();
  });
});
