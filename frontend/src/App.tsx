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
import { ChatView } from './components/ChatView';
import { TaskDetailModal } from './components/TaskDetailModal';
import { NewSessionModal } from './components/NewSessionModal';
import { NewTaskModal } from './components/NewTaskModal';
import { AppHeader } from './components/AppHeader';
import { QuickInputBar } from './components/QuickInputBar';
import { FolderOpen, Plus } from 'lucide-react';
import type { AgentType } from './types';

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
  const [viewMode, setViewMode] = useState<'table' | 'cards' | 'chat'>(
    () => (localStorage.getItem('cockpitai_viewmode') as 'table' | 'cards' | 'chat') || 'cards'
  );
  useReactEffect(() => { localStorage.setItem('cockpitai_viewmode', viewMode); }, [viewMode]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [newChatDirectory, setNewChatDirectory] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<FilterMode>('');
  const [showNewSession, setShowNewSession] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const [keyboardOffset, setKeyboardOffset] = useState(0);
  useReactEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setKeyboardOffset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update); };
  }, []);

  const [quickPrompt, setQuickPrompt] = useState('');
  const [quickAgent, setQuickAgent] = useState<AgentType>('hermes');
  const tasksContainerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const prevSelectedSessionId = useRef('');

  const [isMobile, setIsMobile] = useState(false);
  useReactEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const effectiveView = isMobile ? 'chat' : viewMode;

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

  const selectedDirectory = useMemo(() => {
    if (!selectedSessionId) return '';
    return sessions.find((s: Session) => s._id === selectedSessionId)?.directory ?? '';
  }, [sessions, selectedSessionId]);

  const normalizedTasks = useMemo(() => {
    return tasks
      .map((t: Task) => ({
        ...t,
        sessionIdStr: typeof t.sessionId === 'string' ? t.sessionId : (t.sessionId as any)?._id || '',
      }))
      .filter((t: { sessionIdStr: string; status: TaskStatus } & Task) => {
        if (selectedSessionId && t.sessionIdStr !== selectedSessionId) return false;
        if (!matchesFilter(t.status, selectedFilter)) return false;
        return true;
      });
  }, [tasks, selectedSessionId, selectedFilter]);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (tasksContainerRef.current) {
        tasksContainerRef.current.scrollTop = tasksContainerRef.current.scrollHeight;
      }
    });
  };
  useReactEffect(() => {
    if (prevSelectedSessionId.current !== selectedSessionId && selectedSessionId) {
      prevSelectedSessionId.current = selectedSessionId;
      scrollToBottom();
    } else {
      prevSelectedSessionId.current = selectedSessionId;
    }
  }, [selectedSessionId, normalizedTasks.length]);

  const handleDelete = (id: string) => { deleteTask.mutate(id); };
  const handleSkip = (id: string) => skipTask.mutate(id);
  const handleResume = (id: string) => resumeTask.mutate(id);
  const handleViewTask = (task: Task) => setSelectedTask(task);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isMobile || !selectedSessionId) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) < 60 || Math.abs(dy) >= Math.abs(dx)) return;
    const projectChats = [...sessions]
      .filter((s: Session) => s.directory === selectedDirectory)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const idx = projectChats.findIndex((s: Session) => s._id === selectedSessionId);
    if (idx === -1 || projectChats.length < 2) return;
    const next = dx < 0
      ? projectChats[(idx + 1) % projectChats.length]
      : projectChats[(idx - 1 + projectChats.length) % projectChats.length];
    setSelectedSessionId(next._id);
  };

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
      <div className={`flex h-[100dvh] items-center justify-center ${isDark ? 'bg-slate-900' : 'bg-gradient-to-br from-slate-100 via-white to-indigo-100'}`}>
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
      <div className={`flex h-[100dvh] items-center justify-center ${isDark ? 'bg-slate-900' : 'bg-gradient-to-br from-slate-100 via-white to-indigo-100'}`}>
        <div className="rounded-2xl border border-red-300 dark:border-red-700/50 bg-red-50 dark:bg-red-900/30 px-8 py-6 text-center shadow-sm dark:shadow-red-700/30">
          <p className="text-lg font-semibold text-red-700 dark:text-red-400">Erreur de connexion</p>
          <p className="mt-1 text-sm text-red-500 dark:text-red-400/80">Vérifiez que le backend est lancé.</p>
        </div>
      </div>
    );
  }

  const currentSession = sessions.find((s: Session) => s._id === selectedSessionId);
  const currentTitle = currentSession?.titre || 'Tous les chats';

  return (
    <div className={`relative flex flex-col h-[100dvh] overflow-hidden ${isDark ? 'dark bg-slate-900' : 'bg-gradient-to-br from-slate-100 via-white to-indigo-100'}`}>
      <AppHeader
        currentTitle={currentTitle}
        sessions={sessions}
        selectedSessionId={selectedSessionId}
        selectedDirectory={selectedDirectory}
        onSelectSession={setSelectedSessionId}
        onNewProject={() => { setNewChatDirectory(''); setShowNewSession(true); }}
        onNewChat={(dir) => { setNewChatDirectory(dir); setShowNewSession(true); }}
        viewMode={viewMode}
        onViewChange={setViewMode}
        onNewTask={() => setShowNewTask(true)}
      />

      <main
        ref={tasksContainerRef}
        className="flex-1 min-h-0 overflow-y-auto w-full"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="sticky top-0 z-30 px-4 pt-3 pb-2">
          <div className="mx-auto max-w-7xl">
            <FilterBar selectedFilter={selectedFilter} onFilterChange={setSelectedFilter} />
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 pb-32">
          {effectiveView === 'chat' ? (
            <ChatView
              tasks={normalizedTasks}
              onSkip={handleSkip}
              onResume={handleResume}
              onDelete={handleDelete}
              onClick={handleViewTask}
            />
          ) : normalizedTasks.length === 0 ? (
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
              ) : !selectedSessionId && (
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

      {selectedSessionId && (
        <QuickInputBar
          agent={quickAgent}
          onAgentChange={setQuickAgent}
          prompt={quickPrompt}
          onPromptChange={setQuickPrompt}
          onSend={handleQuickSend}
          isPending={createTask.isPending}
          keyboardOffset={keyboardOffset}
        />
      )}

      {showNewSession && (
        <NewSessionModal
          defaultDirectory={newChatDirectory}
          onClose={() => setShowNewSession(false)}
          onSubmit={(data) => {
            createSession.mutate(data, {
              onSuccess: (result: any) => {
                const newId = result?.session?._id;
                if (newId) setSelectedSessionId(newId);
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
