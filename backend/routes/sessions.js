import { Router } from 'express';
import { Session } from '../models/Session.js';
import { Task } from '../models/Task.js';

const router = Router();

function handleError(err, res, next) {
  if (err.name === 'CastError') return res.status(400).json({ error: 'Invalid ID format' });
  next(err);
}

// GET /api/sessions
router.get('/', async (_req, res, next) => {
  try {
    const sessions = await Session.find().sort({ createdAt: -1 });
    res.json({ sessions });
  } catch (err) {
    next(err);
  }
});

// GET /api/sessions/:id
router.get('/:id', async (req, res, next) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json({ session });
  } catch (err) {
    handleError(err, res, next);
  }
});

// POST /api/sessions
router.post('/', async (req, res, next) => {
  try {
    const { directory, titre } = req.body;
    if (!directory || !titre) {
      return res.status(400).json({ error: 'directory and titre are required' });
    }
    const session = await Session.create({ directory, titre });
    res.status(201).json({ session });
  } catch (err) {
    next(err);
  }
});

// PUT /api/sessions/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { directory, titre } = req.body;
    const update = {};
    if (directory !== undefined) update.directory = directory;
    if (titre !== undefined) update.titre = titre;
    const session = await Session.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json({ session });
  } catch (err) {
    handleError(err, res, next);
  }
});

// DELETE /api/sessions/:id (cascade-deletes associated tasks)
router.delete('/:id', async (req, res, next) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    await Task.deleteMany({ sessionId: session._id });
    await session.deleteOne();
    res.json({ message: 'Session and associated tasks deleted' });
  } catch (err) {
    handleError(err, res, next);
  }
});

// GET /api/sessions/:id/tasks (bonus convenience endpoint)
router.get('/:id/tasks', async (req, res, next) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const tasks = await Task.find({ sessionId: req.params.id }).sort({ createdAt: 1 });
    res.json({ tasks });
  } catch (err) {
    handleError(err, res, next);
  }
});

export default router;
