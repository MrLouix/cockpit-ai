import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const mockRunAgent = jest.fn();

jest.unstable_mockModule('../agents/index.js', () => ({
  runAgent: mockRunAgent,
  detectSubtasks: jest.fn(() => null),
}));

let processTask;
let Task;
let Session;
let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  ({ processTask } = await import('../aiEngine.js'));
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
});

async function makeTask(overrides = {}) {
  const session = await Session.create({ directory: '/proj', titre: 'Test' });
  return Task.create({ sessionId: session._id, prompt: 'do something', ...overrides });
}

// ---------------------------------------------------------------------------
// Success path
// ---------------------------------------------------------------------------

describe('processTask — success', () => {
  it('sets status to success when runAgent returns { success: true }', async () => {
    mockRunAgent.mockResolvedValue({ success: true, result: 'output' });
    const task = await makeTask();

    await processTask(task);

    const updated = await Task.findById(task._id);
    expect(updated.status).toBe('success');
  });

  it('persists result from runAgent', async () => {
    mockRunAgent.mockResolvedValue({ success: true, result: 'output' });
    const task = await makeTask();

    await processTask(task);

    const updated = await Task.findById(task._id);
    expect(updated.result).toBe('output');
  });

  it('sets executedByAgent to task.agent on success', async () => {
    mockRunAgent.mockResolvedValue({ success: true, result: 'output' });
    const task = await makeTask();

    await processTask(task);

    const updated = await Task.findById(task._id);
    expect(updated.executedByAgent).toBe(task.agent);
  });

  it('calls runAgent with task.agent, task.prompt, and workingDirectory', async () => {
    mockRunAgent.mockResolvedValue({ success: true, result: '' });
    const task = await makeTask({ prompt: 'specific prompt', agent: 'claude' });

    await processTask(task);

    expect(mockRunAgent).toHaveBeenCalledWith('claude', 'specific prompt', { workingDirectory: '/proj' });
  });
});

// ---------------------------------------------------------------------------
// Failure path — runAgent returns success:false
// ---------------------------------------------------------------------------

describe('processTask — runAgent failure', () => {
  it('sets status to failed when runAgent returns { success: false }', async () => {
    mockRunAgent.mockResolvedValue({ success: false, error: 'some error' });
    const task = await makeTask();

    await processTask(task);

    const updated = await Task.findById(task._id);
    expect(updated.status).toBe('failed');
  });

  it('persists error message in result', async () => {
    mockRunAgent.mockResolvedValue({ success: false, error: 'some error' });
    const task = await makeTask();

    await processTask(task);

    const updated = await Task.findById(task._id);
    expect(updated.result).toBe('some error');
  });

  it('sets executedByAgent on failure', async () => {
    mockRunAgent.mockResolvedValue({ success: false, error: 'some error' });
    const task = await makeTask();

    await processTask(task);

    const updated = await Task.findById(task._id);
    expect(updated.executedByAgent).toBe(task.agent);
  });
});

// ---------------------------------------------------------------------------
// Failure path — runAgent throws
// ---------------------------------------------------------------------------

describe('processTask — runAgent throws', () => {
  it('sets status to failed when runAgent throws', async () => {
    mockRunAgent.mockRejectedValue(new Error('agent crashed'));
    const task = await makeTask();

    await processTask(task);

    const updated = await Task.findById(task._id);
    expect(updated.status).toBe('failed');
  });

  it('stores err.message in result when runAgent throws', async () => {
    mockRunAgent.mockRejectedValue(new Error('agent crashed'));
    const task = await makeTask();

    await processTask(task);

    const updated = await Task.findById(task._id);
    expect(updated.result).toBe('agent crashed');
  });

  it('sets executedByAgent even when runAgent throws', async () => {
    mockRunAgent.mockRejectedValue(new Error('agent crashed'));
    const task = await makeTask();

    await processTask(task);

    const updated = await Task.findById(task._id);
    expect(updated.executedByAgent).toBe(task.agent);
  });
});

// ---------------------------------------------------------------------------
// Running tasks are still processed
// ---------------------------------------------------------------------------

describe('processTask — running status', () => {
  it('still executes when task.status is running', async () => {
    mockRunAgent.mockResolvedValue({ success: true, result: 'done' });
    const task = await makeTask({ status: 'running' });

    await processTask(task);

    expect(mockRunAgent).toHaveBeenCalled();
    const updated = await Task.findById(task._id);
    expect(updated.status).toBe('success');
  });
});

// ---------------------------------------------------------------------------
// Terminal statuses are skipped
// ---------------------------------------------------------------------------

describe('processTask — terminal statuses (no-op)', () => {
  it.each(['success', 'skipped', 'failed', 'pause'])(
    'returns immediately without calling runAgent for status "%s"',
    async (status) => {
      const task = await makeTask({ status });

      await processTask(task);

      expect(mockRunAgent).not.toHaveBeenCalled();
      const updated = await Task.findById(task._id);
      expect(updated.status).toBe(status);
    }
  );
});
