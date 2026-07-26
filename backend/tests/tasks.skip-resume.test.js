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

let session;

beforeEach(async () => {
  session = await sessionStore.createSession({ directory: '/proj', titre: 'Proj' });
});

afterEach(async () => {
  await redisMock.flushall();
});

// ---------------------------------------------------------------------------
// Task skip
// ---------------------------------------------------------------------------

describe('PATCH /api/tasks/:id/skip', () => {
  it('returns 200 and sets task status to skipped', async () => {
    const task = await taskStore.createTask({ sessionId: session._id, prompt: 'Skip me' });
    const res = await request(app).patch(`/api/tasks/${task._id}/skip`);
    expect(res.status).toBe(200);
    expect(res.body.task.status).toBe('skipped');
  });

  it('returns 400 when task is already skipped', async () => {
    const task = await taskStore.createTask({ sessionId: session._id, prompt: 'Already skipped' });
    await taskStore.updateTask(task._id, { status: 'skipped' });
    const res = await request(app).patch(`/api/tasks/${task._id}/skip`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Task is already skipped');
  });

  it('returns 404 for a non-existent task', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app).patch(`/api/tasks/${fakeId}/skip`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Task not found');
  });
});

// ---------------------------------------------------------------------------
// Task resume
// ---------------------------------------------------------------------------

describe('PATCH /api/tasks/:id/resume', () => {
  it('returns 200 and sets status to pending when task is skipped', async () => {
    const task = await taskStore.createTask({ sessionId: session._id, prompt: 'Resume me' });
    await taskStore.updateTask(task._id, { status: 'skipped' });
    const res = await request(app).patch(`/api/tasks/${task._id}/resume`);
    expect(res.status).toBe(200);
    expect(res.body.task.status).toBe('pending');
  });

  it('returns 200 and sets status to pending when task is paused', async () => {
    const task = await taskStore.createTask({ sessionId: session._id, prompt: 'Paused' });
    await taskStore.updateTask(task._id, { status: 'pause' });
    const res = await request(app).patch(`/api/tasks/${task._id}/resume`);
    expect(res.status).toBe(200);
    expect(res.body.task.status).toBe('pending');
  });

  it('returns 400 when task is pending (not resumable)', async () => {
    const task = await taskStore.createTask({ sessionId: session._id, prompt: 'Pending task' });
    const res = await request(app).patch(`/api/tasks/${task._id}/resume`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Task cannot be resumed from its current status');
  });

  it('returns 400 when task is running (not resumable)', async () => {
    const task = await taskStore.createTask({ sessionId: session._id, prompt: 'Running' });
    await taskStore.updateTask(task._id, { status: 'running' });
    const res = await request(app).patch(`/api/tasks/${task._id}/resume`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Task cannot be resumed from its current status');
  });

  it('returns 400 when task is success (not resumable)', async () => {
    const task = await taskStore.createTask({ sessionId: session._id, prompt: 'Done' });
    await taskStore.updateTask(task._id, { status: 'success' });
    const res = await request(app).patch(`/api/tasks/${task._id}/resume`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Task cannot be resumed from its current status');
  });

  it('returns 404 for a non-existent task', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app).patch(`/api/tasks/${fakeId}/resume`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Task not found');
  });
});

// ---------------------------------------------------------------------------
// POST /api/tasks/:id/subtasks
// ---------------------------------------------------------------------------

describe('POST /api/tasks/:id/subtasks', () => {
  it('creates a subtask and returns 201 with the updated task', async () => {
    const task = await taskStore.createTask({ sessionId: session._id, prompt: 'Parent' });
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
    const task = await taskStore.createTask({ sessionId: session._id, prompt: 'Parent' });
    const res = await request(app)
      .post(`/api/tasks/${task._id}/subtasks`)
      .send({ prompt: 'Use vibe', agent: 'vibe' });
    expect(res.status).toBe(201);
    expect(res.body.task.subtasks[0].agent).toBe('vibe');
  });

  it('returns 400 when prompt is missing', async () => {
    const task = await taskStore.createTask({ sessionId: session._id, prompt: 'Parent' });
    const res = await request(app)
      .post(`/api/tasks/${task._id}/subtasks`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('prompt is required');
  });

  it('returns 404 for a non-existent task', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app)
      .post(`/api/tasks/${fakeId}/subtasks`)
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
    const task = await taskStore.createTask({ sessionId: session._id, prompt: 'Parent' });
    const subtask = await taskStore.addSubtask(task._id, { prompt: 'Child' });
    const res = await request(app).patch(`/api/tasks/${task._id}/subtasks/${subtask._id}/skip`);
    expect(res.status).toBe(200);
    expect(res.body.task.subtasks[0].status).toBe('skipped');
  });

  it('returns 400 when subtask is already skipped', async () => {
    const task = await taskStore.createTask({ sessionId: session._id, prompt: 'Parent' });
    const subtask = await taskStore.addSubtask(task._id, { prompt: 'Child' });
    await taskStore.updateSubtask(task._id, subtask._id, { status: 'skipped' });
    const res = await request(app).patch(`/api/tasks/${task._id}/subtasks/${subtask._id}/skip`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Subtask is already skipped');
  });

  it('returns 404 for a non-existent subtask ID', async () => {
    const task = await taskStore.createTask({ sessionId: session._id, prompt: 'Parent' });
    const fakeSubtaskId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app).patch(`/api/tasks/${task._id}/subtasks/${fakeSubtaskId}/skip`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Subtask not found');
  });

  it('returns 404 when the parent task does not exist', async () => {
    const fakeTaskId = '00000000-0000-0000-0000-000000000000';
    const fakeSubtaskId = '11111111-1111-1111-1111-111111111111';
    const res = await request(app).patch(`/api/tasks/${fakeTaskId}/subtasks/${fakeSubtaskId}/skip`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Task not found');
  });
});

// ---------------------------------------------------------------------------
// Subtask resume
// ---------------------------------------------------------------------------

describe('PATCH /api/tasks/:id/subtasks/:subtaskId/resume', () => {
  it('resumes a skipped subtask and sets status to pending', async () => {
    const task = await taskStore.createTask({ sessionId: session._id, prompt: 'Parent' });
    const subtask = await taskStore.addSubtask(task._id, { prompt: 'Child' });
    await taskStore.updateSubtask(task._id, subtask._id, { status: 'skipped' });
    const res = await request(app).patch(`/api/tasks/${task._id}/subtasks/${subtask._id}/resume`);
    expect(res.status).toBe(200);
    expect(res.body.task.subtasks[0].status).toBe('pending');
  });

  it('resumes a paused subtask and sets status to pending', async () => {
    const task = await taskStore.createTask({ sessionId: session._id, prompt: 'Parent' });
    const subtask = await taskStore.addSubtask(task._id, { prompt: 'Child' });
    await taskStore.updateSubtask(task._id, subtask._id, { status: 'pause' });
    const res = await request(app).patch(`/api/tasks/${task._id}/subtasks/${subtask._id}/resume`);
    expect(res.status).toBe(200);
    expect(res.body.task.subtasks[0].status).toBe('pending');
  });

  it('returns 400 when subtask is pending (not resumable)', async () => {
    const task = await taskStore.createTask({ sessionId: session._id, prompt: 'Parent' });
    const subtask = await taskStore.addSubtask(task._id, { prompt: 'Child' });
    const res = await request(app).patch(`/api/tasks/${task._id}/subtasks/${subtask._id}/resume`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Subtask cannot be resumed from its current status');
  });

  it('returns 400 when subtask is success (not resumable)', async () => {
    const task = await taskStore.createTask({ sessionId: session._id, prompt: 'Parent' });
    const subtask = await taskStore.addSubtask(task._id, { prompt: 'Child' });
    await taskStore.updateSubtask(task._id, subtask._id, { status: 'success' });
    const res = await request(app).patch(`/api/tasks/${task._id}/subtasks/${subtask._id}/resume`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Subtask cannot be resumed from its current status');
  });

  it('returns 404 for a non-existent subtask ID', async () => {
    const task = await taskStore.createTask({ sessionId: session._id, prompt: 'Parent' });
    const fakeSubtaskId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app).patch(`/api/tasks/${task._id}/subtasks/${fakeSubtaskId}/resume`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Subtask not found');
  });
});
