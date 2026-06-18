import { useMemo, useState, useRef, useEffect as useReactEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Task, Session, TaskStatus } from './types';
import {
  useSessions,
  useTasks,
  useDeleteTask,
  useSkipTask,
  useResumeTask,
  useCreateSession,
  useCreateTask,
  KEYS,
} from './hooks/useTasks';
import { useDarkMode } from './hooks/useDarkMode';
import { FilterBar } from './components/FilterBar';
import { TaskTable } from './components/TaskTable';
import { TaskCard } from './components/TaskCard';
import { TaskDetailModal } from './components/TaskDetailModal';
import { NewSessionModal } from './components/NewSessionModal';
import { NewTaskModal } from './components/NewTaskModal';
import { LogoPunchline } from './components/LogoPunchline';
import { ThemeToggle } from './components/ThemeToggle';
import { AgentSelector, getAgentConfig } from './components/AgentSelector';
import { FolderOpen, Plus, Send, Menu, ChevronDown } from 'lucide-react';
import type { AgentType } from './types';

const AGENTS: { id: AgentType; label: string }[] = [
  { id: 'hermes', label: 'Hermes' },
  { id: 'vibe', label: 'Vibe' },
  { id: 'claude', label: 'Claude' },
  { id: 'opencode', label: 'OpenCode' },
  { id: 'antigravity', label: 'Antigravity' },
];

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
  const { isDark } = useDarkMode();
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards');
  const [selectedDirectory, setSelectedDirectory] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<FilterMode>('');
  const [showNewSession, setShowNewSession] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [burgerOpen, setBurgerOpen] = useState(false);

  const [quickPrompt, setQuickPrompt] = useState('');
  const [quickAgent, setQuickAgent] = useState<AgentType>('hermes');
  const [quickAgentOpen, setQuickAgentOpen] = useState(false);
  const quickAgentRef = useRef<HTMLDivElement>(null);
  const quickInputRef = useRef<HTMLInputElement>(null);
  const tasksContainerRef = useRef<HTMLDivElement>(null);
  const prevSelectedDirectory = useRef('');

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

  useReactEffect(() => {
    if (!quickAgentOpen) return;
    const handler = (e: MouseEvent) => {
      if (quickAgentRef.current && !quickAgentRef.current.contains(e.target as Node)) {
        setQuickAgentOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [quickAgentOpen]);

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

  const sessionMap = useMemo(() => {
    const m: Record<string, { _id: string; directory: string; titre: string }> = {};
    sessions.forEach((s: Session) => { m[s._id] = s; });
    return m;
  }, [sessions]);

  const sessionTitles = useMemo(() => {
    const m: Record<string, string> = {};
    sessions.forEach((s: Session) => { m[s._id] = s.titre || s.directory || '—'; });
    return m;
  }, [sessions]);

  const selectedSessionId = useMemo(() => {
    if (!selectedDirectory) return '';
    const found = sessions.find((s: Session) => s.directory === selectedDirectory);
    return found?._id ?? '';
  }, [sessions, selectedDirectory]);

  const normalizedTasks = useMemo(() => {
    return tasks
      .map((t: Task) => ({
        ...t,
        sessionIdStr: typeof t.sessionId === 'string' ? t.sessionId : (t.sessionId as any)?._id || '',
      }))
      .filter((t: { sessionIdStr: string; status: TaskStatus } & Task) => {
        if (selectedDirectory) {
          const sess = sessionMap[t.sessionIdStr];
          if (!sess || (sess.directory || '') !== selectedDirectory) return false;
        }
        if (!matchesFilter(t.status, selectedFilter)) return false;
        return true;
      });
  }, [tasks, selectedDirectory, selectedFilter, sessionMap]);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (tasksContainerRef.current) {
        tasksContainerRef.current.scrollTop = tasksContainerRef.current.scrollHeight;
      }
    });
  };
  useReactEffect(() => {
    if (prevSelectedDirectory.current !== selectedDirectory && selectedDirectory) {
      prevSelectedDirectory.current = selectedDirectory;
      scrollToBottom();
    } else {
      prevSelectedDirectory.current = selectedDirectory;
    }
  }, [selectedDirectory, normalizedTasks.length]);

  const handleDelete = (id: string) => { if (confirm('Supprimer cette tâche ?')) deleteTask.mutate(id); };
  const handleSkip = (id: string) => skipTask.mutate(id);
  const handleResume = (id: string) => resumeTask.mutate(id);
  const handleViewTask = (task: Task) => setSelectedTask(task);

  const handleQuickSend = () => {
    if (!selectedSessionId || !quickPrompt.trim()) return;
    createTask.mutate({ sessionId: selectedSessionId, prompt: quickPrompt.trim(), agent: quickAgent }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: KEYS.tasks });
        queryClient.invalidateQueries({ queryKey: KEYS.sessions });
      }
    });
    setQuickPrompt('');
  };

  if (sessLoading || tasksLoading) {
    return (
      <div className={`flex h-screen items-center justify-center ${isDark ? 'bg-slate-900' : 'bg-gradient-to-br from-slate-100 via-white to-indigo-100'}`}>
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-400 border-t-transparent" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Chargement des tâches...</p>
          <div className="flex gap-1">
            <div className="h-2 w-2 animate-bounce rounded-full bg-indigo-300" style={{ animationDelay: '0ms' }} />
            <div className="h-2 w-2 animate-bounce rounded-full bg-indigo-300" style={{ animationDelay: '150ms' }} />
            <div className="h-2 w-2 animate-bounce rounded-full bg-indigo-300" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  if (sessError || tasksError) {
    return (
      <div className={`flex h-screen items-center justify-center ${isDark ? 'bg-slate-900' : 'bg-gradient-to-br from-slate-100 via-white to-indigo-100'}`}>
        <div className="rounded-2xl border border-red-300 dark:border-red-700/50 bg-red-50 dark:bg-red-900/30 px-8 py-6 text-center shadow-sm dark:shadow-red-700/30">
          <p className="text-lg font-semibold text-red-700 dark:text-red-400">Erreur de connexion</p>
          <p className="mt-1 text-sm text-red-500 dark:text-red-400/80">Vérifiez que le backend est lancé.</p>
        </div>
      </div>
    );
  }

  const currentSession = sessions.find(s => s.directory === selectedDirectory);
  const currentTitle = currentSession?.titre || selectedDirectory?.split('/').pop() || selectedDirectory || 'Tous les projets';

  return (
    <div className={`flex flex-col h-screen overflow-hidden ${isDark ? 'dark bg-slate-900' : 'bg-gradient-to-br from-slate-100 via-white to-indigo-100'}`}>
      <header className="shrink-0 z-50 isolate border-b border-slate-300/40 dark:border-slate-700/40 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl shadow-sm shadow-slate-200/20 dark:shadow-slate-700/20">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-2.5 gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 shrink-0 min-w-0">
            <div className="flex items-center gap-2">
              <LogoPunchline />
              <h1 className="text-base font-bold tracking-tight truncate max-w-[160px] sm:max-w-none">
                <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">cockpit</span>
                <span className="text-slate-600 dark:text-slate-400">AI</span>
              </h1>
              <div className="relative ml-2" ref={burgerRef}>
                <button
                  onClick={() => setBurgerOpen(!burgerOpen)}
                  className="flex items-center gap-2 rounded-lg border border-slate-300/80 dark:border-slate-700/80 bg-white/60 dark:bg-slate-800/60 px-2.5 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 shadow-sm transition-all hover:border-indigo-300 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50/40 dark:hover:bg-slate-700/40"
                >
                  <Menu className="h-4 w-4" />
                  <span className="max-w-48 truncate">{currentTitle}</span>
                  <ChevronDown className="h-3 w-3 ml-auto shrink-0" />
                </button>

                {selectedDirectory && (
                  <span className="hidden sm:inline-block text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-slate-700 px-2 py-0.5 rounded-lg truncate max-w-[200px]">
                    {selectedDirectory}
                  </span>
                )}

                {burgerOpen && (
                  <div className="absolute left-0 top-full mt-2 w-64 rounded-xl border border-slate-300/80 dark:border-slate-700/80 bg-white dark:bg-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-slate-700/40 overflow-hidden z-[60]">
                    <div className="py-2">
                      <div className="px-4 pb-2 pt-1">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Projets</p>
                      </div>
                      <button
                        onClick={() => { setSelectedDirectory(''); setBurgerOpen(false); }}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                          !selectedDirectory
                            ? 'bg-indigo-50 dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 font-medium'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                        }`}
                      >
                        Tous les projets
                      </button>
                      {sessions
                        .filter(s => s.directory)
                        .map((s) => {
                          const isActive = selectedDirectory === s.directory;
                          const title = s.titre || s.directory.split('/').pop() || s.directory;
                          return (
                            <button
                              key={s._id}
                              onClick={() => { setSelectedDirectory(s.directory); setBurgerOpen(false); }}
                              className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                                isActive
                                  ? 'bg-indigo-50 dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 font-medium'
                                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                              }`}
                            >
                              <span className="truncate">{title}</span>
                            </button>
                          );
                        })}
                      <div className="my-1 border-t border-slate-200 dark:border-slate-700/50" />
                      <button
                        onClick={() => { setShowNewSession(true); setBurgerOpen(false); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 transition-colors hover:bg-indigo-50 dark:hover:bg-slate-700/50"
                      >
                        <Plus className="h-4 w-4 shrink-0" />
                        Nouveau projet
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {selectedDirectory && (
              <span className="sm:hidden text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-slate-700 px-2 py-0.5 rounded-lg truncate">
                {selectedDirectory}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <div className="hidden sm:flex items-center gap-0.5 rounded-lg bg-slate-200/80 dark:bg-slate-700/80 p-0.5">
              <button
                onClick={() => setViewMode('table')}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                  viewMode === 'table' ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-200 shadow-sm ring-1 ring-slate-300/60 dark:ring-slate-600/60' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                Tableau
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                  viewMode === 'cards' ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-200 shadow-sm ring-1 ring-slate-300/60 dark:ring-slate-600/60' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                Cartes
              </button>
            </div>
            {!selectedDirectory && (
              <button
                onClick={() => setShowNewTask(true)}
                className="group flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-md shadow-indigo-200/50 dark:shadow-indigo-700/50 transition-all hover:shadow-lg hover:shadow-indigo-300/50 dark:hover:shadow-indigo-500/50"
              >
                <Plus className="h-3.5 w-3.5 transition-transform group-hover:scale-110" />
                <span className="hidden sm:inline">Nouvelle tâche</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main ref={tasksContainerRef} className="flex-1 overflow-y-auto w-full">
        <div className="sticky top-0 z-30 bg-gradient-to-br from-slate-100 via-white to-indigo-100 dark:bg-slate-800/90 dark:backdrop-blur-xl px-4 pt-3 pb-2">
          <div className="mx-auto max-w-7xl">
            <FilterBar selectedFilter={selectedFilter} onFilterChange={setSelectedFilter} />
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 pb-24">
          {normalizedTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-slate-700 dark:to-slate-600 text-indigo-500 dark:text-indigo-400 shadow-inner">
                <FolderOpen className="h-10 w-10" />
              </div>
              <h3 className="mb-1 text-lg font-semibold text-slate-800 dark:text-slate-200">Aucune tâche</h3>
              <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">
                {sessions.length === 0 ? 'Créez un premier projet pour lancer vos agents.' : 'Ajoutez une tâche ou ajustez vos filtres.'}
              </p>
              {sessions.length === 0 ? (
                <button
                  onClick={() => setShowNewSession(true)}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-700 transition hover:shadow-xl hover:shadow-indigo-300 dark:hover:shadow-indigo-700"
                >
                  <Plus className="h-4 w-4" />
                  Créer un projet
                </button>
              ) : !selectedDirectory && (
                <button
                  onClick={() => setShowNewTask(true)}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-700 transition hover:shadow-xl hover:shadow-indigo-300 dark:hover:shadow-indigo-700"
                >
                  <Plus className="h-4 w-4" />
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
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {normalizedTasks.map((t: Task & { sessionIdStr: string }) => (
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
        </div>
      </main>

      {selectedDirectory && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-6 sm:right-6 md:left-8 md:right-8 lg:left-1/2 lg:-translate-x-1/2 lg:max-w-2xl z-40 rounded-2xl border border-slate-300/60 dark:border-slate-700/60 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl shadow-lg shadow-slate-300/30 dark:shadow-slate-700/30 transform translate-z-0">
          <div className="px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="relative shrink-0" ref={quickAgentRef}>
                <AgentSelector value={quickAgent} onChange={setQuickAgent} variant="compact" showLabel={false} onClick={() => setQuickAgentOpen(!quickAgentOpen)} />
                {quickAgentOpen && (
                  <div className="absolute bottom-full left-0 mb-2 w-48 rounded-xl border border-slate-300/80 dark:border-slate-600 bg-white dark:bg-slate-700 shadow-xl shadow-slate-200/40 dark:shadow-slate-700/40 overflow-hidden z-[60]">
                    <div className="py-1">
                      {AGENTS.map((a) => {
                        const AgentIcon = getAgentConfig(a.id)?.icon || Plus;
                        return (
                          <button
                            key={a.id}
                            onClick={() => { setQuickAgent(a.id); setQuickAgentOpen(false); }}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                              quickAgent === a.id
                                ? 'bg-indigo-50 dark:bg-slate-600 text-indigo-700 dark:text-indigo-300 font-medium'
                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600/50'
                            }`}
                          >
                            <AgentIcon className="h-4 w-4" />
                            <span>{a.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              <input
                ref={quickInputRef}
                type="text"
                value={quickPrompt}
                onChange={(e) => setQuickPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && quickPrompt.trim()) handleQuickSend(); }}
                placeholder="Décrivez la tâche…"
                className="flex-1 rounded-lg border border-slate-300/80 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 shadow-sm transition focus:border-indigo-300 dark:focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-700/50"
              />
              <button
                onClick={handleQuickSend}
                disabled={!quickPrompt.trim()}
                className="rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 p-2 text-white shadow-sm transition hover:shadow-md disabled:opacity-30 active:scale-95 dark:shadow-indigo-700/50 cursor-pointer"
                aria-label="Envoyer"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {showNewSession && (
        <NewSessionModal
          onClose={() => setShowNewSession(false)}
          onSubmit={(data) => {
            createSession.mutate(data, {
              onSuccess: () => {
                setSelectedDirectory(data.directory);
                queryClient.invalidateQueries({ queryKey: KEYS.sessions });
              },
            });
            setShowNewSession(false);
          }}
        />
      )}
      {showNewTask && (
        <NewTaskModal
          sessions={sessions}
          onClose={() => setShowNewTask(false)}
          onSubmit={(data) => createTask.mutate(data, {
            onSuccess: () => {
              queryClient.invalidateQueries({ queryKey: KEYS.tasks });
            }
          })}
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
