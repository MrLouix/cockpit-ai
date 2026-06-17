import React from 'react';
import type { Task, Session } from '../types';
import { StatusBadge } from './StatusBadge';

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

const AGENT_COLORS: Record<string, string> = {
  hermes: 'bg-indigo-50 text-indigo-600 ring-indigo-100',
  claude: 'bg-violet-50 text-violet-600 ring-violet-100',
  vibe: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  opencode: 'bg-sky-50 text-sky-600 ring-sky-100',
  antigravity: 'bg-amber-50 text-amber-600 ring-amber-100',
};

/* Detect error type from result string */
function parseError(raw?: string): { type: string; detail: string } | null {
  if (!raw) return null;
  const r = raw.trim();
  // Timeout
  if (/time\s*out|timed?\s*out/i.test(r)) return { type: '⏱ Timeout', detail: r };
  // Rate limit
  if (/rate.?limit|too.?many.?request|429|throttl/i.test(r)) return { type: '🚫 Rate Limit', detail: r };
  // Auth
  if (/unauthoriz|forbidden|401|403|api.?key|credential|auth/i.test(r)) return { type: '🔑 Erreur d\'authentification', detail: r };
  // Quota
  if (/quota|exceeds?.*limit|insufficient/i.test(r)) return { type: '💰 Quota dépassé', detail: r };
  // Generic error
  if (/error|fail|exception|traceback|stderr/i.test(r)) return { type: '❌ Erreur d\'exécution', detail: r };
  // If there's content but no recognizable pattern
  if (r.length > 10) return { type: '⚠️ Résultat', detail: r };
  return null;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ task, session, onClose }) => {
  const error = parseError(task.result);
  const isFailed = task.status === 'failed';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl shadow-slate-300/30 dark:shadow-slate-700/30 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700/50">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Détails de la tâche</h2>
              <StatusBadge status={task.status} />
              <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${AGENT_COLORS[task.agent] || 'bg-slate-50 dark:bg-slate-700/40 text-slate-600 dark:text-slate-300 ring-slate-100 dark:ring-slate-600/50'}`}>
                {task.agent}
              </span>
            </div>
            {session && (
              <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                Projet&nbsp;: <span className="font-medium text-slate-600 dark:text-slate-300">{session.titre || session.directory}</span>
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-3 rounded-lg p-1.5 text-slate-400 dark:text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-600 dark:hover:text-slate-400"
            aria-label="Fermer"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-6 py-4 space-y-4">
          {/* Prompt */}
          <div>
            <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Prompt</h3>
            <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/40 px-3 py-2.5 text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
              {task.prompt}
            </div>
          </div>

          {/* Error / Result */}
          {error && (
            <div>
              <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {isFailed ? 'Erreur' : 'Résultat'}
              </h3>
              <div className={`rounded-lg border px-4 py-3 text-sm leading-relaxed ${
                isFailed
                  ? 'border-rose-200 dark:border-rose-700/50 bg-rose-50 dark:bg-rose-900/30 text-rose-800 dark:text-rose-300'
                  : 'border-emerald-200 dark:border-emerald-700/50 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300'
              }`}>
                <p className="font-semibold mb-1">{error.type}</p>
                <pre className="whitespace-pre-wrap break-words text-xs opacity-80 font-mono">{error.detail}</pre>
              </div>
            </div>
          )}

          {/* Success result */}
          {task.result && !error && (
            <div>
              <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Résultat</h3>
              <div className="rounded-lg border border-emerald-200 dark:border-emerald-700/50 bg-emerald-50 dark:bg-emerald-900/30 px-4 py-3 text-sm leading-relaxed text-emerald-800 dark:text-emerald-300 whitespace-pre-wrap">
                {task.result}
              </div>
            </div>
          )}

          {/* Subtasks */}
          {task.subtasks && task.subtasks.length > 0 && (
            <div>
              <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Sous-tâches ({task.subtasks.length})
              </h3>
              <div className="space-y-2">
                {task.subtasks.map((st) => (
                  <div key={st._id} className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700/40 px-3 py-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <StatusBadge status={st.status} />
                      <span className="text-[11px] text-slate-400 dark:text-slate-500">{fmtDate(st.createdAt)}</span>
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
            <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Métadonnées</h3>
            <div className="grid grid-cols-2 gap-y-1.5 text-xs">
              <span className="text-slate-400 dark:text-slate-500">Créée le</span>
              <span className="font-medium tabular-nums text-slate-700 dark:text-slate-300">{fmtDate(task.createdAt)}</span>
              <span className="text-slate-400 dark:text-slate-500">Modifiée le</span>
              <span className="font-medium tabular-nums text-slate-700 dark:text-slate-300">{fmtDate(task.updatedAt)}</span>
              {task.endDate && (
                <>
                  <span className="text-slate-400 dark:text-slate-500">Terminée le</span>
                  <span className="font-medium tabular-nums text-slate-700 dark:text-slate-300">{fmtDate(task.endDate)}</span>
                </>
              )}
              <span className="text-slate-400 dark:text-slate-500">ID</span>
              <span className="font-mono text-slate-500 dark:text-slate-400 truncate" title={task._id}>{task._id}</span>
            </div>
          </div>
        </div>

        {/* Bottom bar with action buttons */}
        <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-700/30 rounded-b-2xl">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-600/50 hover:text-slate-700 dark:hover:text-slate-300"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
