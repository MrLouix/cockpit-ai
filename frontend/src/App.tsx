import React, { useMemo, useState, useRef, useEffect as useReactEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Task } from './types';
import {
  useSessions,
  useTasks,
  useDeleteTask,
  useSkipTask,
  useResumeTask,
  useCreateSession,
  useCreateTask,
} from './hooks/useTasks';
import { FilterBar } from './components/FilterBar';
import { TaskTable } from './components/TaskTable';
import { TaskCard } from './components/TaskCard';
import { TaskDetailModal } from './components/TaskDetailModal';
import { NewSessionModal } from './components/NewSessionModal';
import { NewTaskModal } from './components/NewTaskModal';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: 5000,
      refetchOnWindowFocus: false,
    },
  },
});

type FilterMode = '' | 'completed' | 'pending';

const COMPLETED_STATUSES = new Set(['success', 'failed']);
const PENDING_STATUSES = new Set(['pending', 'running', 'pause', 'skipped']);

function matchesFilter(status: string, filter: FilterMode): boolean {
  if (!filter) return true;
  if (filter === 'completed') return COMPLETED_STATUSES.has(status);
  if (filter === 'pending') return PENDING_STATUSES.has(status);
  return true;
}

function AppContent() {
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards');
  const [selectedDirectory, setSelectedDirectory] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<FilterMode>('');
  const [showNewSession, setShowNewSession] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [burgerOpen, setBurgerOpen] = useState(false);

  // Close burger on outside click
  const burgerRef = useRef<HTMLDivElement>(null);
  useReactEffect(() => {
    if (!burgerOpen) return;
    const handler = (e: MouseEvent) => {
      if (burgerRef.current && !burgerRef.current.contains(e.target as Node)) {
        setBurgerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [burgerOpen]);

  // Force cards on small screens
  const [isMobile, setIsMobile] = useState(false);
  useReactEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const effectiveView = isMobile ? 'cards' : viewMode;

  const { data: sessions = [], isLoading: sessLoading, error: sessError } = useSessions();
  const { data: tasks = [], isLoading: tasksLoading, error: tasksError } = useTasks();

  const deleteTask = useDeleteTask();
  const skipTask = useSkipTask();
  const resumeTask = useResumeTask();
  const createSession = useCreateSession();
  const createTask = useCreateTask();

  const directories = useMemo(() => {
    const set = new Set<string>();
    sessions.forEach((s) => { if (s.directory) set.add(s.directory); });
    return [...set].sort();
  }, [sessions]);

  const sessionMap = useMemo(() => {
    const m: Record<string, { _id: string; directory: string; titre: string }> = {};
    sessions.forEach((s) => { m[s._id] = s; });
    return m;
  }, [sessions]);

  const sessionTitles = useMemo(() => {
    const m: Record<string, string> = {};
    sessions.forEach((s) => { m[s._id] = s.titre || s.directory || '—'; });
    return m;
  }, [sessions]);

  // Normalize + filter by directory + filter by status group
  const normalizedTasks = useMemo(() => {
    return tasks
      .map(t => ({
        ...t,
        sessionIdStr: typeof t.sessionId === 'string' ? t.sessionId : (t.sessionId as any)?._id || '',
      }))
      .filter(t => {
        // Directory filter
        if (selectedDirectory) {
          const sess = sessionMap[t.sessionIdStr];
          if (!sess || sess.directory !== selectedDirectory) return false;
        }
        // Status group filter
        if (!matchesFilter(t.status, selectedFilter)) return false;
        return true;
      });
  }, [tasks, selectedDirectory, selectedFilter, sessionMap]);

  const handleDelete = (id: string) => { if (confirm('Supprimer cette tâche ?')) deleteTask.mutate(id); };
  const handleSkip = (id: string) => skipTask.mutate(id);
  const handleResume = (id: string) => resumeTask.mutate(id);
  const handleViewTask = (task: Task) => setSelectedTask(task);

  if (sessLoading || tasksLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-indigo-400 border-t-transparent" />
          <p className="text-sm text-slate-400">Chargement…</p>
        </div>
      </div>
    );
  }

  if (sessError || tasksError) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-8 py-6 text-center shadow-sm">
          <p className="text-lg font-semibold text-red-700">Erreur de connexion</p>
          <p className="mt-1 text-sm text-red-500">Vérifiez que le backend est lancé.</p>
        </div>
      </div>
    );
  }

  const currentTitle = selectedDirectory
    ? directories.find(d => d === selectedDirectory)?.split('/').pop() || selectedDirectory
    : 'Tous les projets';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      {/* ── Header ───────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-slate-200/40 bg-white/80 backdrop-blur-xl shadow-sm shadow-slate-200/20">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-2.5 gap-3">
          {/* Left: logo + burger menu */}
          <div className="flex items-center gap-2 shrink-0 min-w-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-indigo-600 shadow-sm shadow-indigo-200/50">
              <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h1 className="text-base font-bold tracking-tight hidden sm:block">
              <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">cockpit</span>
              <span className="text-slate-400">AI</span>
            </h1>

            {/* Burger menu */}
            <div className="relative ml-2" ref={burgerRef}>
              <button
                onClick={() => setBurgerOpen(!burgerOpen)}
                className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white/60 px-2.5 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition-all hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/40"
              >
                {/* Hamburger icon */}
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <span className="hidden sm:inline max-w-32 truncate">{currentTitle}</span>
                {/* Active indicator */}
                {selectedDirectory && <span className="h-2 w-2 rounded-full bg-indigo-500" />}
              </button>

              {/* Dropdown menu */}
              {burgerOpen && (
                <div className="absolute left-0 top-full mt-2 w-64 rounded-xl border border-slate-200/80 bg-white shadow-xl shadow-slate-200/40 overflow-hidden z-50">
                  <div className="py-2">
                    <div className="px-4 pb-2 pt-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Projets</p>
                    </div>

                    {/* All projects */}
                    <button
                      onClick={() => { setSelectedDirectory(''); setBurgerOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                        !selectedDirectory
                          ? 'bg-indigo-50 text-indigo-700 font-medium'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z" />
                      </svg>
                      Tous les projets
                    </button>

                    {/* Project list */}
                    {directories.map((d) => {
                      const isActive = selectedDirectory === d;
                      const title = d.split('/').pop() || d;
                      return (
                        <button
                          key={d}
                          onClick={() => { setSelectedDirectory(d); setBurgerOpen(false); }}
                          className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                            isActive
                              ? 'bg-indigo-50 text-indigo-700 font-medium'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.25-4.5h3m-3 0a2.25 2.25 0 012.25 2.25v0a2.25 2.25 0 01-2.25 2.25m-3 0a2.25 2.25 0 012.25 2.25v0a2.25 2.25 0 01-2.25 2.25" />
                          </svg>
                          <span className="truncate">{title}</span>
                        </button>
                      );
                    })}

                    {/* Divider */}
                    <div className="my-1 border-t border-slate-100" />

                    {/* New project */}
                    <button
                      onClick={() => { setShowNewSession(true); setBurgerOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-50"
                    >
                      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      Nouveau projet
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: view toggle + new task */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Table/Cards toggle — hidden on mobile */}
            <div className="hidden sm:flex items-center gap-0.5 rounded-lg bg-slate-100/80 p-0.5">
              <button
                onClick={() => setViewMode('table')}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${viewMode === 'table' ? 'bg-white text-slate-800 shadow-sm ring-1 ring-slate-200/60' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Tableau
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${viewMode === 'cards' ? 'bg-white text-slate-800 shadow-sm ring-1 ring-slate-200/60' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Cartes
              </button>
            </div>

            {/* New task button */}
            <button
              onClick={() => setShowNewTask(true)}
              className="group flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-md shadow-indigo-200/50 transition-all hover:shadow-lg hover:shadow-indigo-300/50 hover:scale-[1.02] active:scale-[0.98]"
            >
              <svg className="h-3.5 w-3.5 transition-transform group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">Nouvelle tâche</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-5">
        {/* ── Filters (status pills only) ──────────── */}
        <FilterBar
          selectedFilter={selectedFilter}
          onFilterChange={setSelectedFilter}
        />

        {/* ── Content ──────────────────────────────── */}
        {normalizedTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 text-indigo-400 shadow-inner">
              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z" />
              </svg>
            </div>
            <h3 className="mb-1 text-lg font-semibold text-slate-800">Aucune tâche</h3>
            <p className="mb-5 text-sm text-slate-400">
              {sessions.length === 0
                ? 'Créez un premier projet pour lancer vos agents.'
                : 'Ajoutez une tâche ou ajustez vos filtres.'}
            </p>
            {sessions.length === 0 ? (
              <button
                onClick={() => setShowNewSession(true)}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-200 transition hover:shadow-xl hover:shadow-indigo-300"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Créer un projet
              </button>
            ) : (
              <button
                onClick={() => setShowNewTask(true)}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-200 transition hover:shadow-xl hover:shadow-indigo-300"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Créer une tâche
              </button>
            )}
          </div>
        ) : effectiveView === 'table' ? (
          <TaskTable
            tasks={normalizedTasks}
            sessionTitles={sessionTitles}
            onDelete={handleDelete}
            onSkip={handleSkip}
            onResume={handleResume}
            onView={handleViewTask}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {normalizedTasks.map((t) => (
              <TaskCard
                key={t._id}
                task={t}
                onDelete={handleDelete}
                onSkip={handleSkip}
                onResume={handleResume}
                onView={handleViewTask}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── Modals ─────────────────────────────────── */}
      {showNewSession && (
        <NewSessionModal
          onClose={() => setShowNewSession(false)}
          onSubmit={(data) => {
            createSession.mutate(data);
            setShowNewTask(true);
          }}
        />
      )}
      {showNewTask && (
        <NewTaskModal
          sessions={sessions}
          onClose={() => setShowNewTask(false)}
          onSubmit={(data) => createTask.mutate(data)}
        />
      )}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          session={typeof selectedTask.sessionId === 'string'
            ? (sessionMap[selectedTask.sessionId] as any)
            : (selectedTask.sessionId as any)}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}
