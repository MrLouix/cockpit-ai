import { Router } from 'express';
import * as sessionStore from '../../shared/redis/sessionStore.js';
import { getTasks, deleteTask } from '../../shared/redis/taskStore.js';
import { removeJob } from '../../shared/queue/taskQueue.js';

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateId(id, res) {
  if (!UUID_RE.test(id)) {
    res.status(400).json({ error: 'Invalid ID format' });
    return false;
  }
  return true;
}

// GET /api/sessions
router.get('/', async (_req, res, next) => {
  try {
    const sessions = await sessionStore.getAllSessions();
    res.json({ sessions });
  } catch (err) {
    next(err);
  }
});

// GET /api/sessions/:id
router.get('/:id', async (req, res, next) => {
  try {
    if (!validateId(req.params.id, res)) return;
    const session = await sessionStore.getSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json({ session });
  } catch (err) {
    next(err);
  }
});

// POST /api/sessions
router.post('/', async (req, res, next) => {
  try {
    const { directory, titre } = req.body;
    if (!directory || !titre) {
      return res.status(400).json({ error: 'directory and titre are required' });
    }
    const session = await sessionStore.createSession({ directory, titre });
    res.status(201).json({ session });
  } catch (err) {
    next(err);
  }
});

// PUT /api/sessions/:id
router.put('/:id', async (req, res, next) => {
  try {
    if (!validateId(req.params.id, res)) return;
    const { directory, titre } = req.body;
    const update = {};
    if (directory !== undefined) update.directory = directory;
    if (titre !== undefined) update.titre = titre;
    const session = await sessionStore.updateSession(req.params.id, update);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json({ session });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/sessions/:id (cascade-deletes associated tasks + BullMQ jobs)
router.delete('/:id', async (req, res, next) => {
  try {
    if (!validateId(req.params.id, res)) return;
    const session = await sessionStore.getSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    // Get tasks to remove their BullMQ jobs before cascade delete
    const { tasks } = await getTasks({ directory: session.directory });
    for (const task of tasks) {
      if (task.sessionId?._id === req.params.id || task.sessionId === req.params.id) {
        await removeJob(task._id).catch(() => {});
        for (const st of task.subtasks || []) {
          await removeJob(st._id).catch(() => {});
        }
      }
    }

    await sessionStore.deleteSession(req.params.id);
    res.json({ message: 'Session and associated tasks deleted' });
  } catch (err) {
    next(err);
  }
});

// GET /api/sessions/:id/tasks
router.get('/:id/tasks', async (req, res, next) => {
  try {
    if (!validateId(req.params.id, res)) return;
    const session = await sessionStore.getSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    // getTasks sorts by createdAt desc; the old endpoint sorted asc.
    // We fetch all and reverse for compatibility.
    const { tasks } = await getTasks({});
    const sessionTasks = tasks
      .filter((t) => {
        const sid = typeof t.sessionId === 'object' ? t.sessionId._id : t.sessionId;
        return sid === req.params.id;
      })
      .reverse(); // oldest first
    res.json({ tasks: sessionTasks });
  } catch (err) {
    next(err);
  }
});

export default router;
