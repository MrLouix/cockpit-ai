import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const mockRunAgent = jest.fn();

jest.unstable_mockModule('../agents/index.js', () => ({
  runAgent: mockRunAgent,
  detectSubtasks: jest.fn(() => null),
}));

let processSubtasks;
let Task;
let Session;
let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  ({ processSubtasks } = await import('../aiEngine.js'));
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

async function makeTask(subtasks = [], taskOverrides = {}) {
  const session = await Session.create({ directory: '/proj', titre: 'Test' });
  return Task.create({
    sessionId: session._id,
    prompt: 'parent prompt',
    agent: 'claude',
    subtasks,
    ...taskOverrides,
  });
}

// ---------------------------------------------------------------------------
// No subtasks
// ---------------------------------------------------------------------------

describe('processSubtasks — no subtasks', () => {
  it('returns without error and does not call runAgent', async () => {
    const task = await makeTask([]);
    await processSubtasks(task);
    expect(mockRunAgent).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Single pending subtask — success
// ---------------------------------------------------------------------------

describe('processSubtasks — single subtask success', () => {
  it('sets subtask status to success', async () => {
    mockRunAgent.mockResolvedValue({ success: true, result: 'agent output' });
    const task = await makeTask([{ prompt: 'subtask prompt' }]);

    await processSubtasks(task);

    const updated = await Task.findById(task._id);
    expect(updated.subtasks[0].status).toBe('success');
  });

  it('persists agent output in subtask.result', async () => {
    mockRunAgent.mockResolvedValue({ success: true, result: 'agent output' });
    const task = await makeTask([{ prompt: 'subtask prompt' }]);

    await processSubtasks(task);

    const updated = await Task.findById(task._id);
    expect(updated.subtasks[0].result).toBe('agent output');
  });

  it('sets executedByAgent on the subtask', async () => {
    mockRunAgent.mockResolvedValue({ success: true, result: 'ok' });
    const task = await makeTask([{ prompt: 'subtask prompt' }]);

    await processSubtasks(task);

    const updated = await Task.findById(task._id);
    expect(updated.subtasks[0].executedByAgent).toBe('claude');
  });
});

// ---------------------------------------------------------------------------
// Single pending subtask — failure
// ---------------------------------------------------------------------------

describe('processSubtasks — single subtask failure', () => {
  it('sets subtask status to failed when runAgent returns success:false', async () => {
    mockRunAgent.mockResolvedValue({ success: false, error: 'err msg' });
    const task = await makeTask([{ prompt: 'subtask prompt' }]);

    await processSubtasks(task);

    const updated = await Task.findById(task._id);
    expect(updated.subtasks[0].status).toBe('failed');
  });

  it('stores error message in subtask.result', async () => {
    mockRunAgent.mockResolvedValue({ success: false, error: 'err msg' });
    const task = await makeTask([{ prompt: 'subtask prompt' }]);

    await processSubtasks(task);

    const updated = await Task.findById(task._id);
    expect(updated.subtasks[0].result).toBe('err msg');
  });
});

// ---------------------------------------------------------------------------
// Terminal statuses are skipped
// ---------------------------------------------------------------------------

describe('processSubtasks — terminal subtask statuses', () => {
  it.each(['skipped', 'success', 'pause', 'failed'])(
    'does not process subtask with status "%s"',
    async (status) => {
      const task = await makeTask([{ prompt: 'subtask', status }]);

      await processSubtasks(task);

      expect(mockRunAgent).not.toHaveBeenCalled();
      const updated = await Task.findById(task._id);
      expect(updated.subtasks[0].status).toBe(status);
    }
  );
});

// ---------------------------------------------------------------------------
// Agent selection
// ---------------------------------------------------------------------------

describe('processSubtasks — agent selection', () => {
  it('uses subtask.agent when set', async () => {
    mockRunAgent.mockResolvedValue({ success: true, result: '' });
    const task = await makeTask([{ prompt: 'sub', agent: 'hermes' }]);

    await processSubtasks(task);

    expect(mockRunAgent).toHaveBeenCalledWith('hermes', 'sub', { workingDirectory: '/proj' });
    const updated = await Task.findById(task._id);
    expect(updated.subtasks[0].executedByAgent).toBe('hermes');
  });

  it('falls back to task.agent when subtask.agent is unset in DB', async () => {
    mockRunAgent.mockResolvedValue({ success: true, result: '' });
    const task = await makeTask([{ prompt: 'sub' }], { agent: 'vibe' });

    // Remove the agent field at the raw DB level to simulate an unset agent
    await Task.collection.updateOne(
      { _id: task._id },
      { $unset: { 'subtasks.0.agent': '' } }
    );
    // Use lean() to bypass Mongoose hydration, which would re-apply schema defaults
    const reloaded = await Task.findById(task._id).lean();

    await processSubtasks(reloaded);

    expect(mockRunAgent).toHaveBeenCalledWith('vibe', 'sub', { workingDirectory: '/proj' });
    const updated = await Task.findById(task._id);
    expect(updated.subtasks[0].executedByAgent).toBe('vibe');
  });
});

// ---------------------------------------------------------------------------
// Multiple subtasks
// ---------------------------------------------------------------------------

describe('processSubtasks — multiple subtasks', () => {
  it('processes both subtasks when both are pending', async () => {
    mockRunAgent.mockResolvedValue({ success: true, result: 'done' });
    const task = await makeTask([
      { prompt: 'first' },
      { prompt: 'second' },
    ]);

    await processSubtasks(task);

    expect(mockRunAgent).toHaveBeenCalledTimes(2);
    const updated = await Task.findById(task._id);
    expect(updated.subtasks[0].status).toBe('success');
    expect(updated.subtasks[1].status).toBe('success');
  });

  it('skips already-success subtask and processes pending one', async () => {
    mockRunAgent.mockResolvedValue({ success: true, result: 'done' });
    const task = await makeTask([
      { prompt: 'first', status: 'success' },
      { prompt: 'second' },
    ]);

    await processSubtasks(task);

    expect(mockRunAgent).toHaveBeenCalledTimes(1);
    expect(mockRunAgent).toHaveBeenCalledWith('claude', 'second', { workingDirectory: '/proj' });
    const updated = await Task.findById(task._id);
    expect(updated.subtasks[0].status).toBe('success');
    expect(updated.subtasks[1].status).toBe('success');
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('processSubtasks — runAgent throws', () => {
  it('sets subtask status to failed when runAgent throws', async () => {
    mockRunAgent.mockRejectedValue(new Error('agent crashed'));
    const task = await makeTask([{ prompt: 'sub' }]);

    await processSubtasks(task);

    const updated = await Task.findById(task._id);
    expect(updated.subtasks[0].status).toBe('failed');
  });

  it('stores err.message in subtask.result', async () => {
    mockRunAgent.mockRejectedValue(new Error('agent crashed'));
    const task = await makeTask([{ prompt: 'sub' }]);

    await processSubtasks(task);

    const updated = await Task.findById(task._id);
    expect(updated.subtasks[0].result).toBe('agent crashed');
  });

  it('sets executedByAgent even when runAgent throws', async () => {
    mockRunAgent.mockRejectedValue(new Error('agent crashed'));
    const task = await makeTask([{ prompt: 'sub' }]);

    await processSubtasks(task);

    const updated = await Task.findById(task._id);
    expect(updated.subtasks[0].executedByAgent).toBe('claude');
  });
});
