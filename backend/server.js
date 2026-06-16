import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import sessionsRouter from './routes/sessions.js';
import tasksRouter from './routes/tasks.js';
import filesRouter from './routes/files.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { connectDB } from './config/db.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Routes
app.use('/api/sessions', sessionsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/files', filesRouter);

// Error handler
app.use(errorHandler);

// Connect DB then listen
await connectDB();

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
