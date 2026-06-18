import React, { useState } from 'react';
import type { AgentType } from '../types';
import { AgentSelector } from './AgentSelector';
import { X } from 'lucide-react';

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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-300/80 dark:border-slate-700/80 bg-white dark:bg-slate-800 p-6 shadow-2xl shadow-slate-300/30 dark:shadow-slate-700/30"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Nouvelle Tâche</h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Choisissez un projet, un agent et décrivez le prompt</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
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
              className="w-full rounded-lg border border-slate-300/80 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300 shadow-sm transition focus:border-indigo-300 dark:focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-700/50 cursor-pointer"
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
            <AgentSelector
              value={agent}
              onChange={setAgent}
              variant="buttons"
            />
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
              className="w-full resize-none rounded-lg border border-slate-300/80 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300 shadow-sm transition focus:border-indigo-300 dark:focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-700/50"
              autoFocus
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200/60 dark:border-slate-700/50">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-800 dark:hover:text-slate-300 cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => valid && onSubmit({ sessionId, prompt: prompt.trim(), agent })}
              disabled={!valid}
              className="rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:shadow-md disabled:opacity-40 dark:shadow-indigo-700/50 cursor-pointer"
            >
              Créer la tâche
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewTaskModal;
