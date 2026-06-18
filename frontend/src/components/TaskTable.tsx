import React from 'react';
import type { Task } from '../types';
import { StatusBadge } from './StatusBadge';
import { SkipBack, RotateCcw, Trash2 } from 'lucide-react';
import { getAgentColor, getAgentConfig } from './AgentSelector';

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

const ACTION_COLORS: Record<string, { color: string; hoverBg: string }> = {
  pending: { color: 'text-amber-500 dark:text-amber-400', hoverBg: 'hover:bg-amber-50 dark:hover:bg-amber-900/30' },
  running: { color: 'text-amber-500 dark:text-amber-400', hoverBg: 'hover:bg-amber-50 dark:hover:bg-amber-900/30' },
  failed: { color: 'text-blue-500 dark:text-blue-400', hoverBg: 'hover:bg-blue-50 dark:hover:bg-blue-900/30' },
  skipped: { color: 'text-blue-500 dark:text-blue-400', hoverBg: 'hover:bg-blue-50 dark:hover:bg-blue-900/30' },
  pause: { color: 'text-blue-500 dark:text-blue-400', hoverBg: 'hover:bg-blue-50 dark:hover:bg-blue-900/30' },
  success: { color: 'text-emerald-500 dark:text-emerald-400', hoverBg: 'hover:bg-emerald-50 dark:hover:bg-emerald-900/30' },
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
    <div className="overflow-hidden rounded-xl border border-slate-300/50 dark:border-slate-700/50 bg-white dark:bg-slate-800 shadow-sm shadow-slate-100/40 dark:shadow-slate-700/40">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700/50 text-sm">
          <thead className="sticky top-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-slate-800/60 z-10">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700/50">Projet</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700/50">Prompt</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700/50">Agent</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700/50">Statut</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700/50 hidden sm:table-cell">Créé le</th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700/50">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700/40">
            {tasks.map((t) => {
              const sid = getSessionId(t);
              const title = sessionTitles[sid] || '—';
              const agentConfig = getAgentConfig(t.agent);
              const actionConfig = ACTION_COLORS[t.status] || ACTION_COLORS.pending;

              return (
                <tr
                  key={t._id}
                  tabIndex={0}
                  role="button"
                  onClick={() => onView(t)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onView(t);
                    }
                  }}
                  className="group/row transition-colors cursor-pointer hover:bg-indigo-50/30 dark:hover:bg-slate-700/40 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <td className="max-w-[140px] truncate px-4 py-2.5 font-medium text-slate-700 dark:text-slate-300">{title}</td>
                  <td className="max-w-[200px] truncate px-4 py-2.5 text-slate-600 dark:text-slate-400">{t.prompt}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset ${getAgentColor(t.agent)}`}>
                      {agentConfig?.label || t.agent}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400 hidden sm:table-cell">{fmtDate(t.createdAt)}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-right">
                    <div className="flex justify-end gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
                      {(t.status === 'pending' || t.status === 'failed') && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onSkip(t._id); }}
                          className={`rounded-md p-1.5 transition ${actionConfig.color} ${actionConfig.hoverBg}`}
                          title="Ignorer"
                          aria-label="Ignorer"
                        >
                          <SkipBack className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {(t.status === 'skipped' || t.status === 'failed' || t.status === 'pause') && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onResume(t._id); }}
                          className={`rounded-md p-1.5 transition ${actionConfig.color} ${actionConfig.hoverBg}`}
                          title="Reprendre"
                          aria-label="Reprendre"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(t._id); }}
                        className="rounded-md p-1.5 text-rose-400 dark:text-rose-400 transition hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-600 dark:hover:text-rose-300 cursor-pointer"
                        title="Supprimer"
                        aria-label="Supprimer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
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

export default TaskTable;
