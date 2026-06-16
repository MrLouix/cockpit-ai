import { Router } from 'express';
import { Session } from '../models/Session.js';
import { Task } from '../models/Task.js';

const router = Router();

// GET /api/sessions
router.get('/', async (_req, res, next) => {
  try {
    const sessions = await Session.find().sort({ createdAt: -1 });
    res.json(sessions);
  } catch (err) {
    next(err);
  }
});

// GET /api/sessions/:id
router.get('/:id', async (req, res, next) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
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
    const session = new Session({ directory, titre });
    await session.save();
    res.status(201).json(session);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/sessions/:id (cascade deletes tasks)
router.delete('/:id', async (req, res, next) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    await Task.deleteMany({ sessionId: req.params.id });
    await session.deleteOne();
    res.json({ message: 'Session and associated tasks deleted' });
  } catch (err) {
    next(err);
  }
});

// GET /api/sessions/:id/tasks
router.get('/:id/tasks', async (req, res, next) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const tasks = await Task.find({ sessionId: req.params.id }).sort({ createdAt: 1 });
    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

export default router;
