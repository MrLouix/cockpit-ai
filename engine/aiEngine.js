import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { runAgent } from './agents/index.js';
import Task from './models/Task.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cockpitai';
export const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL, 10) || 5000;

export const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('AI Engine: MongoDB connected');
  } catch (err) {
    console.error('AI Engine: MongoDB connection error:', err);
    process.exit(1);
  }
};

export const processSubtasks = async (task) => {
  if (!task.subtasks || task.subtasks.length === 0) return;

  for (const subtask of task.subtasks) {
    if (subtask.status !== 'pending' && subtask.status !== 'running') continue;

    try {
      const taskDoc = await Task.findById(task._id);
      if (!taskDoc) continue;

      const subtaskIndex = taskDoc.subtasks.findIndex(st => st._id.equals(subtask._id));
      if (subtaskIndex === -1) continue;

      taskDoc.subtasks[subtaskIndex].status = 'running';
      await taskDoc.save();

      const agentToUse = subtask.agent || task.agent;
      const result = await runAgent(agentToUse, subtask.prompt);

      const taskDoc2 = await Task.findById(task._id);
      const subtaskIndex2 = taskDoc2.subtasks.findIndex(st => st._id.equals(subtask._id));

      taskDoc2.subtasks[subtaskIndex2].status = result.success ? 'success' : 'failed';
      taskDoc2.subtasks[subtaskIndex2].result = result.success ? result.result : result.error;
      taskDoc2.subtasks[subtaskIndex2].executedByAgent = agentToUse;
      await taskDoc2.save();
    } catch (err) {
      try {
        const taskDoc = await Task.findById(task._id);
        if (!taskDoc) continue;
        const subtaskIndex = taskDoc.subtasks.findIndex(st => st._id.equals(subtask._id));
        if (subtaskIndex !== -1) {
          taskDoc.subtasks[subtaskIndex].status = 'failed';
          taskDoc.subtasks[subtaskIndex].result = err.message;
          taskDoc.subtasks[subtaskIndex].executedByAgent = subtask.agent || task.agent;
          await taskDoc.save();
        }
      } catch (saveErr) {
        console.error('Error saving failed subtask:', saveErr);
      }
    }
  }
};

export const mainLoop = async () => {
  try {
    const tasks = await Task.find({
      status: { $in: ['pending', 'running'] },
    }).populate('sessionId');

    console.log(`Found ${tasks.length} tasks to process`);

    for (const task of tasks) {
      if (task.status === 'pending') {
        await processTask(task);
      }
      await processSubtasks(task);
    }
  } catch (err) {
    console.error('Error in main loop:', err);
  }
};

const shutdown = async (signal) => {
  console.log(`\nAI Engine: Shutting down (${signal})...`);
  await mongoose.disconnect();
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

const startEngine = async () => {
  await connectDB();
  console.log('AI Engine started');
  console.log(`Polling interval: ${POLL_INTERVAL / 1000}s`);

  await mainLoop();
  setInterval(mainLoop, POLL_INTERVAL);
};

if (process.argv[1] && process.argv[1].endsWith('aiEngine.js')) {
  startEngine().catch(err => {
    console.error('Failed to start AI Engine:', err);
    process.exit(1);
  });
}

export const processTask = async (task) => {
  if (task.status !== 'pending' && task.status !== 'running') return;

  await Task.findByIdAndUpdate(task._id, { status: 'running' });

  try {
    const result = await runAgent(task.agent, task.prompt);

    if (result.success) {
      await Task.findByIdAndUpdate(task._id, {
        status: 'success',
        result: result.result,
        executedByAgent: task.agent,
      });
    } else {
      await Task.findByIdAndUpdate(task._id, {
        status: 'failed',
        result: result.error,
        executedByAgent: task.agent,
      });
    }
  } catch (err) {
    await Task.findByIdAndUpdate(task._id, {
      status: 'failed',
      result: err.message,
      executedByAgent: task.agent,
    });
  }
};
