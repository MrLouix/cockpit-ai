import React from 'react';
import type { Task } from '../types';
import { Clock, SkipBack, PauseCircle, CheckCircle2, AlertCircle } from 'lucide-react';
import { getAgentBorder, getAgentConfig } from './AgentSelector';

interface TaskCardProps {
  task: Task;
  onDelete: (id: string) => void;
  onSkip: (id: string) => void;
  onResume: (id: string) => void;
  onView: (task: Task) => void;
}

const STATUS_BG: Record<string, string> = {
  pending:  'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700/50',
  running:  'bg-blue-50/80 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700/50',
  success:  'bg-emerald-50/80 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700/50',
  failed:   'bg-rose-50/80 dark:bg-rose-900/30 border-rose-300 dark:border-rose-700/50',
  pause:    'bg-amber-50/80 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700/50',
  skipped:  'bg-yellow-50/80 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700/50',
};

const STATUS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  pending: Clock,
  running: Clock,
  success: CheckCircle2,
  failed: AlertCircle,
  pause: PauseCircle,
  skipped: SkipBack,
};

const STATUS_COLOR: Record<string, string> = {
  pending: 'text-amber-600 dark:text-amber-400',
  running: 'text-blue-600 dark:text-blue-400',
  success: 'text-emerald-600 dark:text-emerald-400',
  failed: 'text-rose-600 dark:text-rose-400',
  pause: 'text-amber-600 dark:text-amber-400',
  skipped: 'text-yellow-600 dark:text-yellow-400',
};

const ACTION_COLORS: Record<string, string> = {
  pending: 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30',
  running: 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30',
  failed: 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30',
  skipped: 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30',
  pause: 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30',
  success: 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30',
};

export const TaskCard: React.FC<TaskCardProps> = ({ task, onDelete, onSkip, onResume, onView }) => {
  const bg = STATUS_BG[task.status] || 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700/50';
  const agentBorder = getAgentBorder(task.agent) || 'border-slate-300 dark:border-slate-700/50';
  const StatusIcon = STATUS_ICON[task.status] || Clock;
  const statusColor = STATUS_COLOR[task.status] || 'text-slate-600 dark:text-slate-400';
  const agentConfig = getAgentConfig(task.agent);

  // Determine available actions
  const canSkip = task.status === 'pending' || task.status === 'failed';
  const canResume = task.status === 'skipped' || task.status === 'failed' || task.status === 'pause';

  return (
    <div
      tabIndex={0}
      role="button"
      onClick={() => onView(task)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onView(task);
        }
      }}
      className={`group flex flex-col rounded-lg border ${agentBorder} ${bg} shadow-sm transition-all duration-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 cursor-pointer`}
      aria-label={`Tâche: ${task.prompt}. Statut: ${task.status}. Agent: ${task.agent}`}
    >
      <div className="px-3 py-2">
        {/* Header with agent icon and status */}
        <div className="flex items-center gap-2 mb-1">
          {agentConfig && (
            <span className={`inline-flex items-center justify-center h-5 w-5 rounded-md ${statusColor} bg-current/10`}>
              {agentConfig.icon && <agentConfig.icon className="h-3 w-3" />}
            </span>
          )}
          <StatusIcon className={`h-3 w-3 ${statusColor}`} />
        </div>

        {/* Prompt */}
        <p className="text-sm leading-snug text-slate-700 dark:text-slate-300 line-clamp-4">{task.prompt}</p>

        {/* Result */}
        {task.result && (
          <div className="mt-1.5 rounded-md bg-white/60 dark:bg-slate-700/60 px-2.5 py-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400 whitespace-pre-wrap max-h-16 overflow-y-auto">
            {task.result.length > 100 ? `${task.result.substring(0, 100)}...` : task.result}
          </div>
        )}
      </div>

      {/* Subtasks pill */}
      {task.subtasks && task.subtasks.length > 0 && (
        <div className="px-3 pb-1.5">
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-200/60 dark:bg-slate-700/60 px-1.5 py-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            <Clock className="h-2.5 w-2.5" />
            {task.subtasks.length} sous-tâche{task.subtasks.length > 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Action buttons — always visible on mobile, hover on desktop */}
      <div className="mt-auto flex items-center gap-1.5 border-t border-slate-200/40 dark:border-slate-700/40 px-3 py-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        {canSkip && (
          <button
            onClick={(e) => { e.stopPropagation(); onSkip(task._id); }}
            className={`rounded px-1.5 py-0.5 text-xs font-medium transition-colors cursor-pointer ${ACTION_COLORS[task.status]}`}
            aria-label="Ignorer"
            title="Ignorer"
          >
            Ignorer
          </button>
        )}
        {canResume && (
          <button
            onClick={(e) => { e.stopPropagation(); onResume(task._id); }}
            className={`rounded px-1.5 py-0.5 text-xs font-medium transition-colors cursor-pointer ${ACTION_COLORS[task.status]}`}
            aria-label="Reprendre"
            title="Reprendre"
          >
            Reprendre
          </button>
        )}
        <div className="flex-1" />
        <button
          onClick={(e) => { e.stopPropagation(); if (confirm('Supprimer cette tâche ?')) onDelete(task._id); }}
          className="rounded px-1.5 py-0.5 text-xs font-medium text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors cursor-pointer"
          aria-label="Supprimer"
          title="Supprimer"
        >
          Supprimer
        </button>
      </div>
    </div>
  );
};

export default TaskCard;
