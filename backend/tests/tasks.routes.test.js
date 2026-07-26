import { jest } from '@jest/globals';
import RedisMock from 'ioredis-mock';

const redisMock = new RedisMock();

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

jest.unstable_mockModule('../config/redis.js', () => ({
  connectRedis: jest.fn().mockResolvedValue(undefined),
}));

// Dynamic imports AFTER mocks
const { default: request } = await import('supertest');
const { default: app } = await import('../server.js');
const sessionStore = await import('../../shared/redis/sessionStore.js');
const taskStore = await import('../../shared/redis/taskStore.js');

let session; // shared session used across tests

beforeEach(async () => {
  session = await sessionStore.createSession({ directory: '/home/user/proj', titre: 'Test Project' });
});

afterEach(async () => {
  await redisMock.flushall();
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
    await taskStore.createTask({ sessionId: session._id, prompt: 'Task A' });
    await taskStore.createTask({ sessionId: session._id, prompt: 'Task B' });
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(2);
    expect(res.body.total).toBe(2);
    expect(res.body.tasks[0].sessionId).toMatchObject({ directory: '/home/user/proj' });
  });

  it('filters by ?status=pending', async () => {
    await taskStore.createTask({ sessionId: session._id, prompt: 'Pending task' });
    const successTask = await taskStore.createTask({ sessionId: session._id, prompt: 'Success task' });
    await taskStore.updateTask(successTask._id, { status: 'success' });

    const res = await request(app).get('/api/tasks?status=pending');
    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(1);
    expect(res.body.tasks[0].status).toBe('pending');
    expect(res.body.total).toBe(1);
  });

  it('filters by ?status=success', async () => {
    await taskStore.createTask({ sessionId: session._id, prompt: 'A' });
    const b = await taskStore.createTask({ sessionId: session._id, prompt: 'B' });
    await taskStore.updateTask(b._id, { status: 'success' });

    const res = await request(app).get('/api/tasks?status=success');
    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(1);
    expect(res.body.tasks[0].status).toBe('success');
  });

  it('filters by ?directory', async () => {
    const otherSession = await sessionStore.createSession({ directory: '/other/path', titre: 'Other' });
    await taskStore.createTask({ sessionId: session._id, prompt: 'In proj' });
    await taskStore.createTask({ sessionId: otherSession._id, prompt: 'In other' });

    const res = await request(app).get('/api/tasks?directory=/home/user/proj');
    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(1);
    expect(res.body.tasks[0].prompt).toBe('In proj');
  });

  it('returns empty array when directory matches no sessions', async () => {
    await taskStore.createTask({ sessionId: session._id, prompt: 'Some task' });
    const res = await request(app).get('/api/tasks?directory=/no/such/dir');
    expect(res.status).toBe(200);
    expect(res.body.tasks).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it('respects ?limit and total reflects full count', async () => {
    await taskStore.createTask({ sessionId: session._id, prompt: 'T1' });
    await taskStore.createTask({ sessionId: session._id, prompt: 'T2' });
    await taskStore.createTask({ sessionId: session._id, prompt: 'T3' });

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
    // POST returns the raw task (sessionId is the ID string, not populated)
    expect(res.body.task.sessionId).toBe(session._id);
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
    const fakeId = '00000000-0000-0000-0000-000000000000';
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
    const created = await taskStore.createTask({ sessionId: session._id, prompt: 'Find me' });
    const res = await request(app).get(`/api/tasks/${created._id}`);
    expect(res.status).toBe(200);
    expect(res.body.task._id).toBe(created._id);
    expect(res.body.task.sessionId).toMatchObject({ directory: '/home/user/proj', titre: 'Test Project' });
  });

  it('returns 404 for a valid but non-existent UUID', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app).get(`/api/tasks/${fakeId}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Task not found');
  });

  it('returns 400 for an invalid ID format', async () => {
    const res = await request(app).get('/api/tasks/not-a-valid-id');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid ID format');
  });
});

// ---------------------------------------------------------------------------
// PUT /api/tasks/:id
// ---------------------------------------------------------------------------

describe('PUT /api/tasks/:id', () => {
  it('updates status and returns the updated task', async () => {
    const created = await taskStore.createTask({ sessionId: session._id, prompt: 'Update me' });
    const res = await request(app)
      .put(`/api/tasks/${created._id}`)
      .send({ status: 'success' });
    expect(res.status).toBe(200);
    expect(res.body.task.status).toBe('success');
  });

  it('updates prompt and agent', async () => {
    const created = await taskStore.createTask({ sessionId: session._id, prompt: 'Old prompt' });
    const res = await request(app)
      .put(`/api/tasks/${created._id}`)
      .send({ prompt: 'New prompt', agent: 'vibe' });
    expect(res.status).toBe(200);
    expect(res.body.task.prompt).toBe('New prompt');
    expect(res.body.task.agent).toBe('vibe');
  });

  it('does not update subtasks field', async () => {
    const created = await taskStore.createTask({ sessionId: session._id, prompt: 'P' });
    const res = await request(app)
      .put(`/api/tasks/${created._id}`)
      .send({ subtasks: [{ prompt: 'injected' }] });
    expect(res.status).toBe(200);
    expect(res.body.task.subtasks).toHaveLength(0);
  });

  it('returns 404 for a non-existent task', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app).put(`/api/tasks/${fakeId}`).send({ status: 'success' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Task not found');
  });

  it('returns 400 for an invalid ID format', async () => {
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
    const created = await taskStore.createTask({ sessionId: session._id, prompt: 'Delete me' });
    const res = await request(app).delete(`/api/tasks/${created._id}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Task deleted');
    const gone = await taskStore.getTask(created._id);
    expect(gone).toBeNull();
  });

  it('returns 404 for a non-existent task', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app).delete(`/api/tasks/${fakeId}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Task not found');
  });

  it('returns 400 for an invalid ID format', async () => {
    const res = await request(app).delete('/api/tasks/bad-id');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid ID format');
  });
});
