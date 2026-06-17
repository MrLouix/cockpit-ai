import React, { useState } from 'react';
import { DirectoryPicker } from './DirectoryPicker';

interface NewSessionModalProps {
  onClose: () => void;
  onSubmit: (data: { directory: string; titre: string }) => void;
}

export const NewSessionModal: React.FC<NewSessionModalProps> = ({ onClose, onSubmit }) => {
  const [titre, setTitre] = useState('');
  const [directory, setDirectory] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const valid = titre.trim() && directory.trim();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-2xl shadow-slate-300/30 dark:shadow-slate-700/30 animate-in fade-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Nouveau Projet</h2>
            <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">Créez un espace pour vos agents IA</p>
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

        <div className="flex gap-2 rounded-lg bg-indigo-50 dark:bg-slate-700/40 px-3 py-2 mb-5">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-indigo-700 dark:text-indigo-300">Un projet est lié à un répertoire de code. Les tâches seront exécutées dedans.</p>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="titre" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Nom du projet</label>
            <input
              id="titre"
              type="text"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="e.g. Refonte API v2"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300 shadow-sm transition focus:border-indigo-300 dark:focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-700/50"
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="directory" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Répertoire</label>
            <div className="flex gap-2">
              <input
                id="directory"
                type="text"
                value={directory}
                onChange={(e) => setDirectory(e.target.value)}
                placeholder="/home/ai_agent/projects/my-app"
                spellCheck={false}
                className="flex-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2.5 text-sm font-mono text-slate-700 dark:text-slate-300 shadow-sm transition focus:border-indigo-300 dark:focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-700/50"
              />
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowPicker(true)}
                  className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2.5 text-sm font-medium text-slate-500 dark:text-slate-400 shadow-sm transition hover:bg-slate-50 dark:hover:bg-slate-600/50 hover:text-slate-700 dark:hover:text-slate-300"
                  aria-label="Parcourir les répertoires"
                >
                  📁 Parcourir
                </button>
              </div>
            </div>
          </div>
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
              onClick={() => valid && onSubmit({ titre: titre.trim(), directory: directory.trim() })}
              disabled={!valid}
              className="rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:shadow-md disabled:opacity-40 dark:shadow-indigo-700/50"
            >
              Créer le projet
            </button>
          </div>
        </div>
      </div>

      {/* Server-side directory picker modal */}
      {showPicker && (
        <DirectoryPicker
          onSelect={(path) => setDirectory(path)}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
};
