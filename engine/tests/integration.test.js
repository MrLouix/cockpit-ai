import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const mockRunAgent = jest.fn();

jest.unstable_mockModule('../agents/index.js', () => ({
  runAgent: mockRunAgent,
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
});

async function seedTask(taskOverrides = {}, subtasks = []) {
  const session = await Session.create({ directory: '/proj', titre: 'Integration' });
  return Task.create({
    sessionId: session._id,
    prompt: 'do the thing',
    agent: 'claude',
    subtasks,
    ...taskOverrides,
  });
}

// ---------------------------------------------------------------------------
// Full task lifecycle
// ---------------------------------------------------------------------------

it('pending task reaches success after one mainLoop call', async () => {
  mockRunAgent.mockResolvedValue({ success: true, result: 'AI response' });
  const task = await seedTask({ status: 'pending', agent: 'claude' });

  await mainLoop();

  const updated = await Task.findById(task._id);
  expect(updated.status).toBe('success');
  expect(updated.result).toBe('AI response');
  expect(updated.executedByAgent).toBe('claude');
});

it('second mainLoop call does NOT re-run an already-succeeded task', async () => {
  mockRunAgent.mockResolvedValue({ success: true, result: 'AI response' });
  await seedTask({ status: 'pending' });

  await mainLoop();
  mockRunAgent.mockClear();

  await mainLoop();

  expect(mockRunAgent).not.toHaveBeenCalled();
});

it('task with subtask: both task and subtask complete in one mainLoop', async () => {
  mockRunAgent.mockResolvedValue({ success: true, result: 'done' });
  const task = await seedTask({ status: 'pending' }, [{ prompt: 'child task' }]);

  await mainLoop();

  const updated = await Task.findById(task._id);
  expect(updated.status).toBe('success');
  expect(updated.subtasks[0].status).toBe('success');
  expect(updated.subtasks[0].executedByAgent).toBe('claude');
});

it('skipped task is ignored by mainLoop', async () => {
  await seedTask({ status: 'skipped' });

  await mainLoop();

  expect(mockRunAgent).not.toHaveBeenCalled();
});

it('failed task is ignored by mainLoop', async () => {
  await seedTask({ status: 'failed' });

  await mainLoop();

  expect(mockRunAgent).not.toHaveBeenCalled();
});

it('runAgent failure marks task as failed with the error message', async () => {
  mockRunAgent.mockResolvedValue({ success: false, error: 'tool not found' });
  const task = await seedTask({ status: 'pending' });

  await mainLoop();

  const updated = await Task.findById(task._id);
  expect(updated.status).toBe('failed');
  expect(updated.result).toBe('tool not found');
});

it('multiple pending tasks are all processed in one mainLoop', async () => {
  mockRunAgent.mockResolvedValue({ success: true, result: 'ok' });
  const t1 = await seedTask();
  const t2 = await seedTask();

  await mainLoop();

  const [u1, u2] = await Promise.all([Task.findById(t1._id), Task.findById(t2._id)]);
  expect(u1.status).toBe('success');
  expect(u2.status).toBe('success');
  expect(mockRunAgent).toHaveBeenCalledTimes(2);
});
