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
let session;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  session = await Session.create({ directory: '/proj', titre: 'Proj' });
});

afterEach(async () => {
  for (const col of Object.values(mongoose.connection.collections)) {
    await col.deleteMany({});
  }
});

// ---------------------------------------------------------------------------
// Task skip
// ---------------------------------------------------------------------------

describe('PATCH /api/tasks/:id/skip', () => {
  it('returns 200 and sets task status to skipped', async () => {
    const task = await Task.create({ sessionId: session._id, prompt: 'Skip me' });
    const res = await request(app).patch(`/api/tasks/${task._id}/skip`);
    expect(res.status).toBe(200);
    expect(res.body.task.status).toBe('skipped');
  });

  it('returns 400 when task is already skipped', async () => {
    const task = await Task.create({ sessionId: session._id, prompt: 'Already skipped', status: 'skipped' });
    const res = await request(app).patch(`/api/tasks/${task._id}/skip`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Task is already skipped');
  });

  it('returns 404 for a non-existent task', async () => {
    const res = await request(app).patch(`/api/tasks/${new mongoose.Types.ObjectId()}/skip`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Task not found');
  });
});

// ---------------------------------------------------------------------------
// Task resume
// ---------------------------------------------------------------------------

describe('PATCH /api/tasks/:id/resume', () => {
  it('returns 200 and sets status to pending when task is skipped', async () => {
    const task = await Task.create({ sessionId: session._id, prompt: 'Resume me', status: 'skipped' });
    const res = await request(app).patch(`/api/tasks/${task._id}/resume`);
    expect(res.status).toBe(200);
    expect(res.body.task.status).toBe('pending');
  });

  it('returns 200 and sets status to pending when task is paused', async () => {
    const task = await Task.create({ sessionId: session._id, prompt: 'Paused', status: 'pause' });
    const res = await request(app).patch(`/api/tasks/${task._id}/resume`);
    expect(res.status).toBe(200);
    expect(res.body.task.status).toBe('pending');
  });

  it('returns 400 when task is pending (not resumable)', async () => {
    const task = await Task.create({ sessionId: session._id, prompt: 'Pending task', status: 'pending' });
    const res = await request(app).patch(`/api/tasks/${task._id}/resume`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Task cannot be resumed from its current status');
  });

  it('returns 400 when task is running (not resumable)', async () => {
    const task = await Task.create({ sessionId: session._id, prompt: 'Running', status: 'running' });
    const res = await request(app).patch(`/api/tasks/${task._id}/resume`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Task cannot be resumed from its current status');
  });

  it('returns 400 when task is success (not resumable)', async () => {
    const task = await Task.create({ sessionId: session._id, prompt: 'Done', status: 'success' });
    const res = await request(app).patch(`/api/tasks/${task._id}/resume`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Task cannot be resumed from its current status');
  });

  it('returns 404 for a non-existent task', async () => {
    const res = await request(app).patch(`/api/tasks/${new mongoose.Types.ObjectId()}/resume`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Task not found');
  });
});

// ---------------------------------------------------------------------------
// POST /api/tasks/:id/subtasks
// ---------------------------------------------------------------------------

describe('POST /api/tasks/:id/subtasks', () => {
  it('creates a subtask and returns 201 with the updated task', async () => {
    const task = await Task.create({ sessionId: session._id, prompt: 'Parent' });
    const res = await request(app)
      .post(`/api/tasks/${task._id}/subtasks`)
      .send({ prompt: 'Child task' });
    expect(res.status).toBe(201);
    expect(res.body.task.subtasks).toHaveLength(1);
    expect(res.body.task.subtasks[0].prompt).toBe('Child task');
    expect(res.body.task.subtasks[0].agent).toBe('claude');
    expect(res.body.task.subtasks[0].status).toBe('pending');
  });

  it('creates a subtask with a custom agent', async () => {
    const task = await Task.create({ sessionId: session._id, prompt: 'Parent' });
    const res = await request(app)
      .post(`/api/tasks/${task._id}/subtasks`)
      .send({ prompt: 'Use vibe', agent: 'vibe' });
    expect(res.status).toBe(201);
    expect(res.body.task.subtasks[0].agent).toBe('vibe');
  });

  it('returns 400 when prompt is missing', async () => {
    const task = await Task.create({ sessionId: session._id, prompt: 'Parent' });
    const res = await request(app)
      .post(`/api/tasks/${task._id}/subtasks`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('prompt is required');
  });

  it('returns 404 for a non-existent task', async () => {
    const res = await request(app)
      .post(`/api/tasks/${new mongoose.Types.ObjectId()}/subtasks`)
      .send({ prompt: 'Ghost' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Task not found');
  });
});

// ---------------------------------------------------------------------------
// Subtask skip
// ---------------------------------------------------------------------------

describe('PATCH /api/tasks/:id/subtasks/:subtaskId/skip', () => {
  it('skips a subtask and returns 200 with updated task', async () => {
    const task = await Task.create({
      sessionId: session._id,
      prompt: 'Parent',
      subtasks: [{ prompt: 'Child' }],
    });
    const subtaskId = task.subtasks[0]._id;
    const res = await request(app).patch(`/api/tasks/${task._id}/subtasks/${subtaskId}/skip`);
    expect(res.status).toBe(200);
    expect(res.body.task.subtasks[0].status).toBe('skipped');
  });

  it('returns 400 when subtask is already skipped', async () => {
    const task = await Task.create({
      sessionId: session._id,
      prompt: 'Parent',
      subtasks: [{ prompt: 'Child', status: 'skipped' }],
    });
    const subtaskId = task.subtasks[0]._id;
    const res = await request(app).patch(`/api/tasks/${task._id}/subtasks/${subtaskId}/skip`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Subtask is already skipped');
  });

  it('returns 404 for a non-existent subtask ID', async () => {
    const task = await Task.create({ sessionId: session._id, prompt: 'Parent' });
    const fakeSubtaskId = new mongoose.Types.ObjectId();
    const res = await request(app).patch(`/api/tasks/${task._id}/subtasks/${fakeSubtaskId}/skip`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Subtask not found');
  });

  it('returns 404 when the parent task does not exist', async () => {
    const res = await request(app).patch(
      `/api/tasks/${new mongoose.Types.ObjectId()}/subtasks/${new mongoose.Types.ObjectId()}/skip`
    );
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Task not found');
  });
});

// ---------------------------------------------------------------------------
// Subtask resume
// ---------------------------------------------------------------------------

describe('PATCH /api/tasks/:id/subtasks/:subtaskId/resume', () => {
  it('resumes a skipped subtask and sets status to pending', async () => {
    const task = await Task.create({
      sessionId: session._id,
      prompt: 'Parent',
      subtasks: [{ prompt: 'Child', status: 'skipped' }],
    });
    const subtaskId = task.subtasks[0]._id;
    const res = await request(app).patch(`/api/tasks/${task._id}/subtasks/${subtaskId}/resume`);
    expect(res.status).toBe(200);
    expect(res.body.task.subtasks[0].status).toBe('pending');
  });

  it('resumes a paused subtask and sets status to pending', async () => {
    const task = await Task.create({
      sessionId: session._id,
      prompt: 'Parent',
      subtasks: [{ prompt: 'Child', status: 'pause' }],
    });
    const subtaskId = task.subtasks[0]._id;
    const res = await request(app).patch(`/api/tasks/${task._id}/subtasks/${subtaskId}/resume`);
    expect(res.status).toBe(200);
    expect(res.body.task.subtasks[0].status).toBe('pending');
  });

  it('returns 400 when subtask is pending (not resumable)', async () => {
    const task = await Task.create({
      sessionId: session._id,
      prompt: 'Parent',
      subtasks: [{ prompt: 'Child', status: 'pending' }],
    });
    const subtaskId = task.subtasks[0]._id;
    const res = await request(app).patch(`/api/tasks/${task._id}/subtasks/${subtaskId}/resume`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Subtask cannot be resumed from its current status');
  });

  it('returns 400 when subtask is success (not resumable)', async () => {
    const task = await Task.create({
      sessionId: session._id,
      prompt: 'Parent',
      subtasks: [{ prompt: 'Child', status: 'success' }],
    });
    const subtaskId = task.subtasks[0]._id;
    const res = await request(app).patch(`/api/tasks/${task._id}/subtasks/${subtaskId}/resume`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Subtask cannot be resumed from its current status');
  });

  it('returns 404 for a non-existent subtask ID', async () => {
    const task = await Task.create({ sessionId: session._id, prompt: 'Parent' });
    const fakeSubtaskId = new mongoose.Types.ObjectId();
    const res = await request(app).patch(`/api/tasks/${task._id}/subtasks/${fakeSubtaskId}/resume`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Subtask not found');
  });
});
