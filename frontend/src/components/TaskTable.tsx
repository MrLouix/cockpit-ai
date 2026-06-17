import React from 'react';
import type { Task } from '../types';
import { StatusBadge } from './StatusBadge';

interface TaskTableProps {
  tasks: Task[];
  sessionTitles: Record<string, string>;
  onDelete: (id: string) => void;
  onSkip: (id: string) => void;
  onResume: (id: string) => void;
  onView: (task: Task) => void;
}

function fmtDate(raw?: string) {
  if (!raw) return '—';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function getSessionId(t: Task): string {
  if (typeof t.sessionId === 'string') return t.sessionId;
  return (t.sessionId as any)?._id ?? '';
}

const AGENT_COLORS: Record<string, string> = {
  hermes: 'bg-indigo-50 text-indigo-600 ring-indigo-100',
  claude: 'bg-violet-50 text-violet-600 ring-violet-100',
  vibe: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  opencode: 'bg-sky-50 text-sky-600 ring-sky-100',
  antigravity: 'bg-amber-50 text-amber-600 ring-amber-100',
};

export const TaskTable: React.FC<TaskTableProps> = ({
  tasks,
  sessionTitles,
  onDelete,
  onSkip,
  onResume,
  onView,
}) => {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/50 dark:border-slate-700/50 bg-white dark:bg-slate-800 shadow-sm shadow-slate-100/40 dark:shadow-slate-700/40">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-700/50 text-sm">
          <thead className="sticky top-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-slate-800/60">
            <tr>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-700/50">Projet</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-700/50">Prompt</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-700/50">Agent</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-700/50">Statut</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-700/50 hidden sm:table-cell">Créé le</th>
              <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-700/50">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-700/40">
            {tasks.map((t) => {
              const sid = getSessionId(t);
              const title = sessionTitles[sid] || '—';
              return (
                <tr
                  key={t._id}
                  className="group/row transition-colors cursor-pointer hover:bg-indigo-50/30 dark:hover:bg-slate-700/40"
                  onClick={() => onView(t)}
                >
                  <td className="max-w-[140px] truncate px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300">{title}</td>
                  <td className="max-w-[200px] truncate px-4 py-2.5 text-slate-500 dark:text-slate-400">{t.prompt}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${AGENT_COLORS[t.agent] || 'bg-slate-50 dark:bg-slate-700/40 text-slate-600 dark:text-slate-300 ring-slate-100 dark:ring-slate-600/50'}`}>{t.agent}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-[11px] text-slate-400 dark:text-slate-500 hidden sm:table-cell">{fmtDate(t.createdAt)}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-right">
                    <div className="flex justify-end gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
                      {(t.status === 'pending' || t.status === 'failed') && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onSkip(t._id); }}
                          className="rounded-md p-1.5 text-amber-500 dark:text-amber-400 transition hover:bg-amber-50 dark:hover:bg-amber-900/30 hover:text-amber-600 dark:hover:text-amber-300"
                          title="Ignorer"
                          aria-label="Ignorer"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 5v7m0 0v7m0-7h-7m7 0H17" />
                          </svg>
                        </button>
                      )}
                      {(t.status === 'skipped' || t.status === 'failed') && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onResume(t._id); }}
                          className="rounded-md p-1.5 text-blue-500 dark:text-blue-400 transition hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-300"
                          title="Reprendre"
                          aria-label="Reprendre"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(t._id); }}
                        className="rounded-md p-1.5 text-rose-400 dark:text-rose-400 transition hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-600 dark:hover:text-rose-300"
                        title="Supprimer"
                        aria-label="Supprimer"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
