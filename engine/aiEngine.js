import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { runAgent, detectSubtasks } from './agents/index.js';
import Task from './models/Task.js';
import Session from './models/Session.js';
import express from 'express';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cockpitai';
export const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL, 10) || 5000;
export const ENGINE_PORT = parseInt(process.env.ENGINE_PORT, 10) || 3332;

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

  let allSubtasksCompleted = true;
  
  for (const subtask of task.subtasks) {
    if (subtask.status !== 'pending' && subtask.status !== 'running') continue;
    
    allSubtasksCompleted = false;

    try {
      const taskDoc = await Task.findById(task._id).populate('sessionId');
      if (!taskDoc) continue;

      const subtaskIndex = taskDoc.subtasks.findIndex(st => st._id.equals(subtask._id));
      if (subtaskIndex === -1) continue;

      taskDoc.subtasks[subtaskIndex].status = 'running';
      await taskDoc.save();

      const agentToUse = subtask.agent || task.agent;
      const workingDirectory = taskDoc.sessionId?.directory;
      const result = await runAgent(agentToUse, subtask.prompt, { workingDirectory });

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

  if (allSubtasksCompleted) {
    const taskDoc = await Task.findById(task._id);
    if (taskDoc) {
      const hasPendingOrRunning = taskDoc.subtasks.some(st => st.status === 'pending' || st.status === 'running');
      if (!hasPendingOrRunning) {
        const allSuccess = taskDoc.subtasks.every(st => st.status === 'success');
        await Task.findByIdAndUpdate(task._id, {
          status: allSuccess ? 'success' : 'failed',
          endDate: new Date()
        });
        console.log(`All subtasks completed for task ${task._id}, marked as ${allSuccess ? 'success' : 'failed'}`);
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

export const startEngine = async () => {
  await connectDB();
  console.log('AI Engine started');
  console.log(`Polling interval: ${POLL_INTERVAL / 1000}s`);

  const healthApp = express();
  healthApp.get('/health', async (_req, res) => {
    try {
      const [pendingCount, runningCount, totalCount] = await Promise.all([
        Task.countDocuments({ status: 'pending' }),
        Task.countDocuments({ status: 'running' }),
        Task.countDocuments({}),
      ]);
      res.json({
        status: 'ok',
        timestamp: new Date(),
        engine: 'ai-query-manager',
        tasks: { pending: pendingCount, running: runningCount, total: totalCount },
      });
    } catch (err) {
      res.status(500).json({ status: 'error', error: err.message });
    }
  });

  healthApp.listen(ENGINE_PORT, () => {
    console.log(`Engine health endpoint running on port ${ENGINE_PORT}`);
  });

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
    const taskDoc = await Task.findById(task._id).populate('sessionId');
    const workingDirectory = taskDoc?.sessionId?.directory;
    const result = await runAgent(task.agent, task.prompt, { workingDirectory });

    if (result.success) {
      const subtasks = detectSubtasks(result.result);
      
      if (subtasks && subtasks.length > 0) {
        await Task.findByIdAndUpdate(task._id, {
          status: 'running',
          result: result.result,
          executedByAgent: task.agent,
          $push: {
            subtasks: {
              $each: subtasks.map(prompt => ({
                prompt,
                agent: task.agent,
                status: 'pending'
              }))
            }
          }
        });
        console.log(`Decomposition detected for task ${task._id}: ${subtasks.length} subtasks created`);
      } else {
        await Task.findByIdAndUpdate(task._id, {
          status: 'success',
          result: result.result,
          executedByAgent: task.agent,
        });
      }
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
