import mongoose from 'mongoose';

const subtaskSchema = new mongoose.Schema(
  {
    prompt: { type: String, required: true },
    agent: {
      type: String,
      enum: ['claude', 'vibe', 'antigravity', 'hermes', 'opencode'],
      default: 'claude',
    },
    status: {
      type: String,
      enum: ['pending', 'running', 'success', 'pause', 'failed', 'skipped'],
      default: 'pending',
    },
    result: { type: String, default: '' },
    executedByAgent: { type: String, default: '' },
    endDate: { type: Date, default: undefined },
  },
  { _id: true, timestamps: true }
);

const taskSchema = new mongoose.Schema(
  {
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
    prompt: { type: String, required: true },
    agent: {
      type: String,
      enum: ['claude', 'vibe', 'antigravity', 'hermes', 'opencode'],
      default: 'claude',
    },
    status: {
      type: String,
      enum: ['pending', 'running', 'success', 'pause', 'failed', 'skipped'],
      default: 'pending',
    },
    result: { type: String, default: '' },
    executedByAgent: { type: String, default: '' },
    subtasks: { type: [subtaskSchema], default: [] },
    endDate: { type: Date, default: undefined },
  },
  { timestamps: true }
);

taskSchema.index({ sessionId: 1 });
taskSchema.index({ status: 1 });
taskSchema.index({ executedByAgent: 1 });

export const Task = mongoose.model('Task', taskSchema);
export default Task;
