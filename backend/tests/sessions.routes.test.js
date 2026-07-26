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

afterEach(async () => {
  await redisMock.flushall();
});

// ---------------------------------------------------------------------------
// GET /api/sessions
// ---------------------------------------------------------------------------

describe('GET /api/sessions', () => {
  it('returns 200 with empty sessions array when no sessions exist', async () => {
    const res = await request(app).get('/api/sessions');
    expect(res.status).toBe(200);
    expect(res.body.sessions).toEqual([]);
  });

  it('returns all sessions sorted by createdAt descending', async () => {
    await sessionStore.createSession({ directory: '/proj/a', titre: 'A' });
    await sessionStore.createSession({ directory: '/proj/b', titre: 'B' });
    const res = await request(app).get('/api/sessions');
    expect(res.status).toBe(200);
    expect(res.body.sessions).toHaveLength(2);
    // Most recently created comes first
    expect(res.body.sessions[0].titre).toBe('B');
  });
});

// ---------------------------------------------------------------------------
// POST /api/sessions
// ---------------------------------------------------------------------------

describe('POST /api/sessions', () => {
  it('creates a session and returns 201 with { session }', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ directory: '/home/user/proj', titre: 'My Project' });
    expect(res.status).toBe(201);
    expect(res.body.session).toBeDefined();
    expect(res.body.session.directory).toBe('/home/user/proj');
    expect(res.body.session.titre).toBe('My Project');
    expect(res.body.session._id).toBeDefined();
  });

  it('returns 400 when directory is missing', async () => {
    const res = await request(app).post('/api/sessions').send({ titre: 'No Dir' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/directory and titre are required/);
  });

  it('returns 400 when titre is missing', async () => {
    const res = await request(app).post('/api/sessions').send({ directory: '/proj' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/directory and titre are required/);
  });

  it('returns 400 when body is empty', async () => {
    const res = await request(app).post('/api/sessions').send({});
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /api/sessions/:id
// ---------------------------------------------------------------------------

describe('GET /api/sessions/:id', () => {
  it('returns 200 with the session when it exists', async () => {
    const created = await sessionStore.createSession({ directory: '/proj', titre: 'Test' });
    const res = await request(app).get(`/api/sessions/${created._id}`);
    expect(res.status).toBe(200);
    expect(res.body.session._id).toBe(created._id);
    expect(res.body.session.titre).toBe('Test');
  });

  it('returns 404 for a valid but non-existent UUID', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app).get(`/api/sessions/${fakeId}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Session not found');
  });

  it('returns 400 for an invalid ID format', async () => {
    const res = await request(app).get('/api/sessions/not-a-valid-id');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid ID format');
  });
});

// ---------------------------------------------------------------------------
// PUT /api/sessions/:id
// ---------------------------------------------------------------------------

describe('PUT /api/sessions/:id', () => {
  it('updates directory and returns the updated session', async () => {
    const created = await sessionStore.createSession({ directory: '/old', titre: 'Old Title' });
    const res = await request(app)
      .put(`/api/sessions/${created._id}`)
      .send({ directory: '/new' });
    expect(res.status).toBe(200);
    expect(res.body.session.directory).toBe('/new');
    expect(res.body.session.titre).toBe('Old Title');
  });

  it('updates titre and returns the updated session', async () => {
    const created = await sessionStore.createSession({ directory: '/proj', titre: 'Old' });
    const res = await request(app)
      .put(`/api/sessions/${created._id}`)
      .send({ titre: 'New Title' });
    expect(res.status).toBe(200);
    expect(res.body.session.titre).toBe('New Title');
  });

  it('returns 404 for a non-existent session', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app).put(`/api/sessions/${fakeId}`).send({ titre: 'X' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Session not found');
  });

  it('returns 400 for an invalid ID format', async () => {
    const res = await request(app).put('/api/sessions/bad-id').send({ titre: 'X' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid ID format');
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/sessions/:id
// ---------------------------------------------------------------------------

describe('DELETE /api/sessions/:id', () => {
  it('deletes the session and returns success message', async () => {
    const created = await sessionStore.createSession({ directory: '/proj', titre: 'To Delete' });
    const res = await request(app).delete(`/api/sessions/${created._id}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Session and associated tasks deleted');
    const gone = await sessionStore.getSession(created._id);
    expect(gone).toBeNull();
  });

  it('cascades deletion to associated tasks', async () => {
    const session = await sessionStore.createSession({ directory: '/proj', titre: 'Has Tasks' });
    await taskStore.createTask({ sessionId: session._id, prompt: 'Task A' });
    await taskStore.createTask({ sessionId: session._id, prompt: 'Task B' });

    const { total: before } = await taskStore.getTasks({});
    expect(before).toBe(2);

    await request(app).delete(`/api/sessions/${session._id}`);

    const { total: after } = await taskStore.getTasks({});
    expect(after).toBe(0);
  });

  it('returns 404 for a non-existent session', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app).delete(`/api/sessions/${fakeId}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Session not found');
  });

  it('returns 400 for an invalid ID format', async () => {
    const res = await request(app).delete('/api/sessions/bad-id');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid ID format');
  });
});
