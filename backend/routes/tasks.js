import { Router } from 'express';
import * as taskStore from '../../shared/redis/taskStore.js';
import * as sessionStore from '../../shared/redis/sessionStore.js';
import { enqueueTask, enqueueSubtask, removeJob } from '../../shared/queue/taskQueue.js';

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateId(id, res) {
  if (!UUID_RE.test(id)) {
    res.status(400).json({ error: 'Invalid ID format' });
    return false;
  }
  return true;
}

// GET /api/tasks?directory=&status=&limit=
router.get('/', async (req, res, next) => {
  try {
    const { directory, status, limit = '100' } = req.query;
    const limitNum = parseInt(limit, 10) || 100;
    const { tasks, total } = await taskStore.getTasks({ directory, status, limit: limitNum });
    res.json({ tasks, total });
  } catch (err) {
    next(err);
  }
});

// GET /api/tasks/:id
router.get('/:id', async (req, res, next) => {
  try {
    if (!validateId(req.params.id, res)) return;
    const task = await taskStore.getTask(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ task });
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks
router.post('/', async (req, res, next) => {
  try {
    const { sessionId, prompt, agent } = req.body;
    if (!sessionId || !prompt) {
      return res.status(400).json({ error: 'sessionId and prompt are required' });
    }
    const session = await sessionStore.getSession(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const task = await taskStore.createTask({ sessionId, prompt, agent });
    await enqueueTask(task._id, { sessionId, prompt, agent: task.agent });
    res.status(201).json({ task });
  } catch (err) {
    next(err);
  }
});

// PUT /api/tasks/:id
router.put('/:id', async (req, res, next) => {
  try {
    if (!validateId(req.params.id, res)) return;
    const { prompt, agent, status, result, executedByAgent } = req.body;
    const update = {};
    if (prompt !== undefined) update.prompt = prompt;
    if (agent !== undefined) update.agent = agent;
    if (status !== undefined) update.status = status;
    if (result !== undefined) update.result = result;
    if (executedByAgent !== undefined) update.executedByAgent = executedByAgent;

    const task = await taskStore.updateTask(req.params.id, update);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ task });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res, next) => {
  try {
    if (!validateId(req.params.id, res)) return;
    // Remove BullMQ jobs (task + subtasks)
    const task = await taskStore.getTask(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    await removeJob(task._id).catch(() => {});
    for (const st of task.subtasks || []) {
      await removeJob(st._id).catch(() => {});
    }

    await taskStore.deleteTask(req.params.id);
    res.json({ message: 'Task deleted' });
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks/:id/subtasks
router.post('/:id/subtasks', async (req, res, next) => {
  try {
    if (!validateId(req.params.id, res)) return;
    const { prompt, agent } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt is required' });

    const existing = await taskStore.getTask(req.params.id, { populate: false });
    if (!existing) return res.status(404).json({ error: 'Task not found' });

    const subtask = await taskStore.addSubtask(req.params.id, { prompt, agent: agent || 'claude' });
    await enqueueSubtask(subtask._id, {
      taskId: req.params.id,
      sessionId: existing.sessionId,
      prompt,
      agent: subtask.agent,
    });

    const task = await taskStore.getTask(req.params.id);
    res.status(201).json({ task });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/tasks/:id/skip
router.patch('/:id/skip', async (req, res, next) => {
  try {
    if (!validateId(req.params.id, res)) return;
    const existing = await taskStore.getTask(req.params.id, { populate: false });
    if (!existing) return res.status(404).json({ error: 'Task not found' });
    if (existing.status === 'skipped') {
      return res.status(400).json({ error: 'Task is already skipped' });
    }

    await removeJob(req.params.id).catch(() => {});
    const task = await taskStore.updateTask(req.params.id, {
      status: 'skipped',
      endDate: new Date().toISOString(),
    });
    res.json({ task });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/tasks/:id/resume
router.patch('/:id/resume', async (req, res, next) => {
  try {
    if (!validateId(req.params.id, res)) return;
    const existing = await taskStore.getTask(req.params.id, { populate: false });
    if (!existing) return res.status(404).json({ error: 'Task not found' });
    if (existing.status !== 'skipped' && existing.status !== 'pause') {
      return res.status(400).json({ error: 'Task cannot be resumed from its current status' });
    }

    const task = await taskStore.updateTask(req.params.id, { status: 'pending', endDate: '' });
    await enqueueTask(task._id, {
      sessionId: typeof task.sessionId === 'object' ? task.sessionId._id : task.sessionId,
      prompt: task.prompt,
      agent: task.agent,
    });
    res.json({ task });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/tasks/:id/subtasks/:subtaskId/skip
router.patch('/:id/subtasks/:subtaskId/skip', async (req, res, next) => {
  try {
    if (!validateId(req.params.id, res)) return;
    const existing = await taskStore.getTask(req.params.id, { populate: false });
    if (!existing) return res.status(404).json({ error: 'Task not found' });

    const sub = await taskStore.getSubtask(req.params.id, req.params.subtaskId);
    if (!sub) return res.status(404).json({ error: 'Subtask not found' });
    if (sub.status === 'skipped') {
      return res.status(400).json({ error: 'Subtask is already skipped' });
    }

    await removeJob(req.params.subtaskId).catch(() => {});
    await taskStore.updateSubtask(req.params.id, req.params.subtaskId, {
      status: 'skipped',
      endDate: new Date().toISOString(),
    });

    const task = await taskStore.getTask(req.params.id);
    res.json({ task });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/tasks/:id/subtasks/:subtaskId/resume
router.patch('/:id/subtasks/:subtaskId/resume', async (req, res, next) => {
  try {
    if (!validateId(req.params.id, res)) return;
    const existing = await taskStore.getTask(req.params.id, { populate: false });
    if (!existing) return res.status(404).json({ error: 'Task not found' });

    const sub = await taskStore.getSubtask(req.params.id, req.params.subtaskId);
    if (!sub) return res.status(404).json({ error: 'Subtask not found' });
    if (sub.status !== 'skipped' && sub.status !== 'pause') {
      return res.status(400).json({ error: 'Subtask cannot be resumed from its current status' });
    }

    await taskStore.updateSubtask(req.params.id, req.params.subtaskId, {
      status: 'pending',
      endDate: '',
    });

    await enqueueSubtask(req.params.subtaskId, {
      taskId: req.params.id,
      sessionId: typeof existing.sessionId === 'object' ? existing.sessionId._id : existing.sessionId,
      prompt: sub.prompt,
      agent: sub.agent,
    });

    const task = await taskStore.getTask(req.params.id);
    res.json({ task });
  } catch (err) {
    next(err);
  }
});

export default router;
