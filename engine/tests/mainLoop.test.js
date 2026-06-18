import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const mockRunAgent = jest.fn();

jest.unstable_mockModule('../agents/index.js', () => ({
  runAgent: mockRunAgent,
  detectSubtasks: jest.fn(() => null),
}));

let mainLoop, POLL_INTERVAL;
let Task, Session;
let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  ({ mainLoop, POLL_INTERVAL } = await import('../aiEngine.js'));
  ({ default: Task } = await import('../models/Task.js'));
  ({ default: Session } = await import('../models/Session.js'));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  for (const col of Object.values(mongoose.connection.collections)) {
    await col.deleteMany({});
  }
  mockRunAgent.mockReset();
  jest.restoreAllMocks();
});

async function makeTask(overrides = {}, subtasks = []) {
  const session = await Session.create({ directory: '/proj', titre: 'Test' });
  return Task.create({
    sessionId: session._id,
    prompt: 'test prompt',
    agent: 'claude',
    subtasks,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// POLL_INTERVAL constant
// ---------------------------------------------------------------------------

describe('POLL_INTERVAL', () => {
  it('equals 5000 ms', () => {
    expect(POLL_INTERVAL).toBe(5000);
  });
});

// ---------------------------------------------------------------------------
// Empty queue
// ---------------------------------------------------------------------------

describe('mainLoop — no tasks', () => {
  it('resolves without error and does not call runAgent', async () => {
    await expect(mainLoop()).resolves.toBeUndefined();
    expect(mockRunAgent).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Single pending task
// ---------------------------------------------------------------------------

describe('mainLoop — one pending task', () => {
  it('processes the task (calls runAgent)', async () => {
    mockRunAgent.mockResolvedValue({ success: true, result: 'ok' });
    await makeTask({ status: 'pending' });

    await mainLoop();

    expect(mockRunAgent).toHaveBeenCalledTimes(1);
  });

  it('task ends in success after mainLoop', async () => {
    mockRunAgent.mockResolvedValue({ success: true, result: 'ok' });
    const task = await makeTask({ status: 'pending' });

    await mainLoop();

    const updated = await Task.findById(task._id);
    expect(updated.status).toBe('success');
  });
});

// ---------------------------------------------------------------------------
// Single running task with no subtasks
// ---------------------------------------------------------------------------

describe('mainLoop — one running task, no subtasks', () => {
  it('does not call runAgent (mainLoop skips processTask for running tasks)', async () => {
    await makeTask({ status: 'running' });

    await mainLoop();

    expect(mockRunAgent).not.toHaveBeenCalled();
  });

  it('task status remains running', async () => {
    const task = await makeTask({ status: 'running' });

    await mainLoop();

    const updated = await Task.findById(task._id);
    expect(updated.status).toBe('running');
  });
});

// ---------------------------------------------------------------------------
// Pending task with a pending subtask
// ---------------------------------------------------------------------------

describe('mainLoop — pending task with pending subtask', () => {
  it('calls runAgent twice (once for task, once for subtask)', async () => {
    mockRunAgent.mockResolvedValue({ success: true, result: 'done' });
    await makeTask({ status: 'pending' }, [{ prompt: 'subtask prompt' }]);

    await mainLoop();

    expect(mockRunAgent).toHaveBeenCalledTimes(2);
  });

  it('both task and subtask reach success', async () => {
    mockRunAgent.mockResolvedValue({ success: true, result: 'done' });
    const task = await makeTask({ status: 'pending' }, [{ prompt: 'subtask prompt' }]);

    await mainLoop();

    const updated = await Task.findById(task._id);
    expect(updated.status).toBe('success');
    expect(updated.subtasks[0].status).toBe('success');
  });
});

// ---------------------------------------------------------------------------
// Running task with a pending subtask
// ---------------------------------------------------------------------------

describe('mainLoop — running task with pending subtask', () => {
  it('calls runAgent once (subtask only, not main task)', async () => {
    mockRunAgent.mockResolvedValue({ success: true, result: 'done' });
    await makeTask({ status: 'running' }, [{ prompt: 'subtask prompt' }]);

    await mainLoop();

    expect(mockRunAgent).toHaveBeenCalledTimes(1);
  });

  it('subtask reaches success, main task stays running', async () => {
    mockRunAgent.mockResolvedValue({ success: true, result: 'done' });
    const task = await makeTask({ status: 'running' }, [{ prompt: 'subtask prompt' }]);

    await mainLoop();

    const updated = await Task.findById(task._id);
    expect(updated.status).toBe('running');
    expect(updated.subtasks[0].status).toBe('success');
  });
});

// ---------------------------------------------------------------------------
// Error handling — mainLoop swallows DB errors
// ---------------------------------------------------------------------------

describe('mainLoop — error handling', () => {
  it('does not throw when Task.find rejects', async () => {
    jest.spyOn(Task, 'find').mockImplementationOnce(() => {
      throw new Error('DB connection lost');
    });

    await expect(mainLoop()).resolves.toBeUndefined();
  });
});
