import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Task, Session, TaskStatus, FilterParams } from '../types';
import * as api from '../api/client';

// ── Query keys ────────────────────────────────────────────

export const KEYS = {
  sessions: ['sessions'] as const,
  session: (id: string) => ['session', id] as const,
  tasks: (filter?: FilterParams) => ['tasks', filter] as const,
  task: (id: string) => ['task', id] as const,
  sessionTasks: (sessionId: string) => ['session-tasks', sessionId] as const,
  health: ['health'] as const,
};

// ── Sessions ──────────────────────────────────────────────

export function useSessions() {
  return useQuery({
    queryKey: KEYS.sessions,
    queryFn: () => api.getSessions().then((r) => Array.isArray(r) ? r : (r.sessions || [])),
  });
}

export function useSession(id: string) {
  return useQuery({
    queryKey: KEYS.session(id),
    queryFn: () => api.getSession(id).then((r) => r.session),
    enabled: !!id,
  });
}

export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { directory: string; titre: string }) =>
      api.createSession(data),
    onSettled: () => qc.invalidateQueries({ queryKey: KEYS.sessions }),
  });
}

export function useDeleteSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteSession(id),
    onSettled: () => qc.invalidateQueries({ queryKey: KEYS.sessions }),
  });
}

// ── Tasks ─────────────────────────────────────────────────

export function useTasks(filter?: FilterParams) {
  return useQuery({
    queryKey: KEYS.tasks(filter),
    queryFn: () => {
      const r = api.getTasks({ status: filter?.status });
      return r.then((result) => Array.isArray(result) ? result : (result.tasks || []));
    },
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: KEYS.task(id),
    queryFn: () => api.getTask(id).then((r) => r.task),
    enabled: !!id,
  });
}

export function useSessionTasks(sessionId: string) {
  return useQuery({
    queryKey: KEYS.sessionTasks(sessionId),
    queryFn: () => api.getSessionTasks(sessionId).then((r) => r.tasks),
    enabled: !!sessionId,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { sessionId: string; prompt: string; agent: string }) =>
      api.createTask(data),
    onSettled: (_, __, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.sessions });
      qc.invalidateQueries({ queryKey: KEYS.tasks });
      if (vars.sessionId) {
        qc.invalidateQueries({ queryKey: KEYS.sessionTasks(vars.sessionId) });
      }
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteTask(id),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: KEYS.tasks });
      qc.invalidateQueries({ queryKey: KEYS.sessions });
    },
  });
}

export function useSkipTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.skipTask(id),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: KEYS.tasks });
      qc.invalidateQueries({ queryKey: KEYS.sessions });
    },
  });
}

export function useResumeTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.resumeTask(id),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: KEYS.tasks });
      qc.invalidateQueries({ queryKey: KEYS.sessions });
    },
  });
}

export function useAddSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, prompt }: { taskId: string; prompt: string }) =>
      api.addSubtask(taskId, { prompt }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: KEYS.tasks });
    },
  });
}

export function useHealth() {
  return useQuery({
    queryKey: KEYS.health,
    queryFn: () => api.getHealth(),
    staleTime: 30_000,
  });
}
