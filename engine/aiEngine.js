import dotenv from 'dotenv';
import express from 'express';
import { Worker } from 'bullmq';
import { getRedis, closeRedis } from '../shared/redis/client.js';
import { QUEUE_NAME } from '../shared/redis/keys.js';
import { getBullMQConnection } from '../shared/queue/connection.js';
import { closeTaskQueue, getTaskQueue } from '../shared/queue/taskQueue.js';
import { getTaskCountByStatus, getTotalTaskCount } from '../shared/redis/taskStore.js';
import { getAllAgentRateLimits } from '../shared/redis/rateLimitStore.js';
import { AGENT_TYPES } from './config/agents.js';
import { processor } from './processor.js';

dotenv.config();

export const ENGINE_PORT = parseInt(process.env.ENGINE_PORT, 10) || 3332;
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY, 10) || 5;

let worker = null;

export const startEngine = async () => {
  // 1. Verify Redis connection
  const redis = getRedis();
  await redis.ping();
  console.log('AI Engine: Redis connected');

  // 2. Create BullMQ Worker
  worker = new Worker(QUEUE_NAME, processor, {
    connection: getBullMQConnection(),
    concurrency: WORKER_CONCURRENCY,
  });

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} (${job.data.type}) completed`);
  });

  worker.on('failed', (job, err) => {
    // DelayedError is expected (lock contention, rate limit) — don't log as error
    if (err?.name === 'DelayedError') return;
    console.error(`Job ${job?.id} failed:`, err?.message || err);
  });

  worker.on('error', (err) => {
    console.error('Worker error:', err);
  });

  console.log(`AI Engine started (BullMQ worker, concurrency=${WORKER_CONCURRENCY})`);

  // 3. Health endpoint
  const healthApp = express();
  healthApp.get('/health', async (_req, res) => {
    try {
      const [pendingCount, runningCount, totalCount, queueCounts, rateLimits] = await Promise.all([
        getTaskCountByStatus('pending'),
        getTaskCountByStatus('running'),
        getTotalTaskCount(),
        getTaskQueue().getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed').catch(() => ({})),
        getAllAgentRateLimits(AGENT_TYPES),
      ]);
      res.json({
        status: 'ok',
        timestamp: new Date(),
        engine: 'ai-query-manager',
        tasks: { pending: pendingCount, running: runningCount, total: totalCount },
        queue: queueCounts,
        rateLimits,
      });
    } catch (err) {
      res.status(500).json({ status: 'error', error: err.message });
    }
  });

  healthApp.listen(ENGINE_PORT, () => {
    console.log(`Engine health endpoint running on port ${ENGINE_PORT}`);
  });

  // 4. Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`\nAI Engine: Shutting down (${signal})...`);
    if (worker) await worker.close();
    await closeTaskQueue();
    await closeRedis();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};
