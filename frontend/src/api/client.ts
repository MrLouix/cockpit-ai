const API_BASE = '/api';

interface ApiError {
  message: string;
  status?: number;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const error: ApiError = {
      message: data?.message || data?.error || `HTTP ${res.status}`,
      status: res.status,
    };
    throw error;
  }

  return data as T;
}

// ── Sessions ──────────────────────────────────────────────

export function getSessions() {
  return request<any>('/sessions');
}

export function getSession(id: string) {
  return request<{ session: any }>('/sessions/' + id);
}

export function createSession(data: { directory: string; titre: string }) {
  return request<any>('/sessions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function deleteSession(id: string) {
  return request<any>('/sessions/' + id, { method: 'DELETE' });
}

export function getSessionTasks(sessionId: string) {
  return request<{ tasks: any[]; total: number }>(
    '/sessions/' + sessionId + '/tasks'
  );
}

// ── Tasks ─────────────────────────────────────────────────

export function getTasks(params?: {
  status?: string;
  agent?: string;
  limit?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.agent) qs.set('agent', params.agent);
  if (params?.limit) qs.set('limit', String(params.limit));
  return request<any[]>(
    '/tasks' + (qs.toString() ? '?' + qs.toString() : '')
  );
}

export function getTask(id: string) {
  return request<{ task: any }>('/tasks/' + id);
}

export function createTask(data: {
  sessionId: string;
  prompt: string;
  agent: string;
  executedByAgent?: boolean;
}) {
  return request<any>('/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateTask(id: string, data: Partial<any>) {
  return request<any>('/tasks/' + id, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteTask(id: string) {
  return request<any>('/tasks/' + id, { method: 'DELETE' });
}

export function skipTask(id: string) {
  return request<any>('/tasks/' + id + '/skip', { method: 'PATCH' });
}

export function resumeTask(id: string) {
  return request<any>('/tasks/' + id + '/resume', { method: 'PATCH' });
}

// ── Subtasks ──────────────────────────────────────────────

export function addSubtask(taskId: string, data: { prompt: string }) {
  return request<any>('/tasks/' + taskId + '/subtasks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function skipSubtask(taskId: string, subId: string) {
  return request<any>(`/tasks/${taskId}/subtasks/${subId}/skip`, {
    method: 'PATCH',
  });
}

export function resumeSubtask(taskId: string, subId: string) {
  return request<any>(`/tasks/${taskId}/subtasks/${subId}/resume`, {
    method: 'PATCH',
  });
}

// ── Health ────────────────────────────────────────────────

// ── Files ──────────────────────────────────────────────

export function listFiles(dirPath: string) {
  const qs = new URLSearchParams();
  if (dirPath) qs.set('path', dirPath);
  return request<{ path: string; parent: string; directories: { name: string; fullPath: string }[]; files: { name: string; fullPath: string }[] }>(
    '/files/ls' + (qs.toString() ? '?' + qs.toString() : '')
  );
}
