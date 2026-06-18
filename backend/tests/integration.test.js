import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { jest } from '@jest/globals';

jest.unstable_mockModule('../config/db.js', () => ({
  connectDB: jest.fn().mockResolvedValue(undefined),
}));

const { default: request } = await import('supertest');
const { default: app } = await import('../server.js');
const { Task } = await import('../models/Task.js');
const { Session } = await import('../models/Session.js');

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
// Full task lifecycle
// ---------------------------------------------------------------------------

describe('Task lifecycle: create → skip → resume → subtask → skip subtask → cascade delete', () => {
  it('completes the full lifecycle correctly', async () => {
    // 1. Create session
    const sessionRes = await request(app)
      .post('/api/sessions')
      .send({ directory: '/home/user/project', titre: 'Integration Project' });
    expect(sessionRes.status).toBe(201);
    const sessionId = sessionRes.body.session._id;
    expect(sessionId).toBeDefined();

    // 2. Create task
    const taskRes = await request(app)
      .post('/api/tasks')
      .send({ sessionId, prompt: 'Implement feature X', agent: 'claude' });
    expect(taskRes.status).toBe(201);
    const taskId = taskRes.body.task._id;
    expect(taskRes.body.task.status).toBe('pending');
    expect(taskRes.body.task.agent).toBe('claude');

    // 3. Skip the task
    const skipRes = await request(app).patch(`/api/tasks/${taskId}/skip`);
    expect(skipRes.status).toBe(200);
    expect(skipRes.body.task.status).toBe('skipped');

    // Trying to skip again must fail
    const doubleSkipRes = await request(app).patch(`/api/tasks/${taskId}/skip`);
    expect(doubleSkipRes.status).toBe(400);
    expect(doubleSkipRes.body.error).toBe('Task is already skipped');

    // 4. Resume the task
    const resumeRes = await request(app).patch(`/api/tasks/${taskId}/resume`);
    expect(resumeRes.status).toBe(200);
    expect(resumeRes.body.task.status).toBe('pending');

    // Trying to resume a pending task must fail
    const badResumeRes = await request(app).patch(`/api/tasks/${taskId}/resume`);
    expect(badResumeRes.status).toBe(400);

    // 5. Add a subtask
    const subtaskRes = await request(app)
      .post(`/api/tasks/${taskId}/subtasks`)
      .send({ prompt: 'Write unit tests', agent: 'vibe' });
    expect(subtaskRes.status).toBe(201);
    expect(subtaskRes.body.task.subtasks).toHaveLength(1);
    const subtaskId = subtaskRes.body.task.subtasks[0]._id;
    expect(subtaskRes.body.task.subtasks[0].agent).toBe('vibe');
    expect(subtaskRes.body.task.subtasks[0].status).toBe('pending');

    // 6. Skip the subtask
    const skipSubRes = await request(app).patch(
      `/api/tasks/${taskId}/subtasks/${subtaskId}/skip`
    );
    expect(skipSubRes.status).toBe(200);
    expect(skipSubRes.body.task.subtasks[0].status).toBe('skipped');

    // Trying to skip the subtask again must fail
    const doubleSkipSubRes = await request(app).patch(
      `/api/tasks/${taskId}/subtasks/${subtaskId}/skip`
    );
    expect(doubleSkipSubRes.status).toBe(400);
    expect(doubleSkipSubRes.body.error).toBe('Subtask is already skipped');

    // 7. Resume the subtask
    const resumeSubRes = await request(app).patch(
      `/api/tasks/${taskId}/subtasks/${subtaskId}/resume`
    );
    expect(resumeSubRes.status).toBe(200);
    expect(resumeSubRes.body.task.subtasks[0].status).toBe('pending');

    // 8. Delete session — must cascade-delete the task
    const deleteRes = await request(app).delete(`/api/sessions/${sessionId}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.message).toBe('Session and associated tasks deleted');

    // Verify the task was actually removed
    const orphanTask = await Task.findById(taskId);
    expect(orphanTask).toBeNull();

    // Verify the session was removed
    const orphanSession = await Session.findById(sessionId);
    expect(orphanSession).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Filtering integration
// ---------------------------------------------------------------------------

describe('Task filtering', () => {
  it('filters tasks by directory across sessions', async () => {
    const s1 = await Session.create({ directory: '/proj/alpha', titre: 'Alpha' });
    const s2 = await Session.create({ directory: '/proj/beta', titre: 'Beta' });
    await Task.create({ sessionId: s1._id, prompt: 'Alpha task' });
    await Task.create({ sessionId: s2._id, prompt: 'Beta task' });

    const res = await request(app).get('/api/tasks?directory=/proj/alpha');
    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(1);
    expect(res.body.tasks[0].prompt).toBe('Alpha task');
    expect(res.body.total).toBe(1);
  });

  it('filters tasks by status', async () => {
    const s = await Session.create({ directory: '/proj', titre: 'P' });
    await Task.create({ sessionId: s._id, prompt: 'Pending', status: 'pending' });
    await Task.create({ sessionId: s._id, prompt: 'Failed', status: 'failed' });

    const res = await request(app).get('/api/tasks?status=failed');
    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(1);
    expect(res.body.tasks[0].status).toBe('failed');
  });

  it('respects limit while total reflects full count', async () => {
    const s = await Session.create({ directory: '/proj', titre: 'P' });
    await Task.create({ sessionId: s._id, prompt: 'T1' });
    await Task.create({ sessionId: s._id, prompt: 'T2' });
    await Task.create({ sessionId: s._id, prompt: 'T3' });

    const res = await request(app).get('/api/tasks?limit=2');
    expect(res.body.tasks).toHaveLength(2);
    expect(res.body.total).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Error propagation
// ---------------------------------------------------------------------------

describe('Error propagation', () => {
  it('returns 400 for an invalid ObjectId on task GET', async () => {
    const res = await request(app).get('/api/tasks/not-an-id');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid ID format');
  });

  it('returns 400 for an invalid ObjectId on session GET', async () => {
    const res = await request(app).get('/api/sessions/not-an-id');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid ID format');
  });

  it('returns 404 for a valid ObjectId that does not exist', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).get(`/api/tasks/${fakeId}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Task not found');
  });
});
