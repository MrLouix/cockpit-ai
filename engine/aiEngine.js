import mongoose from 'mongoose';
import dotenv from 'dotenv';
import express from 'express';
import { Task } from './models/Task.js';
import { Session } from './models/Session.js';
import { runAgent, detectSubtasks } from './agents/index.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/aiquerymanager';
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL, 10) || 5000;
const ENGINE_PORT = parseInt(process.env.ENGINE_PORT, 10) || 3332;

let isMongoConnected = false;
let currentTaskId = null;
let startedAt = Date.now();
let tasksProcessed = 0;

/* ── Express health server ────────────────────────────────── */
const app = express();

app.get('/api/engine/health', async (_req, res) => {
  try {
    const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    const pendingCount = await Task.countDocuments({ status: 'pending' });
    const runningCount = await Task.countDocuments({ status: 'running' });

    res.json({
      status: 'ok',
      uptime: Date.now() - startedAt,
      mongodb: mongoStatus,
      queue: { pending: pendingCount, running: runningCount },
      currentTask: currentTaskId,
      tasksProcessed,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

app.listen(ENGINE_PORT, () => {
  console.log(`[ENGINE] Health server on http://localhost:${ENGINE_PORT}`);
});

/* ── Agent execution ─────────────────────────────────────── */
async function processTask(task) {
  console.log(`[ENGINE] Processing task ${task._id} with agent '${task.agent}'...`);
  currentTaskId = task._id;

  task.status = 'running';
  task.updatedAt = new Date();
  await task.save();

  // Get the session directory for the working directory
  const session = await Session.findById(task.sessionId);
  const cwd = session?.directory || process.cwd();

  const result = await runAgent(task.agent, task.prompt, cwd);

  task.executedByAgent = task.agent;
  task.updatedAt = new Date();

  if (result.success) {
    const subtasks = detectSubtasks(result.result);
    if (subtasks && subtasks.length > 0) {
      console.log(`[ENGINE] Detected ${subtasks.length} subtasks for task ${task._id}`);
      task.status = 'running';
      task.result = `[DECOMPOSITION] ${subtasks.length} sous-tâches créées`;
      
      for (const stPrompt of subtasks) {
        task.subtasks.push({
          prompt: stPrompt,
          agent: task.agent,
          status: 'pending',
          createdAt: new Date(),
        });
      }
    } else {
      task.result = result.result;
      task.status = 'success';
      task.endDate = new Date();
    }
  } else {
    task.result = `Error: ${result.error}`;
    task.status = 'failed';
    task.endDate = new Date();
  }

  tasksProcessed++;
  currentTaskId = null;
  await task.save();
  console.log(`[ENGINE] Task ${task._id} → ${task.status}`);
}

async function processSubtasks(task) {
  if (!task.subtasks || task.subtasks.length === 0) return;

  // Get the session directory for the working directory
  const session = await Session.findById(task.sessionId);
  const cwd = session?.directory || process.cwd();

  const pendingSubtasks = task.subtasks.filter(
    (st) => st.status === 'pending' || st.status === 'running'
  );

  if (pendingSubtasks.length === 0) {
    const allDone = task.subtasks.every(
      (st) => st.status === 'success' || st.status === 'skipped' || st.status === 'failed'
    );
    if (allDone && task.status === 'running') {
      const successCount = task.subtasks.filter((st) => st.status === 'success').length;
      task.result = `${successCount}/${task.subtasks.length} subtasks completed.`;
      task.status = 'success';
      task.endDate = new Date();
      await task.save();
      console.log(`[ENGINE] All subtasks done for task ${task._id} — parent marked success`);
    }
    return;
  }

  for (const subtask of pendingSubtasks) {
    console.log(`[ENGINE] Subtask: "${subtask.prompt?.slice(0, 60)}..."`);

    subtask.status = 'running';
    task.updatedAt = new Date();
    await task.save();

    const result = await runAgent(subtask.agent || task.agent, subtask.prompt, cwd);

    if (result.success) {
      subtask.status = 'success';
      subtask.result = result.result;
      subtask.executedByAgent = subtask.agent || task.agent;
    } else {
      subtask.status = 'failed';
      subtask.result = `Error: ${result.error}`;
      subtask.executedByAgent = subtask.agent || task.agent;
    }

    subtask.endDate = new Date();
    task.updatedAt = new Date();
    await task.save();
    console.log(`[ENGINE] Subtask → ${subtask.status}`);
  }

  // Check again after processing all pending subtasks
  const remainingPending = task.subtasks.filter(
    (st) => st.status === 'pending' || st.status === 'running'
  );
  if (remainingPending.length === 0) {
    const allDone = task.subtasks.every(
      (st) => st.status === 'success' || st.status === 'skipped' || st.status === 'failed'
    );
    if (allDone && task.status === 'running') {
      const successCount = task.subtasks.filter((st) => st.status === 'success').length;
      task.result = `${successCount}/${task.subtasks.length} subtasks completed.`;
      task.status = 'success';
      task.endDate = new Date();
      await task.save();
      console.log(`[ENGINE] All subtasks done for task ${task._id} — parent marked success`);
    }
  }
}

/* ── Main loop ───────────────────────────────────────────── */
async function main() {
  console.log('[ENGINE] Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  isMongoConnected = true;
  console.log('[ENGINE] Connected to MongoDB');

  const shutdown = async (signal) => {
    console.log(`\n[ENGINE] Received ${signal}, shutting down...`);
    if (isMongoConnected && mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('[ENGINE] MongoDB disconnected');
    }
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  console.log(`[ENGINE] Polling for tasks every ${POLL_INTERVAL}ms...`);

  while (true) {
    try {
      const activeTasks = await Task.find({
        status: { $in: ['pending', 'running'] }
      }).sort({ createdAt: 1 });

      for (const task of activeTasks) {
        if (task.status === 'pending') {
          await processTask(task);
        }

        if (task.status === 'running') {
          if (task.subtasks && task.subtasks.length > 0) {
            await processSubtasks(task);
          } else {
            console.log(`[ENGINE] Found stuck running task ${task._id} without subtasks. Resetting to pending.`);
            task.status = 'pending';
            await task.save();
          }
        }
      }
    } catch (err) {
      console.error(`[ENGINE] Error in main loop: ${err.message}`);
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  }
}

main().catch((err) => {
  console.error(`[ENGINE] Fatal error: ${err.message}`);
  process.exit(1);
});
