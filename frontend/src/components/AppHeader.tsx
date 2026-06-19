import { useState, useRef } from 'react';
import { Menu, ChevronDown, Plus, MessageSquare, Folder } from 'lucide-react';
import type { Session } from '../types';
import { useClickOutside } from '../hooks/useClickOutside';
import { LogoPunchline } from './LogoPunchline';
import { ThemeToggle } from './ThemeToggle';

interface AppHeaderProps {
  currentTitle: string;
  sessions: Session[];
  selectedSessionId: string;
  selectedDirectory: string;
  onSelectSession: (id: string) => void;
  onNewProject: () => void;
  onNewChat: (dir: string) => void;
  viewMode: 'table' | 'cards' | 'chat';
  onViewChange: (mode: 'table' | 'cards' | 'chat') => void;
  onNewTask: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  currentTitle, sessions, selectedSessionId, selectedDirectory,
  onSelectSession, onNewProject, onNewChat,
  viewMode, onViewChange, onNewTask,
}) => {
  const [burgerOpen, setBurgerOpen] = useState(false);
  const burgerRef = useRef<HTMLDivElement>(null);
  useClickOutside(burgerRef, () => setBurgerOpen(false), burgerOpen);

  const byDirectory = sessions
    .filter(s => s.directory)
    .reduce((acc, s) => {
      (acc[s.directory] ??= []).push(s);
      return acc;
    }, {} as Record<string, Session[]>);

  return (
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
                onClick={() => setBurgerOpen(b => !b)}
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
                <div className="absolute left-0 top-full mt-2 w-72 rounded-xl border border-slate-300/80 dark:border-slate-700/80 bg-white dark:bg-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-slate-700/40 overflow-hidden z-[60]">
                  <div className="py-2">
                    <div className="px-4 pb-2 pt-1">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Projets</p>
                    </div>
                    <button
                      onClick={() => { onSelectSession(''); setBurgerOpen(false); }}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                        !selectedSessionId
                          ? 'bg-indigo-50 dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 font-medium'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      Tous les chats
                    </button>
                    {Object.entries(byDirectory).map(([dir, chats]) => {
                      const projectName = dir.split('/').pop() || dir;
                      return (
                        <div key={dir}>
                          <div className="my-1 border-t border-slate-200 dark:border-slate-700/50" />
                          <div className="flex items-center gap-2 px-4 py-1.5">
                            <Folder className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate">{projectName}</span>
                          </div>
                          {chats.map((s) => {
                            const isActive = selectedSessionId === s._id;
                            return (
                              <button
                                key={s._id}
                                onClick={() => { onSelectSession(s._id); setBurgerOpen(false); }}
                                className={`w-full text-left pl-9 pr-4 py-2 text-sm transition-colors flex items-center gap-2 ${
                                  isActive
                                    ? 'bg-indigo-50 dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 font-medium'
                                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                }`}
                              >
                                <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
                                <span className="truncate">{s.titre}</span>
                              </button>
                            );
                          })}
                          <button
                            onClick={() => { onNewChat(dir); setBurgerOpen(false); }}
                            className="w-full flex items-center gap-2 pl-9 pr-4 py-1.5 text-xs font-medium text-indigo-500 dark:text-indigo-400 transition-colors hover:bg-indigo-50 dark:hover:bg-slate-700/50"
                          >
                            <Plus className="h-3.5 w-3.5 shrink-0" />
                            Nouveau chat
                          </button>
                        </div>
                      );
                    })}
                    <div className="my-1 border-t border-slate-200 dark:border-slate-700/50" />
                    <button
                      onClick={() => { onNewProject(); setBurgerOpen(false); }}
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
              onClick={() => onViewChange('table')}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                viewMode === 'table' ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-200 shadow-sm ring-1 ring-slate-300/60 dark:ring-slate-600/60' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Tableau
            </button>
            <button
              onClick={() => onViewChange('cards')}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                viewMode === 'cards' ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-200 shadow-sm ring-1 ring-slate-300/60 dark:ring-slate-600/60' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Cartes
            </button>
            <button
              onClick={() => onViewChange('chat')}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all flex items-center gap-1 ${
                viewMode === 'chat'
                  ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-200 shadow-sm ring-1 ring-slate-300/60 dark:ring-slate-600/60'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <MessageSquare className="h-3 w-3" />
              Chat
            </button>
          </div>
          {!selectedSessionId && (
            <button
              onClick={() => onNewTask()}
              className="group flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-md shadow-indigo-200/50 dark:shadow-indigo-700/50 transition-all hover:shadow-lg hover:shadow-indigo-300/50 dark:hover:shadow-indigo-500/50"
            >
              <Plus className="h-3.5 w-3.5 transition-transform group-hover:scale-110" />
              <span className="hidden sm:inline">Nouvelle tâche</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
