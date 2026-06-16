export type TaskStatus = 'pending' | 'running' | 'success' | 'pause' | 'failed' | 'skipped';

export type AgentType = 'claude' | 'vibe' | 'antigravity' | 'hermes' | 'opencode';

export interface Subtask {
  _id: string;
  prompt: string;
  status: TaskStatus;
  result?: string;
  createdAt: string;
}

export interface Task {
  _id: string;
  sessionId: string;
  prompt: string;
  agent: AgentType;
  executedByAgent: boolean;
  status: TaskStatus;
  result?: string;
  subtasks: Subtask[];
  createdAt: string;
  updatedAt: string;
  endDate?: string;
}

export interface Session {
  _id: string;
  directory: string;
  titre: string;
  createdAt: string;
  updatedAt: string;
}

export interface FilterParams {
  directory?: string;
  status?: TaskStatus;
}
