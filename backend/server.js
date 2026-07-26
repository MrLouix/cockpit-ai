import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import sessionsRouter from './routes/sessions.js';
import tasksRouter from './routes/tasks.js';
import filesRouter from './routes/files.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { connectRedis } from './config/redis.js';

const app = express();
const PORT = process.env.PORT || 3331;
const HOST = process.env.HOST || 'localhost';

app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Routes
app.use('/api/sessions', sessionsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/files', filesRouter);

// 404 fallback
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use(errorHandler);

export default app;

// Only start the server when run directly (not when imported by tests)
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  connectRedis().then(() => {
    app.listen(PORT, HOST, () => {
      console.log(`Server running on http://${HOST}:${PORT}`);
    });
  });
}
