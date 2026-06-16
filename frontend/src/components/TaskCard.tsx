import React from 'react';
import type { Task } from '../types';
import { StatusBadge } from './StatusBadge';

interface TaskCardProps {
  task: Task;
  session?: { _id: string; directory: string; titre: string };
  onDelete: (id: string) => void;
  onSkip: (id: string) => void;
  onResume: (id: string) => void;
  onView: (task: Task) => void;
}

function fmtDate(raw?: string) {
  if (!raw) return '—';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function getSessionId(t: Task): string {
  if (typeof t.sessionId === 'string') return t.sessionId;
  return (t.sessionId as any)?._id ?? '';
}

// Agent colors + left border accent
const AGENT_COLORS: Record<string, string> = {
  hermes: 'bg-indigo-50 text-indigo-600 ring-indigo-100',
  claude: 'bg-violet-50 text-violet-600 ring-violet-100',
  vibe: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  opencode: 'bg-sky-50 text-sky-600 ring-sky-100',
  antigravity: 'bg-amber-50 text-amber-600 ring-amber-100',
};

const AGENT_BORDER: Record<string, string> = {
  hermes: 'border-l-indigo-400',
  claude: 'border-l-violet-400',
  vibe: 'border-l-emerald-400',
  opencode: 'border-l-sky-400',
  antigravity: 'border-l-amber-400',
};

export const TaskCard: React.FC<TaskCardProps> = ({ task, session, onDelete, onSkip, onResume, onView }) => {
  const titre = session?.titre || session?.directory || '—';
  const borderAccent = AGENT_BORDER[task.agent] || 'border-l-slate-300';

  return (
    <div
      className={`group flex flex-col rounded-xl border border-slate-200/50 border-l-4 ${borderAccent} bg-white shadow-sm transition-all duration-300 hover:border-slate-250 hover:shadow-lg hover:shadow-slate-200/60 hover:-translate-y-0.5 cursor-pointer`}
      onClick={() => onView(task)}
    >
      <div className="p-4 pb-2">
        {/* Top row: project name + badge */}
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-slate-700">{titre}</p>
            <div className="mt-1 flex items-center gap-2">
              <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${AGENT_COLORS[task.agent] || 'bg-slate-50 text-slate-600 ring-slate-100'}`}>
                {task.agent}
              </span>
              <span className="text-[11px] text-slate-400">{fmtDate(task.createdAt)}</span>
            </div>
          </div>
          <StatusBadge status={task.status} />
        </div>

        {/* Prompt */}
        <p className="mb-3 line-clamp-2 text-sm leading-relaxed text-slate-500">{task.prompt}</p>

        {/* Subtasks badge */}
        {task.subtasks && task.subtasks.length > 0 && (
          <div className="mb-2 inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-500">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            {task.subtasks.length} sous-tâche{task.subtasks.length > 1 ? 's' : ''}
          </div>
        )}

        {/* Error preview */}
        {task.status === 'failed' && task.result && (
          <div className="mt-1 rounded-md border border-rose-200/50 bg-rose-50/50 px-3 py-1.5 text-[11px] text-rose-500 truncate" title={task.result}>
            ⚠ {task.result.replace(/^Error:\s*/i, '').substring(0, 60)}
          </div>
        )}

        {/* Success indicator */}
        {task.status === 'success' && (
          <div className="mt-1 inline-flex items-center gap-1 rounded-md border border-emerald-200/50 bg-emerald-50/50 px-2.5 py-1 text-[11px] font-medium text-emerald-600">
            ✓ Terminée
          </div>
        )}
      </div>

      {/* Action buttons — stop propagation so they don't open detail modal */}
      <div className="mt-auto flex items-center gap-1.5 border-t border-slate-100/60 px-4 py-2 opacity-0 transition-opacity group-hover:opacity-100">
        {(task.status === 'pending' || task.status === 'failed') && (
          <button
            onClick={(e) => { e.stopPropagation(); onSkip(task._id); }}
            className="rounded-md px-2.5 py-1 text-[11px] font-medium text-amber-600 transition-colors hover:bg-amber-50"
          >
            Ignorer
          </button>
        )}
        {(task.status === 'skipped' || task.status === 'failed') && (
          <button
            onClick={(e) => { e.stopPropagation(); onResume(task._id); }}
            className="rounded-md px-2.5 py-1 text-[11px] font-medium text-blue-600 transition-colors hover:bg-blue-50"
          >
            Reprendre
          </button>
        )}
        <div className="flex-1" />
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(task._id); }}
          className="rounded-md px-2.5 py-1 text-[11px] font-medium text-rose-500 transition-colors hover:bg-rose-50"
        >
          Supprimer
        </button>
      </div>
    </div>
  );
};
