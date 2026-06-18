import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { jest } from '@jest/globals';

jest.unstable_mockModule('../config/db.js', () => ({
  connectDB: jest.fn().mockResolvedValue(undefined),
}));

const { default: request } = await import('supertest');
const { default: app } = await import('../server.js');
const { Session } = await import('../models/Session.js');
const { Task } = await import('../models/Task.js');

let mongod;
let session; // shared session used across tests

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  // Fresh session for each test
  session = await Session.create({ directory: '/home/user/proj', titre: 'Test Project' });
});

afterEach(async () => {
  for (const col of Object.values(mongoose.connection.collections)) {
    await col.deleteMany({});
  }
});

// ---------------------------------------------------------------------------
// GET /api/tasks
// ---------------------------------------------------------------------------

describe('GET /api/tasks', () => {
  it('returns 200 with empty tasks array and total 0', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(200);
    expect(res.body.tasks).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it('returns all tasks with populated sessionId', async () => {
    await Task.create({ sessionId: session._id, prompt: 'Task A' });
    await Task.create({ sessionId: session._id, prompt: 'Task B' });
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(2);
    expect(res.body.total).toBe(2);
    expect(res.body.tasks[0].sessionId).toMatchObject({ directory: '/home/user/proj' });
  });

  it('filters by ?status=pending', async () => {
    await Task.create({ sessionId: session._id, prompt: 'Pending task', status: 'pending' });
    await Task.create({ sessionId: session._id, prompt: 'Success task', status: 'success' });
    const res = await request(app).get('/api/tasks?status=pending');
    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(1);
    expect(res.body.tasks[0].status).toBe('pending');
    expect(res.body.total).toBe(1);
  });

  it('filters by ?status=success', async () => {
    await Task.create({ sessionId: session._id, prompt: 'A', status: 'pending' });
    await Task.create({ sessionId: session._id, prompt: 'B', status: 'success' });
    const res = await request(app).get('/api/tasks?status=success');
    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(1);
    expect(res.body.tasks[0].status).toBe('success');
  });

  it('filters by ?directory', async () => {
    const otherSession = await Session.create({ directory: '/other/path', titre: 'Other' });
    await Task.create({ sessionId: session._id, prompt: 'In proj' });
    await Task.create({ sessionId: otherSession._id, prompt: 'In other' });

    const res = await request(app).get('/api/tasks?directory=/home/user/proj');
    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(1);
    expect(res.body.tasks[0].prompt).toBe('In proj');
  });

  it('returns empty array when directory matches no sessions', async () => {
    await Task.create({ sessionId: session._id, prompt: 'Some task' });
    const res = await request(app).get('/api/tasks?directory=/no/such/dir');
    expect(res.status).toBe(200);
    expect(res.body.tasks).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it('respects ?limit and total reflects full count', async () => {
    await Task.create({ sessionId: session._id, prompt: 'T1' });
    await Task.create({ sessionId: session._id, prompt: 'T2' });
    await Task.create({ sessionId: session._id, prompt: 'T3' });

    const res = await request(app).get('/api/tasks?limit=2');
    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(2);
    expect(res.body.total).toBe(3); // total ignores the limit
  });
});

// ---------------------------------------------------------------------------
// POST /api/tasks
// ---------------------------------------------------------------------------

describe('POST /api/tasks', () => {
  it('creates a task and returns 201 with { task }', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ sessionId: session._id, prompt: 'Do something' });
    expect(res.status).toBe(201);
    expect(res.body.task).toBeDefined();
    expect(res.body.task.prompt).toBe('Do something');
    expect(res.body.task.agent).toBe('claude');
    expect(res.body.task.status).toBe('pending');
  });

  it('creates task with a custom agent', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ sessionId: session._id, prompt: 'Use vibe', agent: 'vibe' });
    expect(res.status).toBe(201);
    expect(res.body.task.agent).toBe('vibe');
  });

  it('returns 400 when prompt is missing', async () => {
    const res = await request(app).post('/api/tasks').send({ sessionId: session._id });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/sessionId and prompt are required/);
  });

  it('returns 400 when sessionId is missing', async () => {
    const res = await request(app).post('/api/tasks').send({ prompt: 'No session' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/sessionId and prompt are required/);
  });

  it('returns 404 when sessionId does not exist', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .post('/api/tasks')
      .send({ sessionId: fakeId, prompt: 'Ghost session' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Session not found');
  });
});

// ---------------------------------------------------------------------------
// GET /api/tasks/:id
// ---------------------------------------------------------------------------

describe('GET /api/tasks/:id', () => {
  it('returns 200 with { task } and populated sessionId', async () => {
    const created = await Task.create({ sessionId: session._id, prompt: 'Find me' });
    const res = await request(app).get(`/api/tasks/${created._id}`);
    expect(res.status).toBe(200);
    expect(res.body.task._id).toBe(created._id.toString());
    expect(res.body.task.sessionId).toMatchObject({ directory: '/home/user/proj', titre: 'Test Project' });
  });

  it('returns 404 for a valid but non-existent ObjectId', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).get(`/api/tasks/${fakeId}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Task not found');
  });

  it('returns 400 for an invalid ObjectId (CastError)', async () => {
    const res = await request(app).get('/api/tasks/not-an-id');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid ID format');
  });
});

// ---------------------------------------------------------------------------
// PUT /api/tasks/:id
// ---------------------------------------------------------------------------

describe('PUT /api/tasks/:id', () => {
  it('updates status and returns the updated task', async () => {
    const created = await Task.create({ sessionId: session._id, prompt: 'Update me' });
    const res = await request(app)
      .put(`/api/tasks/${created._id}`)
      .send({ status: 'success' });
    expect(res.status).toBe(200);
    expect(res.body.task.status).toBe('success');
  });

  it('updates prompt and agent', async () => {
    const created = await Task.create({ sessionId: session._id, prompt: 'Old prompt' });
    const res = await request(app)
      .put(`/api/tasks/${created._id}`)
      .send({ prompt: 'New prompt', agent: 'vibe' });
    expect(res.status).toBe(200);
    expect(res.body.task.prompt).toBe('New prompt');
    expect(res.body.task.agent).toBe('vibe');
  });

  it('does not update subtasks field', async () => {
    const created = await Task.create({ sessionId: session._id, prompt: 'P' });
    const res = await request(app)
      .put(`/api/tasks/${created._id}`)
      .send({ subtasks: [{ prompt: 'injected' }] });
    expect(res.status).toBe(200);
    expect(res.body.task.subtasks).toHaveLength(0);
  });

  it('returns 400 for invalid status enum', async () => {
    const created = await Task.create({ sessionId: session._id, prompt: 'P' });
    const res = await request(app)
      .put(`/api/tasks/${created._id}`)
      .send({ status: 'not_valid' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for a non-existent task', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).put(`/api/tasks/${fakeId}`).send({ status: 'success' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Task not found');
  });

  it('returns 400 for an invalid ObjectId', async () => {
    const res = await request(app).put('/api/tasks/bad-id').send({ status: 'success' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid ID format');
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/tasks/:id
// ---------------------------------------------------------------------------

describe('DELETE /api/tasks/:id', () => {
  it('returns 200 and removes the task', async () => {
    const created = await Task.create({ sessionId: session._id, prompt: 'Delete me' });
    const res = await request(app).delete(`/api/tasks/${created._id}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Task deleted');
    const gone = await Task.findById(created._id);
    expect(gone).toBeNull();
  });

  it('returns 404 for a non-existent task', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).delete(`/api/tasks/${fakeId}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Task not found');
  });

  it('returns 400 for an invalid ObjectId', async () => {
    const res = await request(app).delete('/api/tasks/bad-id');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid ID format');
  });
});
