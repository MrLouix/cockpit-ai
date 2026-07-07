import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const mockRunAgent = jest.fn();

jest.unstable_mockModule('../agents/index.js', () => ({
  runAgent: mockRunAgent,
  detectSubtasks: jest.fn(() => null),
}));

let mainLoop;
let Task, Session;
let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  ({ mainLoop } = await import('../aiEngine.js'));
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

// ---------------------------------------------------------------------------
// Sequential ordering within a session
// ---------------------------------------------------------------------------

describe('mainLoop — sequential execution within a session', () => {
  it('processes pending tasks in creation order (oldest first)', async () => {
    const session = await Session.create({ directory: '/proj', titre: 'Test' });
    const callOrder = [];
    mockRunAgent.mockImplementation(async (_agent, prompt) => {
      callOrder.push(prompt);
      return { success: true, result: 'ok' };
    });

    await Task.create({ sessionId: session._id, prompt: 'first', agent: 'claude', status: 'pending' });
    await Task.create({ sessionId: session._id, prompt: 'second', agent: 'claude', status: 'pending' });

    await mainLoop();

    expect(callOrder).toEqual(['first', 'second']);
  });

  it('does not start a pending task when its session already has a running task', async () => {
    const session = await Session.create({ directory: '/proj', titre: 'Test' });

    await Task.create({ sessionId: session._id, prompt: 'task1', agent: 'claude', status: 'running' });
    const t2 = await Task.create({ sessionId: session._id, prompt: 'task2', agent: 'claude', status: 'pending' });

    mockRunAgent.mockResolvedValue({ success: true, result: 'ok' });

    await mainLoop();

    const updated = await Task.findById(t2._id);
    expect(updated.status).toBe('pending');
    expect(mockRunAgent).not.toHaveBeenCalled();
  });

  it('tasks from different sessions are all processed in one mainLoop', async () => {
    const s1 = await Session.create({ directory: '/proj1', titre: 'A' });
    const s2 = await Session.create({ directory: '/proj2', titre: 'B' });

    mockRunAgent.mockResolvedValue({ success: true, result: 'ok' });

    const t1 = await Task.create({ sessionId: s1._id, prompt: 'msg-a', agent: 'claude', status: 'pending' });
    const t2 = await Task.create({ sessionId: s2._id, prompt: 'msg-b', agent: 'claude', status: 'pending' });

    await mainLoop();

    const [u1, u2] = await Promise.all([Task.findById(t1._id), Task.findById(t2._id)]);
    expect(u1.status).toBe('success');
    expect(u2.status).toBe('success');
    expect(mockRunAgent).toHaveBeenCalledTimes(2);
  });
});
