import { Router } from 'express';
import { Task } from '../models/Task.js';
import { Session } from '../models/Session.js';

const router = Router();

function handleError(err, res, next) {
  if (err.name === 'CastError') return res.status(400).json({ error: 'Invalid ID format' });
  if (err.name === 'ValidationError') return res.status(400).json({ error: err.message });
  next(err);
}

// GET /api/tasks?directory=&status=&limit=
router.get('/', async (req, res, next) => {
  try {
    const { directory, status, limit = '100' } = req.query;
    const filter = {};

    if (status) filter.status = status;

    if (directory) {
      const sessions = await Session.find({ directory }).select('_id');
      filter.sessionId = { $in: sessions.map((s) => s._id) };
    }

    const limitNum = parseInt(limit, 10) || 100;

    const [tasks, total] = await Promise.all([
      Task.find(filter)
        .sort({ createdAt: -1 })
        .limit(limitNum)
        .populate('sessionId', 'directory titre'),
      Task.countDocuments(filter),
    ]);

    res.json({ tasks, total });
  } catch (err) {
    next(err);
  }
});

// GET /api/tasks/:id
router.get('/:id', async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id).populate('sessionId', 'directory titre');
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ task });
  } catch (err) {
    handleError(err, res, next);
  }
});

// POST /api/tasks
router.post('/', async (req, res, next) => {
  try {
    const { sessionId, prompt, agent } = req.body;
    if (!sessionId || !prompt) {
      return res.status(400).json({ error: 'sessionId and prompt are required' });
    }
    const session = await Session.findById(sessionId).catch(() => null);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const task = await Task.create({ sessionId, prompt, agent });
    res.status(201).json({ task });
  } catch (err) {
    handleError(err, res, next);
  }
});

// PUT /api/tasks/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { prompt, agent, status, result, executedByAgent } = req.body;
    const update = {};
    if (prompt !== undefined) update.prompt = prompt;
    if (agent !== undefined) update.agent = agent;
    if (status !== undefined) update.status = status;
    if (result !== undefined) update.result = result;
    if (executedByAgent !== undefined) update.executedByAgent = executedByAgent;
    // subtasks deliberately excluded

    const task = await Task.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    }).populate('sessionId', 'directory titre');
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ task });
  } catch (err) {
    handleError(err, res, next);
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ message: 'Task deleted' });
  } catch (err) {
    handleError(err, res, next);
  }
});

// POST /api/tasks/:id/subtasks
router.post('/:id/subtasks', async (req, res, next) => {
  try {
    const { prompt, agent } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt is required' });

    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { $push: { subtasks: { prompt, agent: agent || 'claude' } } },
      { new: true }
    ).populate('sessionId', 'directory titre');
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.status(201).json({ task });
  } catch (err) {
    handleError(err, res, next);
  }
});

// PATCH /api/tasks/:id/skip
router.patch('/:id/skip', async (req, res, next) => {
  try {
    const existing = await Task.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Task not found' });
    if (existing.status === 'skipped') {
      return res.status(400).json({ error: 'Task is already skipped' });
    }
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { status: 'skipped', endDate: new Date() },
      { new: true }
    ).populate('sessionId', 'directory titre');
    res.json({ task });
  } catch (err) {
    handleError(err, res, next);
  }
});

// PATCH /api/tasks/:id/resume
router.patch('/:id/resume', async (req, res, next) => {
  try {
    const existing = await Task.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Task not found' });
    if (existing.status !== 'skipped' && existing.status !== 'pause') {
      return res.status(400).json({ error: 'Task cannot be resumed from its current status' });
    }
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { $set: { status: 'pending' }, $unset: { endDate: '' } },
      { new: true }
    ).populate('sessionId', 'directory titre');
    res.json({ task });
  } catch (err) {
    handleError(err, res, next);
  }
});

// PATCH /api/tasks/:id/subtasks/:subtaskId/skip
router.patch('/:id/subtasks/:subtaskId/skip', async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const sub = task.subtasks.id(req.params.subtaskId);
    if (!sub) return res.status(404).json({ error: 'Subtask not found' });
    if (sub.status === 'skipped') {
      return res.status(400).json({ error: 'Subtask is already skipped' });
    }
    sub.status = 'skipped';
    sub.endDate = new Date();
    await task.save();
    const populated = await Task.findById(task._id).populate('sessionId', 'directory titre');
    res.json({ task: populated });
  } catch (err) {
    handleError(err, res, next);
  }
});

// PATCH /api/tasks/:id/subtasks/:subtaskId/resume
router.patch('/:id/subtasks/:subtaskId/resume', async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const sub = task.subtasks.id(req.params.subtaskId);
    if (!sub) return res.status(404).json({ error: 'Subtask not found' });
    if (sub.status !== 'skipped' && sub.status !== 'pause') {
      return res.status(400).json({ error: 'Subtask cannot be resumed from its current status' });
    }
    sub.status = 'pending';
    sub.endDate = undefined;
    await task.save();
    const populated = await Task.findById(task._id).populate('sessionId', 'directory titre');
    res.json({ task: populated });
  } catch (err) {
    handleError(err, res, next);
  }
});

export default router;
