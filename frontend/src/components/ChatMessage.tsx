import React, { useState } from 'react';
import { Bot } from 'lucide-react';
import type { Task, AgentType } from '../types';
import { StatusBadge } from './StatusBadge';
import { getAgentConfig, getAgentGradient } from './AgentSelector';

interface ChatMessageProps {
  task: Task;
  onSkip: (id: string) => void;
  onResume: (id: string) => void;
  onDelete: (id: string) => void;
  onClick: (task: Task) => void;
}

const AGENT_BUBBLE_BG: Record<AgentType, string> = {
  claude:      'bg-violet-50 dark:bg-violet-950/30 border-violet-300 dark:border-violet-700/50',
  hermes:      'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700/50',
  antigravity: 'bg-cyan-50 dark:bg-cyan-950/30 border-cyan-300 dark:border-cyan-700/50',
  vibe:        'bg-pink-50 dark:bg-pink-950/30 border-pink-300 dark:border-pink-700/50',
  opencode:    'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700/50',
};

export const ChatMessage: React.FC<ChatMessageProps> = ({ task, onSkip, onResume, onDelete, onClick }) => {
  const [expanded, setExpanded] = useState(false);
  const [showFullResult, setShowFullResult] = useState(false);
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const agentConfig = getAgentConfig(task.agent);
  const AgentIcon = agentConfig?.icon ?? Bot;
  const agentGradient = getAgentGradient(task.agent) ?? 'from-slate-400 to-slate-500';
  const bubbleBg = AGENT_BUBBLE_BG[task.agent] ?? 'bg-slate-50 dark:bg-slate-900/30 border-slate-300 dark:border-slate-700/50';

  const canSkip = task.status === 'pending' || task.status === 'failed';
  const canResume = task.status === 'skipped' || task.status === 'failed' || task.status === 'pause';

  return (
    <div className="group flex flex-col gap-2">
      {/* User bubble — right */}
      <div className="flex justify-end gap-2 items-start">
        <div className="chat-bubble-user max-w-[80%] px-4 py-2.5 shadow-sm">
          <p className={`text-sm text-slate-700 dark:text-slate-200 ${expanded ? '' : 'line-clamp-4'}`}>
            {task.prompt}
          </p>
          {task.prompt.length > 200 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-1 text-xs text-indigo-500 hover:text-indigo-600"
            >
              {expanded ? 'Voir moins' : 'Voir plus'}
            </button>
          )}
        </div>
        <div className={`chat-avatar bg-gradient-to-br ${agentGradient}`}>
          <AgentIcon className="h-4 w-4 text-white" />
        </div>
      </div>

      {/* Agent bubble — left */}
      <div className="flex gap-2 items-start">
        <div className={`chat-avatar bg-gradient-to-br ${agentGradient}`}>
          <AgentIcon className="h-4 w-4 text-white" />
        </div>

        <div
          className={`chat-bubble-agent border max-w-[80%] flex-1 ${bubbleBg} shadow-sm cursor-pointer`}
          onClick={() => onClick(task)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(task); } }}
          aria-label={`Tâche: ${task.prompt}. Statut: ${task.status}`}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-4 pt-3 pb-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {agentConfig?.label ?? task.agent}
            </span>
            <StatusBadge status={task.status} />
          </div>

          {/* Result */}
          {task.result && (
            <div className="px-4 pb-2">
              <div className="rounded-lg bg-white/60 dark:bg-slate-900/40 px-3 py-2 text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                {showFullResult || task.result.length <= 300
                  ? task.result
                  : task.result.slice(0, 300) + '…'}
              </div>
              {task.result.length > 300 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowFullResult(!showFullResult); }}
                  className="mt-1 text-xs text-indigo-500 hover:text-indigo-600"
                >
                  {showFullResult ? 'Voir moins' : 'Voir plus'}
                </button>
              )}
            </div>
          )}

          {/* Subtasks */}
          {task.subtasks.length > 0 && (
            <div className="px-4 pb-2">
              <button
                onClick={(e) => { e.stopPropagation(); setShowSubtasks(!showSubtasks); }}
                className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                {showSubtasks ? '▾' : '▸'} {task.subtasks.length} sous-tâche{task.subtasks.length > 1 ? 's' : ''}
              </button>
              {showSubtasks && (
                <ul className="mt-1 space-y-1">
                  {task.subtasks.map(st => (
                    <li key={st._id} className="flex items-center gap-2 text-xs text-slate-500">
                      <StatusBadge status={st.status} />
                      <span className="truncate">{st.prompt}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-1.5 border-t border-slate-200/40 dark:border-slate-700/40 px-3 py-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            {canSkip && (
              <button
                onClick={(e) => { e.stopPropagation(); onSkip(task._id); }}
                className="rounded px-1.5 py-0.5 text-xs font-medium text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors"
                aria-label="Ignorer"
              >
                Ignorer
              </button>
            )}
            {canResume && (
              <button
                onClick={(e) => { e.stopPropagation(); onResume(task._id); }}
                className="rounded px-1.5 py-0.5 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                aria-label="Reprendre"
              >
                Reprendre
              </button>
            )}
            <div className="flex-1" />
            {confirmingDelete ? (
              <>
                <span className="text-xs text-slate-500 dark:text-slate-400">Confirmer ?</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(task._id); }}
                  className="rounded px-1.5 py-0.5 text-xs font-medium text-white bg-rose-500 hover:bg-rose-600 transition-colors"
                  aria-label="Confirmer la suppression"
                >
                  Oui
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmingDelete(false); }}
                  className="rounded px-1.5 py-0.5 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  aria-label="Annuler"
                >
                  Non
                </button>
              </>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmingDelete(true); }}
                className="rounded px-1.5 py-0.5 text-xs font-medium text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors"
                aria-label="Supprimer"
              >
                Supprimer
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
