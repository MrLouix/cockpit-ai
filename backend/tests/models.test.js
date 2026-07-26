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

// Dynamic imports AFTER mocks
const sessionStore = await import('../../shared/redis/sessionStore.js');
const taskStore = await import('../../shared/redis/taskStore.js');

afterEach(async () => {
  await redisMock.flushall();
});

// ---------------------------------------------------------------------------
// Session store
// ---------------------------------------------------------------------------

describe('sessionStore', () => {
  it('creates a session with valid data', async () => {
    const session = await sessionStore.createSession({ directory: '/home/user/project', titre: 'My Project' });
    expect(session._id).toBeDefined();
    expect(session.directory).toBe('/home/user/project');
    expect(session.titre).toBe('My Project');
    expect(session.createdAt).toBeDefined();
    expect(session.updatedAt).toBeDefined();
  });

  it('gets a session by ID', async () => {
    const created = await sessionStore.createSession({ directory: '/proj', titre: 'Test' });
    const found = await sessionStore.getSession(created._id);
    expect(found).not.toBeNull();
    expect(found._id).toBe(created._id);
    expect(found.directory).toBe('/proj');
    expect(found.titre).toBe('Test');
  });

  it('returns null for a non-existent session', async () => {
    const found = await sessionStore.getSession('00000000-0000-0000-0000-000000000000');
    expect(found).toBeNull();
  });

  it('updates a session', async () => {
    const created = await sessionStore.createSession({ directory: '/old', titre: 'Old' });
    const updated = await sessionStore.updateSession(created._id, { titre: 'New Title' });
    expect(updated.titre).toBe('New Title');
    expect(updated.directory).toBe('/old');
  });

  it('returns null when updating a non-existent session', async () => {
    const result = await sessionStore.updateSession('00000000-0000-0000-0000-000000000000', { titre: 'X' });
    expect(result).toBeNull();
  });

  it('deletes a session', async () => {
    const created = await sessionStore.createSession({ directory: '/proj', titre: 'Delete Me' });
    const deleted = await sessionStore.deleteSession(created._id);
    expect(deleted).toBe(true);
    const gone = await sessionStore.getSession(created._id);
    expect(gone).toBeNull();
  });

  it('returns false when deleting a non-existent session', async () => {
    const result = await sessionStore.deleteSession('00000000-0000-0000-0000-000000000000');
    expect(result).toBe(false);
  });

  it('getAllSessions returns sessions sorted by createdAt descending', async () => {
    await sessionStore.createSession({ directory: '/a', titre: 'A' });
    // Small delay to ensure different timestamps for ZSET scores
    await new Promise(r => setTimeout(r, 5));
    await sessionStore.createSession({ directory: '/b', titre: 'B' });
    const all = await sessionStore.getAllSessions();
    expect(all).toHaveLength(2);
    // Most recently created first
    expect(all[0].titre).toBe('B');
    expect(all[1].titre).toBe('A');
  });
});

// ---------------------------------------------------------------------------
// Task store
// ---------------------------------------------------------------------------

describe('taskStore', () => {
  let sessionId;

  beforeEach(async () => {
    const session = await sessionStore.createSession({ directory: '/proj', titre: 'Proj' });
    sessionId = session._id;
  });

  it('creates a task with valid data and inherits defaults', async () => {
    const task = await taskStore.createTask({ sessionId, prompt: 'Do something' });
    expect(task._id).toBeDefined();
    expect(task.agent).toBe('claude');
    expect(task.status).toBe('pending');
    expect(task.result).toBe('');
    expect(task.executedByAgent).toBe('');
    expect(task.createdAt).toBeDefined();
    expect(task.updatedAt).toBeDefined();
  });

  it('gets a task by ID', async () => {
    const created = await taskStore.createTask({ sessionId, prompt: 'Find me' });
    const found = await taskStore.getTask(created._id);
    expect(found).not.toBeNull();
    expect(found._id).toBe(created._id);
    expect(found.prompt).toBe('Find me');
  });

  it('returns null for a non-existent task', async () => {
    const found = await taskStore.getTask('00000000-0000-0000-0000-000000000000');
    expect(found).toBeNull();
  });

  it('updates a task', async () => {
    const created = await taskStore.createTask({ sessionId, prompt: 'Update me' });
    const updated = await taskStore.updateTask(created._id, { status: 'success' });
    expect(updated.status).toBe('success');
  });

  it('returns null when updating a non-existent task', async () => {
    const result = await taskStore.updateTask('00000000-0000-0000-0000-000000000000', { status: 'success' });
    expect(result).toBeNull();
  });

  it('deletes a task', async () => {
    const created = await taskStore.createTask({ sessionId, prompt: 'Delete me' });
    const deleted = await taskStore.deleteTask(created._id);
    expect(deleted).toBe(true);
    const gone = await taskStore.getTask(created._id);
    expect(gone).toBeNull();
  });

  it('returns false when deleting a non-existent task', async () => {
    const result = await taskStore.deleteTask('00000000-0000-0000-0000-000000000000');
    expect(result).toBe(false);
  });

  it('adds a subtask to a task', async () => {
    const task = await taskStore.createTask({ sessionId, prompt: 'Parent' });
    const subtask = await taskStore.addSubtask(task._id, { prompt: 'Sub task one' });
    expect(subtask._id).toBeDefined();
    expect(subtask.prompt).toBe('Sub task one');
    expect(subtask.status).toBe('pending');
    expect(subtask.agent).toBe('claude');
    expect(subtask.result).toBe('');
    expect(subtask.executedByAgent).toBe('');
    expect(subtask.createdAt).toBeDefined();
    expect(subtask.updatedAt).toBeDefined();

    // Verify the subtask is embedded when getting the task
    const fetched = await taskStore.getTask(task._id);
    expect(fetched.subtasks).toHaveLength(1);
    expect(fetched.subtasks[0].prompt).toBe('Sub task one');
  });

  it('creates a task with a custom agent', async () => {
    const task = await taskStore.createTask({ sessionId, prompt: 'Vibe task', agent: 'vibe' });
    expect(task.agent).toBe('vibe');
  });
});
