import React from 'react';
import type { Task, Session } from '../types';
import { StatusBadge } from './StatusBadge';
import { getAgentColor, getAgentConfig } from './AgentSelector';
import { X, Clock, AlertTriangle, Key, XCircle, Terminal } from 'lucide-react';

interface TaskDetailModalProps {
  task: Task;
  session?: Session;
  onClose: () => void;
}

function fmtDate(raw?: string) {
  if (!raw) return '—';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/* Detect error type from result string */
function parseError(raw?: string): { type: string; icon: React.ComponentType<{ className?: string }>; detail: string } | null {
  if (!raw) return null;
  const r = raw.trim();
  // Timeout
  if (/time\s*out|timed?\s*out/i.test(r)) return { type: 'Timeout', icon: Clock, detail: r };
  // Rate limit
  if (/rate.?limit|too.?many.?request|429|throttl/i.test(r)) return { type: 'Rate Limit', icon: AlertTriangle, detail: r };
  // Auth
  if (/unauthoriz|forbidden|401|403|api.?key|credential|auth/i.test(r)) return { type: 'Erreur d\'authentification', icon: Key, detail: r };
  // Quota
  if (/quota|exceeds?.*limit|insufficient/i.test(r)) return { type: 'Quota dépassé', icon: XCircle, detail: r };
  // Generic error
  if (/error|fail|exception|traceback|stderr/i.test(r)) return { type: 'Erreur d\'exécution', icon: Terminal, detail: r };
  // If there's content but no recognizable pattern
  if (r.length > 10) return { type: 'Résultat', icon: Terminal, detail: r };
  return null;
}

const ERROR_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Timeout: Clock,
  'Rate Limit': AlertTriangle,
  'Erreur d\'authentification': Key,
  'Quota dépassé': XCircle,
  'Erreur d\'exécution': Terminal,
  Résultat: Terminal,
};

const ERROR_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  Timeout: { border: 'border-amber-200 dark:border-amber-700/50', bg: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-800 dark:text-amber-300' },
  'Rate Limit': { border: 'border-rose-200 dark:border-rose-700/50', bg: 'bg-rose-50 dark:bg-rose-900/30', text: 'text-rose-800 dark:text-rose-300' },
  'Erreur d\'authentification': { border: 'border-yellow-200 dark:border-yellow-700/50', bg: 'bg-yellow-50 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-300' },
  'Quota dépassé': { border: 'border-violet-200 dark:border-violet-700/50', bg: 'bg-violet-50 dark:bg-violet-900/30', text: 'text-violet-800 dark:text-violet-300' },
  'Erreur d\'exécution': { border: 'border-rose-200 dark:border-rose-700/50', bg: 'bg-rose-50 dark:bg-rose-900/30', text: 'text-rose-800 dark:text-rose-300' },
  Résultat: { border: 'border-emerald-200 dark:border-emerald-700/50', bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-800 dark:text-emerald-300' },
};

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ task, session, onClose }) => {
  const error = parseError(task.result);
  const isFailed = task.status === 'failed';
  const agentConfig = getAgentConfig(task.agent);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-slate-300/80 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl shadow-slate-300/30 dark:shadow-slate-700/30 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-200/60 dark:border-slate-700/50">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Détails de la tâche</h2>
              <StatusBadge status={task.status} />
              <span className={`rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${getAgentColor(task.agent)}`}>
                {agentConfig?.label || task.agent}
              </span>
            </div>
            {session && (
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                Projet&nbsp;: <span className="font-medium text-slate-700 dark:text-slate-300">{session.titre || session.directory}</span>
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-3 rounded-lg p-1.5 text-slate-500 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-6 py-4 space-y-4">
          {/* Prompt */}
          <div>
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Prompt</h3>
            <div className="rounded-lg border border-slate-300/80 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/40 px-3 py-2.5 text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
              {task.prompt}
            </div>
          </div>

          {/* Error / Result */}
          {error && (
            <div>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {isFailed ? 'Erreur' : 'Résultat'}
              </h3>
              {(() => {
                const colors = ERROR_COLORS[error.type] || ERROR_COLORS.Résultat;
                const Icon = ERROR_ICONS[error.type] || Terminal;
                return (
                  <div className={`rounded-lg border ${colors.border} ${colors.bg} px-4 py-3 text-sm leading-relaxed ${colors.text}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="h-4 w-4 shrink-0" />
                      <p className="font-semibold">{error.type}</p>
                    </div>
                    <pre className="whitespace-pre-wrap break-words text-xs opacity-80 font-mono">{error.detail}</pre>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Success result */}
          {task.result && !error && (
            <div>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Résultat</h3>
              <div className="rounded-lg border border-emerald-200 dark:border-emerald-700/50 bg-emerald-50 dark:bg-emerald-900/30 px-4 py-3 text-sm leading-relaxed text-emerald-800 dark:text-emerald-300 whitespace-pre-wrap">
                {task.result}
              </div>
            </div>
          )}

          {/* Subtasks */}
          {task.subtasks && task.subtasks.length > 0 && (
            <div>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Sous-tâches ({task.subtasks.length})
              </h3>
              <div className="space-y-2">
                {task.subtasks.map((st) => (
                  <div key={st._id} className="rounded-lg border border-slate-300/80 dark:border-slate-600 bg-white dark:bg-slate-700/40 px-3 py-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <StatusBadge status={st.status} />
                      <span className="text-xs text-slate-500 dark:text-slate-400">{fmtDate(st.createdAt)}</span>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{st.prompt}</p>
                    {st.result && (
                      <pre className="mt-1 whitespace-pre-wrap break-words text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/40 rounded-md px-2 py-1.5">
                        {st.result}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Meta */}
          <div>
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Métadonnées</h3>
            <div className="grid grid-cols-2 gap-y-1.5 text-sm">
              <span className="text-slate-500 dark:text-slate-400">Créée le</span>
              <span className="font-medium tabular-nums text-slate-700 dark:text-slate-300">{fmtDate(task.createdAt)}</span>
              <span className="text-slate-500 dark:text-slate-400">Modifiée le</span>
              <span className="font-medium tabular-nums text-slate-700 dark:text-slate-300">{fmtDate(task.updatedAt)}</span>
              {task.endDate && (
                <>
                  <span className="text-slate-500 dark:text-slate-400">Terminée le</span>
                  <span className="font-medium tabular-nums text-slate-700 dark:text-slate-300">{fmtDate(task.endDate)}</span>
                </>
              )}
              <span className="text-slate-500 dark:text-slate-400">ID</span>
              <span className="font-mono text-slate-500 dark:text-slate-400 truncate" title={task._id}>{task._id}</span>
            </div>
          </div>
        </div>

        {/* Bottom bar with action buttons */}
        <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-slate-200/60 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-700/30 rounded-b-2xl">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-600/50 hover:text-slate-800 dark:hover:text-slate-300 cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskDetailModal;
