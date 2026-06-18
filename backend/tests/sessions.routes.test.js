import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { jest } from '@jest/globals';

// Mock connectDB so server.js never touches a real database
jest.unstable_mockModule('../config/db.js', () => ({
  connectDB: jest.fn().mockResolvedValue(undefined),
}));

const { default: request } = await import('supertest');
const { default: app } = await import('../server.js');
const { Session } = await import('../models/Session.js');
const { Task } = await import('../models/Task.js');

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
// GET /api/sessions
// ---------------------------------------------------------------------------

describe('GET /api/sessions', () => {
  it('returns 200 with empty sessions array when no sessions exist', async () => {
    const res = await request(app).get('/api/sessions');
    expect(res.status).toBe(200);
    expect(res.body.sessions).toEqual([]);
  });

  it('returns all sessions sorted by createdAt descending', async () => {
    await Session.create({ directory: '/proj/a', titre: 'A' });
    await Session.create({ directory: '/proj/b', titre: 'B' });
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
    const created = await Session.create({ directory: '/proj', titre: 'Test' });
    const res = await request(app).get(`/api/sessions/${created._id}`);
    expect(res.status).toBe(200);
    expect(res.body.session._id).toBe(created._id.toString());
    expect(res.body.session.titre).toBe('Test');
  });

  it('returns 404 for a valid but non-existent ObjectId', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).get(`/api/sessions/${fakeId}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Session not found');
  });

  it('returns 400 for an invalid ObjectId (CastError)', async () => {
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
    const created = await Session.create({ directory: '/old', titre: 'Old Title' });
    const res = await request(app)
      .put(`/api/sessions/${created._id}`)
      .send({ directory: '/new' });
    expect(res.status).toBe(200);
    expect(res.body.session.directory).toBe('/new');
    expect(res.body.session.titre).toBe('Old Title');
  });

  it('updates titre and returns the updated session', async () => {
    const created = await Session.create({ directory: '/proj', titre: 'Old' });
    const res = await request(app)
      .put(`/api/sessions/${created._id}`)
      .send({ titre: 'New Title' });
    expect(res.status).toBe(200);
    expect(res.body.session.titre).toBe('New Title');
  });

  it('returns 404 for a non-existent session', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).put(`/api/sessions/${fakeId}`).send({ titre: 'X' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Session not found');
  });

  it('returns 400 for an invalid ObjectId', async () => {
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
    const created = await Session.create({ directory: '/proj', titre: 'To Delete' });
    const res = await request(app).delete(`/api/sessions/${created._id}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Session and associated tasks deleted');
    const gone = await Session.findById(created._id);
    expect(gone).toBeNull();
  });

  it('cascades deletion to associated tasks', async () => {
    const session = await Session.create({ directory: '/proj', titre: 'Has Tasks' });
    await Task.create({ sessionId: session._id, prompt: 'Task A' });
    await Task.create({ sessionId: session._id, prompt: 'Task B' });

    const before = await Task.countDocuments({ sessionId: session._id });
    expect(before).toBe(2);

    await request(app).delete(`/api/sessions/${session._id}`);

    const after = await Task.countDocuments({ sessionId: session._id });
    expect(after).toBe(0);
  });

  it('returns 404 for a non-existent session', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).delete(`/api/sessions/${fakeId}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Session not found');
  });

  it('returns 400 for an invalid ObjectId', async () => {
    const res = await request(app).delete('/api/sessions/bad-id');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid ID format');
  });
});
