import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Task from '../models/Task.js';
import Session from '../models/Session.js';

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  for (const col of Object.values(mongoose.connection.collections)) {
    await col.deleteMany({});
  }
});

// ---------------------------------------------------------------------------
// Session model
// ---------------------------------------------------------------------------

describe('Session model', () => {
  it('creates successfully with valid data', async () => {
    const s = await Session.create({ directory: '/home/user/proj', titre: 'My Project' });
    expect(s._id).toBeDefined();
    expect(s.directory).toBe('/home/user/proj');
    expect(s.titre).toBe('My Project');
    expect(s.createdAt).toBeDefined();
    expect(s.updatedAt).toBeDefined();
  });

  it('fails validation without directory', async () => {
    await expect(Session.create({ titre: 'No dir' })).rejects.toThrow(/directory/);
  });

  it('fails validation without titre', async () => {
    await expect(Session.create({ directory: '/some/path' })).rejects.toThrow(/titre/);
  });
});

// ---------------------------------------------------------------------------
// Task model
// ---------------------------------------------------------------------------

describe('Task model', () => {
  let sessionId;

  beforeEach(async () => {
    const s = await Session.create({ directory: '/proj', titre: 'Proj' });
    sessionId = s._id;
  });

  it('creates successfully with valid data', async () => {
    const task = await Task.create({ sessionId, prompt: 'Do something' });
    expect(task._id).toBeDefined();
    expect(task.agent).toBe('claude');
    expect(task.status).toBe('pending');
    expect(task.result).toBe('');
    expect(task.executedByAgent).toBe('');
    expect(task.subtasks).toEqual([]);
    expect(task.createdAt).toBeDefined();
    expect(task.updatedAt).toBeDefined();
  });

  it('creates with a subtask', async () => {
    const task = await Task.create({
      sessionId,
      prompt: 'Parent',
      subtasks: [{ prompt: 'Child' }],
    });
    expect(task.subtasks).toHaveLength(1);
    expect(task.subtasks[0].prompt).toBe('Child');
    expect(task.subtasks[0].status).toBe('pending');
    expect(task.subtasks[0].agent).toBe('claude');
    expect(task.subtasks[0]._id).toBeDefined();
    expect(task.subtasks[0].createdAt).toBeDefined();
    expect(task.subtasks[0].updatedAt).toBeDefined();
  });

  it('fails creation without sessionId', async () => {
    await expect(Task.create({ prompt: 'No session' })).rejects.toThrow(/sessionId/);
  });

  it('fails creation without prompt', async () => {
    await expect(Task.create({ sessionId })).rejects.toThrow(/prompt/);
  });

  it('rejects an invalid status enum value', async () => {
    await expect(
      Task.create({ sessionId, prompt: 'Test', status: 'invalid_status' })
    ).rejects.toThrow(/status/);
  });

  it('rejects an invalid agent enum value', async () => {
    await expect(
      Task.create({ sessionId, prompt: 'Test', agent: 'unknown_agent' })
    ).rejects.toThrow(/agent/);
  });
});

// ---------------------------------------------------------------------------
// Subtask defaults
// ---------------------------------------------------------------------------

describe('Subtask defaults', () => {
  let sessionId;

  beforeEach(async () => {
    const s = await Session.create({ directory: '/proj', titre: 'Proj' });
    sessionId = s._id;
  });

  it('defaults status to "pending"', async () => {
    const task = await Task.create({ sessionId, prompt: 'P', subtasks: [{ prompt: 'C' }] });
    expect(task.subtasks[0].status).toBe('pending');
  });

  it('defaults agent to "claude"', async () => {
    const task = await Task.create({ sessionId, prompt: 'P', subtasks: [{ prompt: 'C' }] });
    expect(task.subtasks[0].agent).toBe('claude');
  });

  it('defaults result and executedByAgent to empty string', async () => {
    const task = await Task.create({ sessionId, prompt: 'P', subtasks: [{ prompt: 'C' }] });
    expect(task.subtasks[0].result).toBe('');
    expect(task.subtasks[0].executedByAgent).toBe('');
  });

  it('rejects a subtask with an invalid agent enum', async () => {
    await expect(
      Task.create({ sessionId, prompt: 'P', subtasks: [{ prompt: 'C', agent: 'bad' }] })
    ).rejects.toThrow(/agent/);
  });

  it('rejects a subtask with an invalid status enum', async () => {
    await expect(
      Task.create({ sessionId, prompt: 'P', subtasks: [{ prompt: 'C', status: 'bad' }] })
    ).rejects.toThrow(/status/);
  });
});
