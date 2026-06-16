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
  pending: 'text-amber-700 bg-amber-50',
  running: 'text-blue-700 bg-blue-50',
  success: 'text-emerald-700 bg-emerald-50',
  pause: 'text-slate-600 bg-slate-100',
  failed: 'text-rose-700 bg-rose-50',
  skipped: 'text-violet-700 bg-violet-50',
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
