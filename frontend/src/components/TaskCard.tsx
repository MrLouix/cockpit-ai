import React from 'react';
import type { Task } from '../types';

interface TaskCardProps {
  task: Task;
  onDelete: (id: string) => void;
  onSkip: (id: string) => void;
  onResume: (id: string) => void;
  onView: (task: Task) => void;
}

const STATUS_BG: Record<string, string> = {
  pending:  'bg-white border-slate-200/50',
  running:  'bg-blue-50/80 border-blue-200/50',
  success:  'bg-emerald-50/80 border-emerald-200/50',
  failed:   'bg-rose-50/80 border-rose-200/50',
  pause:    'bg-amber-50/80 border-amber-200/50',
  skipped:  'bg-yellow-50/80 border-yellow-200/50',
};

export const TaskCard: React.FC<TaskCardProps> = ({ task, onDelete, onSkip, onResume, onView }) => {
  const bg = STATUS_BG[task.status] || 'bg-white border-slate-200/50';

  return (
    <div
      className={`group flex flex-col rounded-xl border ${bg} shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer`}
      onClick={() => onView(task)}
    >
      <div className="px-4 py-3">
        {/* Prompt */}
        <p className="text-sm leading-snug text-slate-700">{task.prompt}</p>

        {/* Result */}
        {task.result && (
          <div className="mt-2 rounded-lg bg-white/60 px-3 py-2 text-[12px] leading-relaxed text-slate-500 whitespace-pre-wrap max-h-24 overflow-y-auto">
            {task.result}
          </div>
        )}
      </div>

      {/* Subtasks pill */}
      {task.subtasks && task.subtasks.length > 0 && (
        <div className="px-4 pb-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100/60 px-2 py-0.5 text-[11px] font-medium text-slate-500">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            {task.subtasks.length} sous-tâche{task.subtasks.length > 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-auto flex items-center gap-1.5 border-t border-slate-100/40 px-4 py-1.5 opacity-0 transition-opacity group-hover:opacity-100">
        {(task.status === 'pending' || task.status === 'failed') && (
          <button
            onClick={(e) => { e.stopPropagation(); onSkip(task._id); }}
            className="rounded-md px-2 py-0.5 text-[11px] font-medium text-amber-600 hover:bg-amber-50 transition-colors"
          >
            Ignorer
          </button>
        )}
        {(task.status === 'skipped' || task.status === 'failed') && (
          <button
            onClick={(e) => { e.stopPropagation(); onResume(task._id); }}
            className="rounded-md px-2 py-0.5 text-[11px] font-medium text-blue-600 hover:bg-blue-50 transition-colors"
          >
            Reprendre
          </button>
        )}
        <div className="flex-1" />
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(task._id); }}
          className="rounded-md px-2 py-0.5 text-[11px] font-medium text-rose-500 hover:bg-rose-50 transition-colors"
        >
          Supprimer
        </button>
      </div>
    </div>
  );
};
