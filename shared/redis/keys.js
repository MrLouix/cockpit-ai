// ---------------------------------------------------------------------------
// Redis key templates — single source of truth for all key names
// ---------------------------------------------------------------------------

export const KEYS = {
  // Session
  session: (id) => `session:${id}`,
  sessionsAll: 'sessions:all',
  sessionsByDirectory: (dir) => `sessions:by-directory:${dir}`,

  // Task
  task: (id) => `task:${id}`,
  tasksAll: 'tasks:all',
  tasksByStatus: (status) => `tasks:by-status:${status}`,
  tasksBySession: (sessionId) => `tasks:by-session:${sessionId}`,

  // Subtask
  subtask: (taskId, subtaskId) => `task:${taskId}:subtask:${subtaskId}`,
  subtasksList: (taskId) => `task:${taskId}:subtasks`,

  // Locks
  sessionLock: (sessionId) => `session:lock:${sessionId}`,

  // Rate limiting
  agentRateLimitUntil: (agentType) => `agent:${agentType}:rate_limited_until`,
};

// All valid task statuses (mirrors frontend TaskStatus type)
export const TASK_STATUSES = ['pending', 'running', 'success', 'pause', 'failed', 'skipped'];

// BullMQ queue name
export const QUEUE_NAME = 'cockpitai-tasks';
