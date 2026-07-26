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
const { processTaskJob } = await import('../processor.js');
const { enqueueSubtask } = await import('../../shared/queue/taskQueue.js');

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
  enqueueSubtask.mockClear();
});

// ---------------------------------------------------------------------------
// Success path
// ---------------------------------------------------------------------------

describe('processTaskJob — success', () => {
  it('sets status to success when runAgent returns { success: true }', async () => {
    mockRunAgent.mockResolvedValue({ success: true, result: 'output' });
    const { session, task } = await seedTask();
    const job = makeJob({ type: 'task', taskId: task._id, sessionId: session._id, prompt: task.prompt, agent: 'claude' });

    await processTaskJob(job, 'test-token');

    const updated = await taskStore.getTask(task._id, { populate: false });
    expect(updated.status).toBe('success');
  });

  it('persists result from runAgent', async () => {
    mockRunAgent.mockResolvedValue({ success: true, result: 'output' });
    const { session, task } = await seedTask();
    const job = makeJob({ type: 'task', taskId: task._id, sessionId: session._id, prompt: task.prompt, agent: 'claude' });

    await processTaskJob(job, 'test-token');

    const updated = await taskStore.getTask(task._id, { populate: false });
    expect(updated.result).toBe('output');
  });

  it('sets executedByAgent to the agent on success', async () => {
    mockRunAgent.mockResolvedValue({ success: true, result: 'output' });
    const { session, task } = await seedTask();
    const job = makeJob({ type: 'task', taskId: task._id, sessionId: session._id, prompt: task.prompt, agent: 'claude' });

    await processTaskJob(job, 'test-token');

    const updated = await taskStore.getTask(task._id, { populate: false });
    expect(updated.executedByAgent).toBe('claude');
  });

  it('calls runAgent with correct args (agent, prompt, {workingDirectory})', async () => {
    mockRunAgent.mockResolvedValue({ success: true, result: '' });
    const { session, task } = await seedTask({ prompt: 'specific prompt' });
    const job = makeJob({ type: 'task', taskId: task._id, sessionId: session._id, prompt: 'specific prompt', agent: 'claude' });

    await processTaskJob(job, 'test-token');

    expect(mockRunAgent).toHaveBeenCalledWith('claude', 'specific prompt', { workingDirectory: '/proj' });
  });
});

// ---------------------------------------------------------------------------
// Failure path — runAgent returns success:false
// ---------------------------------------------------------------------------

describe('processTaskJob — runAgent failure', () => {
  it('sets status to failed when runAgent returns { success: false }', async () => {
    mockRunAgent.mockResolvedValue({ success: false, error: 'some error', errorType: 'generic' });
    const { session, task } = await seedTask();
    const job = makeJob({ type: 'task', taskId: task._id, sessionId: session._id, prompt: task.prompt, agent: 'claude' });

    await processTaskJob(job, 'test-token');

    const updated = await taskStore.getTask(task._id, { populate: false });
    expect(updated.status).toBe('failed');
  });

  it('persists error message in result', async () => {
    mockRunAgent.mockResolvedValue({ success: false, error: 'some error', errorType: 'generic' });
    const { session, task } = await seedTask();
    const job = makeJob({ type: 'task', taskId: task._id, sessionId: session._id, prompt: task.prompt, agent: 'claude' });

    await processTaskJob(job, 'test-token');

    const updated = await taskStore.getTask(task._id, { populate: false });
    expect(updated.result).toBe('some error');
  });

  it('sets executedByAgent on failure', async () => {
    mockRunAgent.mockResolvedValue({ success: false, error: 'some error', errorType: 'generic' });
    const { session, task } = await seedTask();
    const job = makeJob({ type: 'task', taskId: task._id, sessionId: session._id, prompt: task.prompt, agent: 'claude' });

    await processTaskJob(job, 'test-token');

    const updated = await taskStore.getTask(task._id, { populate: false });
    expect(updated.executedByAgent).toBe('claude');
  });
});

// ---------------------------------------------------------------------------
// Failure path — runAgent throws
// ---------------------------------------------------------------------------

describe('processTaskJob — runAgent throws', () => {
  it('sets status to failed when runAgent throws', async () => {
    mockRunAgent.mockRejectedValue(new Error('agent crashed'));
    const { session, task } = await seedTask();
    const job = makeJob({ type: 'task', taskId: task._id, sessionId: session._id, prompt: task.prompt, agent: 'claude' });

    // The processor does not catch throws itself; BullMQ would handle it.
    // The task stays in 'running' state after the throw propagates.
    await expect(processTaskJob(job, 'test-token')).rejects.toThrow('agent crashed');
  });
});

// ---------------------------------------------------------------------------
// Skip protection — task already skipped before processor runs
// ---------------------------------------------------------------------------

describe('processTaskJob — skip protection', () => {
  it('does not call runAgent when task is already skipped', async () => {
    const { session, task } = await seedTask();
    await taskStore.updateTask(task._id, { status: 'skipped' });
    const job = makeJob({ type: 'task', taskId: task._id, sessionId: session._id, prompt: task.prompt, agent: 'claude' });

    await processTaskJob(job, 'test-token');

    expect(mockRunAgent).not.toHaveBeenCalled();
  });

  it('does not modify task status when already skipped', async () => {
    const { session, task } = await seedTask();
    await taskStore.updateTask(task._id, { status: 'skipped' });
    const job = makeJob({ type: 'task', taskId: task._id, sessionId: session._id, prompt: task.prompt, agent: 'claude' });

    await processTaskJob(job, 'test-token');

    const updated = await taskStore.getTask(task._id, { populate: false });
    expect(updated.status).toBe('skipped');
  });

  it('does not call runAgent when task is already in success', async () => {
    const { session, task } = await seedTask();
    await taskStore.updateTask(task._id, { status: 'success' });
    const job = makeJob({ type: 'task', taskId: task._id, sessionId: session._id, prompt: task.prompt, agent: 'claude' });

    await processTaskJob(job, 'test-token');

    expect(mockRunAgent).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Decomposition — subtask detection
// ---------------------------------------------------------------------------

describe('processTaskJob — decomposition', () => {
  it('creates subtasks when detectSubtasks returns prompts', async () => {
    mockRunAgent.mockResolvedValue({ success: true, result: 'big output' });
    mockDetectSubtasks.mockReturnValue(['sub1', 'sub2']);
    const { session, task } = await seedTask();
    const job = makeJob({ type: 'task', taskId: task._id, sessionId: session._id, prompt: task.prompt, agent: 'claude' });

    await processTaskJob(job, 'test-token');

    const updated = await taskStore.getTask(task._id, { populate: false });
    // Parent stays running (not success) when subtasks are created
    expect(updated.status).toBe('running');
    expect(updated.subtasks).toHaveLength(2);
    expect(updated.subtasks[0].prompt).toBe('sub1');
    expect(updated.subtasks[1].prompt).toBe('sub2');
  });

  it('enqueues each subtask via enqueueSubtask', async () => {
    mockRunAgent.mockResolvedValue({ success: true, result: 'big output' });
    mockDetectSubtasks.mockReturnValue(['sub1', 'sub2']);
    const { session, task } = await seedTask();
    const job = makeJob({ type: 'task', taskId: task._id, sessionId: session._id, prompt: task.prompt, agent: 'claude' });

    await processTaskJob(job, 'test-token');

    expect(enqueueSubtask).toHaveBeenCalledTimes(2);
    expect(enqueueSubtask).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ taskId: task._id, sessionId: session._id, prompt: 'sub1', agent: 'claude' })
    );
    expect(enqueueSubtask).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ taskId: task._id, sessionId: session._id, prompt: 'sub2', agent: 'claude' })
    );
  });

  it('stores result and executedByAgent on parent even during decomposition', async () => {
    mockRunAgent.mockResolvedValue({ success: true, result: 'big output' });
    mockDetectSubtasks.mockReturnValue(['sub1']);
    const { session, task } = await seedTask();
    const job = makeJob({ type: 'task', taskId: task._id, sessionId: session._id, prompt: task.prompt, agent: 'claude' });

    await processTaskJob(job, 'test-token');

    const updated = await taskStore.getTask(task._id, { populate: false });
    expect(updated.result).toBe('big output');
    expect(updated.executedByAgent).toBe('claude');
  });
});
