import { jest } from '@jest/globals';
import RedisMock from 'ioredis-mock';

const redisMock = new RedisMock();

jest.unstable_mockModule('../../shared/redis/client.js', () => ({
  getRedis: () => redisMock,
  closeRedis: jest.fn(),
  resetRedis: jest.fn(),
}));

// Dynamic imports AFTER mocks
const sessionStore = await import('../../shared/redis/sessionStore.js');
const taskStore = await import('../../shared/redis/taskStore.js');

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

afterEach(async () => {
  await redisMock.flushall();
});

// ---------------------------------------------------------------------------
// Session store
// ---------------------------------------------------------------------------

describe('Session store', () => {
  it('creates a session with valid data', async () => {
    const s = await sessionStore.createSession({ directory: '/home/user/proj', titre: 'My Project' });
    expect(s._id).toBeDefined();
    expect(s.directory).toBe('/home/user/proj');
    expect(s.titre).toBe('My Project');
    expect(s.createdAt).toBeDefined();
    expect(s.updatedAt).toBeDefined();
  });

  it('generates a UUID for _id', async () => {
    const s = await sessionStore.createSession({ directory: '/proj', titre: 'Test' });
    // UUID v4 pattern
    expect(s._id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('getSession returns the created session', async () => {
    const s = await sessionStore.createSession({ directory: '/proj', titre: 'Test' });
    const fetched = await sessionStore.getSession(s._id);
    expect(fetched).not.toBeNull();
    expect(fetched._id).toBe(s._id);
    expect(fetched.directory).toBe('/proj');
    expect(fetched.titre).toBe('Test');
  });

  it('getSession returns null for non-existent ID', async () => {
    const fetched = await sessionStore.getSession('non-existent');
    expect(fetched).toBeNull();
  });

  it('getAllSessions returns all sessions', async () => {
    await sessionStore.createSession({ directory: '/proj1', titre: 'A' });
    await sessionStore.createSession({ directory: '/proj2', titre: 'B' });

    const all = await sessionStore.getAllSessions();
    expect(all).toHaveLength(2);
  });

  it('getAllSessions returns sessions sorted by creation (most recent first)', async () => {
    const s1 = await sessionStore.createSession({ directory: '/proj1', titre: 'Older' });
    const s2 = await sessionStore.createSession({ directory: '/proj2', titre: 'Newer' });

    const all = await sessionStore.getAllSessions();
    expect(all[0]._id).toBe(s2._id);
    expect(all[1]._id).toBe(s1._id);
  });

  it('updateSession updates fields', async () => {
    const s = await sessionStore.createSession({ directory: '/proj', titre: 'Old Title' });
    const updated = await sessionStore.updateSession(s._id, { titre: 'New Title' });

    expect(updated.titre).toBe('New Title');
    expect(updated.directory).toBe('/proj');
  });

  it('updateSession returns null for non-existent session', async () => {
    const result = await sessionStore.updateSession('non-existent', { titre: 'X' });
    expect(result).toBeNull();
  });

  it('deleteSession removes the session', async () => {
    const s = await sessionStore.createSession({ directory: '/proj', titre: 'Test' });
    const result = await sessionStore.deleteSession(s._id);
    expect(result).toBe(true);

    const fetched = await sessionStore.getSession(s._id);
    expect(fetched).toBeNull();
  });

  it('deleteSession returns false for non-existent session', async () => {
    const result = await sessionStore.deleteSession('non-existent');
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Task store
// ---------------------------------------------------------------------------

describe('Task store', () => {
  let sessionId;

  beforeEach(async () => {
    const s = await sessionStore.createSession({ directory: '/proj', titre: 'Proj' });
    sessionId = s._id;
  });

  it('creates a task with valid data and correct defaults', async () => {
    const task = await taskStore.createTask({ sessionId, prompt: 'Do something' });
    expect(task._id).toBeDefined();
    expect(task._id).toMatch(/^[0-9a-f]{8}-/);
    expect(task.agent).toBe('claude');
    expect(task.status).toBe('pending');
    expect(task.result).toBe('');
    expect(task.executedByAgent).toBe('');
    expect(task.createdAt).toBeDefined();
    expect(task.updatedAt).toBeDefined();
  });

  it('getTask returns the created task with subtasks array', async () => {
    const task = await taskStore.createTask({ sessionId, prompt: 'Do something' });
    const fetched = await taskStore.getTask(task._id, { populate: false });
    expect(fetched).not.toBeNull();
    expect(fetched._id).toBe(task._id);
    expect(fetched.prompt).toBe('Do something');
    expect(fetched.subtasks).toEqual([]);
  });

  it('getTask returns null for non-existent ID', async () => {
    const fetched = await taskStore.getTask('non-existent', { populate: false });
    expect(fetched).toBeNull();
  });

  it('updateTask updates fields and returns updated task', async () => {
    const task = await taskStore.createTask({ sessionId, prompt: 'Test' });
    const updated = await taskStore.updateTask(task._id, { status: 'running' });

    expect(updated.status).toBe('running');
  });

  it('updateTask transitions status indexes correctly', async () => {
    const task = await taskStore.createTask({ sessionId, prompt: 'Test' });
    expect(task.status).toBe('pending');

    await taskStore.updateTask(task._id, { status: 'running' });
    await taskStore.updateTask(task._id, { status: 'success' });

    const updated = await taskStore.getTask(task._id, { populate: false });
    expect(updated.status).toBe('success');
  });

  it('updateTask returns null for non-existent task', async () => {
    const result = await taskStore.updateTask('non-existent', { status: 'running' });
    expect(result).toBeNull();
  });

  it('deleteTask removes the task', async () => {
    const task = await taskStore.createTask({ sessionId, prompt: 'Test' });
    const result = await taskStore.deleteTask(task._id);
    expect(result).toBe(true);

    const fetched = await taskStore.getTask(task._id, { populate: false });
    expect(fetched).toBeNull();
  });

  it('deleteTask returns false for non-existent task', async () => {
    const result = await taskStore.deleteTask('non-existent');
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Subtask store
// ---------------------------------------------------------------------------

describe('Subtask store', () => {
  let sessionId;
  let taskId;

  beforeEach(async () => {
    const s = await sessionStore.createSession({ directory: '/proj', titre: 'Proj' });
    sessionId = s._id;
    const task = await taskStore.createTask({ sessionId, prompt: 'Parent' });
    taskId = task._id;
  });

  it('addSubtask creates a subtask with defaults', async () => {
    const sub = await taskStore.addSubtask(taskId, { prompt: 'Child' });
    expect(sub._id).toBeDefined();
    expect(sub._id).toMatch(/^[0-9a-f]{8}-/);
    expect(sub.prompt).toBe('Child');
    expect(sub.status).toBe('pending');
    expect(sub.agent).toBe('claude');
    expect(sub.result).toBe('');
    expect(sub.executedByAgent).toBe('');
    expect(sub.createdAt).toBeDefined();
    expect(sub.updatedAt).toBeDefined();
  });

  it('getSubtask returns the created subtask', async () => {
    const sub = await taskStore.addSubtask(taskId, { prompt: 'Child' });
    const fetched = await taskStore.getSubtask(taskId, sub._id);
    expect(fetched).not.toBeNull();
    expect(fetched._id).toBe(sub._id);
    expect(fetched.prompt).toBe('Child');
  });

  it('getSubtask returns null for non-existent subtask', async () => {
    const fetched = await taskStore.getSubtask(taskId, 'non-existent');
    expect(fetched).toBeNull();
  });

  it('updateSubtask updates fields', async () => {
    const sub = await taskStore.addSubtask(taskId, { prompt: 'Child' });
    const updated = await taskStore.updateSubtask(taskId, sub._id, {
      status: 'success',
      result: 'done',
      executedByAgent: 'claude',
    });

    expect(updated.status).toBe('success');
    expect(updated.result).toBe('done');
    expect(updated.executedByAgent).toBe('claude');
  });

  it('subtasks appear in parent task via getTask', async () => {
    await taskStore.addSubtask(taskId, { prompt: 'Child 1' });
    await taskStore.addSubtask(taskId, { prompt: 'Child 2' });

    const task = await taskStore.getTask(taskId, { populate: false });
    expect(task.subtasks).toHaveLength(2);
    expect(task.subtasks[0].prompt).toBe('Child 1');
    expect(task.subtasks[1].prompt).toBe('Child 2');
  });

  it('deleteTask also removes subtasks', async () => {
    const sub = await taskStore.addSubtask(taskId, { prompt: 'Child' });
    await taskStore.deleteTask(taskId);

    const fetched = await taskStore.getSubtask(taskId, sub._id);
    expect(fetched).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// maybeFinalizeParent
// ---------------------------------------------------------------------------

describe('maybeFinalizeParent', () => {
  let sessionId;

  beforeEach(async () => {
    const s = await sessionStore.createSession({ directory: '/proj', titre: 'Proj' });
    sessionId = s._id;
  });

  it('finalizes to success when all subtasks are success', async () => {
    const task = await taskStore.createTask({ sessionId, prompt: 'Parent' });
    await taskStore.updateTask(task._id, { status: 'running' });

    const sub1 = await taskStore.addSubtask(task._id, { prompt: 'C1' });
    const sub2 = await taskStore.addSubtask(task._id, { prompt: 'C2' });

    await taskStore.updateSubtask(task._id, sub1._id, { status: 'success' });
    await taskStore.updateSubtask(task._id, sub2._id, { status: 'success' });

    const result = await taskStore.maybeFinalizeParent(task._id);
    expect(result).toBe('success');

    const updated = await taskStore.getTask(task._id, { populate: false });
    expect(updated.status).toBe('success');
  });

  it('finalizes to failed when any subtask is failed', async () => {
    const task = await taskStore.createTask({ sessionId, prompt: 'Parent' });
    await taskStore.updateTask(task._id, { status: 'running' });

    const sub1 = await taskStore.addSubtask(task._id, { prompt: 'C1' });
    const sub2 = await taskStore.addSubtask(task._id, { prompt: 'C2' });

    await taskStore.updateSubtask(task._id, sub1._id, { status: 'success' });
    await taskStore.updateSubtask(task._id, sub2._id, { status: 'failed' });

    const result = await taskStore.maybeFinalizeParent(task._id);
    expect(result).toBe('failed');
  });

  it('returns null when some subtasks are still pending', async () => {
    const task = await taskStore.createTask({ sessionId, prompt: 'Parent' });
    await taskStore.updateTask(task._id, { status: 'running' });

    const sub1 = await taskStore.addSubtask(task._id, { prompt: 'C1' });
    await taskStore.addSubtask(task._id, { prompt: 'C2' });

    await taskStore.updateSubtask(task._id, sub1._id, { status: 'success' });
    // sub2 is still pending

    const result = await taskStore.maybeFinalizeParent(task._id);
    expect(result).toBeNull();
  });

  it('returns null when there are no subtasks', async () => {
    const task = await taskStore.createTask({ sessionId, prompt: 'Parent' });
    const result = await taskStore.maybeFinalizeParent(task._id);
    expect(result).toBeNull();
  });

  it('treats skipped subtasks as success for finalization', async () => {
    const task = await taskStore.createTask({ sessionId, prompt: 'Parent' });
    await taskStore.updateTask(task._id, { status: 'running' });

    const sub1 = await taskStore.addSubtask(task._id, { prompt: 'C1' });
    const sub2 = await taskStore.addSubtask(task._id, { prompt: 'C2' });

    await taskStore.updateSubtask(task._id, sub1._id, { status: 'success' });
    await taskStore.updateSubtask(task._id, sub2._id, { status: 'skipped' });

    const result = await taskStore.maybeFinalizeParent(task._id);
    expect(result).toBe('success');
  });
});
