import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Task } from './models/Task.js';
import { runAgent, detectSubtasks } from './agents/index.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/aiquerymanager';
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL, 10) || 5000;

/**
 * Process a pending task: set running, execute agent, save result.
 * @param {Object} task - Mongoose document
 */
async function processTask(task) {
  console.log(`[ENGINE] Processing task ${task._id} with agent '${task.agent}'...`);

  // Set status to running
  task.status = 'running';
  task.updatedAt = new Date();
  await task.save();

  // Run the agent
  const result = await runAgent(task.agent, task.prompt);

  // Update task with results
  task.executedByAgent = task.agent;
  task.updatedAt = new Date();

  if (result.success) {
    task.result = result.result;
    task.status = 'success';
    task.endDate = new Date();

    // Check for subtasks in the response — Sprint 5 detection
    const subtasks = detectSubtasks(result.result);
    if (subtasks) {
      console.log(`[ENGINE] Detected ${subtasks.length} subtasks for task ${task._id}`);
      // Add subtask objects to the embedded array
      for (const stPrompt of subtasks) {
        task.subtasks.push({
          prompt: stPrompt,
          agent: task.agent,
          status: 'pending',
          createdAt: new Date(),
        });
      }
    }
  } else {
    task.result = `Error: ${result.error}`;
    task.status = 'failed';
    task.endDate = new Date();
  }

  await task.save();
  console.log(`[ENGINE] Task ${task._id} → ${task.status}`);
}

/**
 * Process subtasks for a task that has pending subtasks.
 * @param {Object} task - Mongoose document with subtasks
 */
async function processSubtasks(task) {
  if (!task.subtasks || task.subtasks.length === 0) return;

  const pendingSubtasks = task.subtasks.filter(
    (st) => st.status === 'pending' || st.status === 'running'
  );

  if (pendingSubtasks.length === 0) {
    // Check if ALL subtasks are done — mark parent as success
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

    // Set subtask running
    subtask.status = 'running';
    task.updatedAt = new Date();
    await task.save();

    // Run agent on subtask with the SAME agent as the parent
    const result = await runAgent(task.agent, subtask.prompt);

    if (result.success) {
      subtask.status = 'success';
      subtask.result = result.result;
      subtask.executedByAgent = task.agent;
    } else {
      subtask.status = 'failed';
      subtask.result = `Error: ${result.error}`;
    }

    subtask.endDate = new Date();
    task.updatedAt = new Date();
    await task.save();

    console.log(`[ENGINE] Subtask → ${subtask.status}`);
  }
}

/**
 * Main loop: poll for pending tasks and process them.
 */
async function main() {
  console.log('[ENGINE] Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('[ENGINE] Connected to MongoDB');

  // Signal handling for clean shutdown
  const shutdown = async (signal) => {
    console.log(`\n[ENGINE] Received ${signal}, shutting down...`);
    if (mongoose.connection.readyState === 1) {
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
      // Find one pending task, oldest first
      const pendingTasks = await Task.find({ status: 'pending' })
        .sort({ createdAt: 1 })
        .limit(1);

      if (pendingTasks.length > 0) {
        const task = pendingTasks[0];
        await processTask(task);

        // If the task was decomposed or has subtasks, process them
        if (task.subtasks && task.subtasks.length > 0) {
          await processSubtasks(task);
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
