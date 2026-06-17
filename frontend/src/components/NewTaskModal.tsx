import React, { useState } from 'react';
import type { AgentType } from '../types';

const AGENTS: { id: AgentType; label: string; emoji: string }[] = [
  { id: 'hermes', label: 'Hermes', emoji: '⚡' },
  { id: 'vibe', label: 'Vibe', emoji: '✨' },
  { id: 'claude', label: 'Claude', emoji: '🤖' },
  { id: 'opencode', label: 'OpenCode', emoji: '💻' },
  { id: 'antigravity', label: 'Antigravity', emoji: '🚀' },
];

interface NewTaskModalProps {
  sessions: { _id: string; directory: string; titre: string }[];
  onClose: () => void;
  onSubmit: (data: { sessionId: string; prompt: string; agent: string }) => void;
}

export const NewTaskModal: React.FC<NewTaskModalProps> = ({ sessions, onClose, onSubmit }) => {
  const [sessionId, setSessionId] = useState(sessions.length === 1 ? sessions[0]._id : '');
  const [prompt, setPrompt] = useState('');
  const [agent, setAgent] = useState<AgentType>('hermes');
  const valid = sessionId && prompt.trim();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-2xl shadow-slate-300/30 dark:shadow-slate-700/30"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Nouvelle Tâche</h2>
            <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">Choisissez un projet, un agent et décrivez le prompt</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 dark:text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-600 dark:hover:text-slate-400"
            aria-label="Fermer"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Project */}
          <div>
            <label htmlFor="task-session" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Projet</label>
            <select
              id="task-session"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300 shadow-sm transition focus:border-indigo-300 dark:focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-700/50"
            >
              <option value="">— Choisir un projet —</option>
              {sessions.map((s) => (
                <option key={s._id} value={s._id}>{s.titre || s.directory}</option>
              ))}
            </select>
          </div>

          {/* Agent selector */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Agent</label>
            <div className="flex flex-wrap gap-2">
              {AGENTS.map((a) => {
                const active = agent === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setAgent(a.id)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      active
                        ? 'bg-gradient-to-r from-violet-500 to-indigo-600 text-white shadow-md dark:shadow-indigo-700/50'
                        : 'border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <span>{a.emoji}</span>
                    <span>{a.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Prompt */}
          <div>
            <label htmlFor="task-prompt" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Prompt</label>
            <textarea
              id="task-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="Décrivez la tâche à exécuter par l'agent…"
              className="w-full resize-none rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300 shadow-sm transition focus:border-indigo-300 dark:focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-700/50"
              autoFocus
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700/50">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-700 dark:hover:text-slate-300"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => valid && onSubmit({ sessionId, prompt: prompt.trim(), agent })}
              disabled={!valid}
              className="rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:shadow-md disabled:opacity-40 dark:shadow-indigo-700/50"
            >
              Créer la tâche
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
