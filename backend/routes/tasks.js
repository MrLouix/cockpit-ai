import { Router } from 'express';
import { Task } from '../models/Task.js';

const router = Router();

function generateId() {
  return Math.random().toString(36).substring(2, 8);
}

// GET /api/tasks (filter by directory, status, limit)
router.get('/', async (req, res, next) => {
  try {
    const { directory, status, limit } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const opts = {};
    if (limit) opts.limit = parseInt(limit, 10);
    let query = Task.find(filter).sort({ createdAt: -1 });
    if (directory) {
      const { Session } = await import('../models/Session.js');
      const sessions = await Session.find({ directory }).select('_id');
      const sessionIds = sessions.map((s) => s._id);
      query = query.where('sessionId').in(sessionIds);
    }
    if (opts.limit) query = query.limit(opts.limit);
    const tasks = await query.populate('sessionId', 'directory titre');
    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

// GET /api/tasks/:id (populate session)
router.get('/:id', async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id).populate('sessionId', 'directory titre');
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks
router.post('/', async (req, res, next) => {
  try {
    const { sessionId, prompt, agent, executedByAgent, result } = req.body;
    if (!sessionId || !prompt) {
      return res.status(400).json({ error: 'sessionId and prompt are required' });
    }
    const task = new Task({ sessionId, prompt, agent, executedByAgent, result });
    await task.save();
    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
});

// PUT /api/tasks/:id (update status, result, executedByAgent)
router.put('/:id', async (req, res, next) => {
  try {
    const { status, result, executedByAgent } = req.body;
    const update = {};
    if (status !== undefined) update.status = status;
    if (result !== undefined) update.result = result;
    if (executedByAgent !== undefined) update.executedByAgent = executedByAgent;
    if (status === 'success' || status === 'failed' || status === 'skipped') {
      update.endDate = new Date();
    }
    const task = await Task.findByIdAndUpdate(req.params.id, update, { new: true }).populate(
      'sessionId',
      'directory titre'
    );
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ message: 'Task deleted' });
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks/:id/subtasks
router.post('/:id/subtasks', async (req, res, next) => {
  try {
    const { prompt, agent, executedByAgent, status } = req.body;
    const subtask = {
      prompt: prompt || '',
      agent: agent || 'vibe',
      executedByAgent,
      status: status || 'pending',
    };
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { $push: { subtasks: subtask } },
      { new: true }
    ).populate('sessionId', 'directory titre');
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/tasks/:id/skip
router.patch('/:id/skip', async (req, res, next) => {
  try {
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { status: 'skipped', endDate: new Date() },
      { new: true }
    ).populate('sessionId', 'directory titre');
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/tasks/:id/resume
router.patch('/:id/resume', async (req, res, next) => {
  try {
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { $set: { status: 'pending' }, $unset: { endDate: '' } },
      { new: true }
    ).populate('sessionId', 'directory titre');
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) {
    next(err);
  }
});

// Helper: find and update a subtask by its _id
async function updateSubtask(taskId, subtaskId, update) {
  const task = await Task.findById(taskId);
  if (!task) return null;
  const sub = task.subtasks.id(subtaskId);
  if (!sub) return null;
  
  Object.assign(sub, update);
  
  if (update.status === 'pending') {
    // If a subtask is resumed, reset parent to running so engine can execute it
    task.status = 'running';
    task.endDate = undefined;
  } else if (update.status === 'skipped') {
    // If a subtask is skipped, check if all are completed
    const allDone = task.subtasks.every(
      (st) => st.status === 'success' || st.status === 'skipped' || st.status === 'failed'
    );
    if (allDone && task.status === 'running') {
      const successCount = task.subtasks.filter((st) => st.status === 'success').length;
      task.result = `${successCount}/${task.subtasks.length} subtasks completed.`;
      task.status = 'success';
      task.endDate = new Date();
    }
  }
  
  await task.save();
  return Task.findById(taskId).populate('sessionId', 'directory titre');
}

// PATCH /api/tasks/:id/subtasks/:subtaskId/skip
router.patch('/:id/subtasks/:subtaskId/skip', async (req, res, next) => {
  try {
    const task = await updateSubtask(req.params.id, req.params.subtaskId, {
      status: 'skipped',
      endDate: new Date(),
    });
    if (!task) return res.status(404).json({ error: 'Task or subtask not found' });
    res.json(task);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/tasks/:id/subtasks/:subtaskId/resume
router.patch('/:id/subtasks/:subtaskId/resume', async (req, res, next) => {
  try {
    const task = await updateSubtask(req.params.id, req.params.subtaskId, {
      status: 'pending',
      endDate: undefined,
    });
    if (!task) return res.status(404).json({ error: 'Task or subtask not found' });
    res.json(task);
  } catch (err) {
    next(err);
  }
});

export default router;
