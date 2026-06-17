import React from 'react';
import type { TaskStatus } from '../types';

const DOT: Record<TaskStatus, string> = {
  pending: 'bg-amber-400',
  running: 'bg-blue-500 animate-pulse',
  success: 'bg-emerald-400',
  pause: 'bg-slate-400',
  failed: 'bg-rose-500',
  skipped: 'bg-violet-400',
};

const LABELS: Record<TaskStatus, string> = {
  pending: 'En attente',
  running: 'En cours',
  success: 'Terminé',
  pause: 'Pause',
  failed: 'Échoué',
  skipped: 'Ignoré',
};

const TEXT: Record<TaskStatus, string> = {
  pending: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30',
  running: 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30',
  success: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30',
  pause: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/40',
  failed: 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30',
  skipped: 'text-violet-700 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30',
};

interface StatusBadgeProps {
  status: TaskStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${TEXT[status]}`}
  >
    <span className={`h-1.5 w-1.5 rounded-full ${DOT[status]}`} />
    {LABELS[status]}
  </span>
);
