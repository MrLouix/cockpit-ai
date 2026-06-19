import React, { useState } from 'react';
import { DirectoryPicker } from './DirectoryPicker';
import { FolderOpen, Info, X } from 'lucide-react';

interface NewSessionModalProps {
  defaultDirectory?: string;
  onClose: () => void;
  onSubmit: (data: { directory: string; titre: string }) => void;
}

export const NewSessionModal: React.FC<NewSessionModalProps> = ({ defaultDirectory, onClose, onSubmit }) => {
  const [titre, setTitre] = useState('');
  const [directory, setDirectory] = useState(defaultDirectory ?? '');
  const [showPicker, setShowPicker] = useState(false);
  const isNewProject = !defaultDirectory;
  const valid = titre.trim() && (isNewProject ? directory.trim() : true);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-300/80 dark:border-slate-700/80 bg-white dark:bg-slate-800 p-6 shadow-2xl shadow-slate-300/30 dark:shadow-slate-700/30 animate-in fade-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">{isNewProject ? 'Nouveau Projet' : 'Nouveau Chat'}</h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{isNewProject ? 'Créez un espace pour vos agents IA' : 'Ajoutez un nouveau chat dans ce projet'}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-2 rounded-lg bg-indigo-100/80 dark:bg-slate-700/40 px-3 py-2 mb-5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
          <p className="text-sm text-indigo-700 dark:text-indigo-300">
            {isNewProject
              ? 'Un projet est lié à un répertoire de code. Les tâches seront exécutées dedans.'
              : 'Un nouveau chat sera créé dans le projet existant. Les tâches seront exécutées dans le même répertoire.'}
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="titre" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{isNewProject ? 'Nom du projet' : 'Nom du chat'}</label>
            <input
              id="titre"
              type="text"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="e.g. Refonte API v2"
              className="w-full rounded-lg border border-slate-300/80 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300 shadow-sm transition focus:border-indigo-300 dark:focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-700/50 cursor-pointer"
              autoFocus
            />
          </div>
          {isNewProject && (
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
                  className="flex-1 rounded-lg border border-slate-300/80 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2.5 text-sm font-mono text-slate-700 dark:text-slate-300 shadow-sm transition focus:border-indigo-300 dark:focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-700/50"
                />
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowPicker(true)}
                    className="rounded-lg border border-slate-300/80 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 shadow-sm transition hover:bg-slate-100/80 dark:hover:bg-slate-600/50 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                    aria-label="Parcourir les répertoires"
                  >
                    <FolderOpen className="h-4 w-4" />
                    <span className="ml-1">Parcourir</span>
                  </button>
                </div>
              </div>
            </div>
          )}
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
              onClick={() => valid && onSubmit({ titre: titre.trim(), directory: directory.trim() })}
              disabled={!valid}
              className="rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:shadow-md disabled:opacity-40 dark:shadow-indigo-700/50 cursor-pointer"
            >
              {isNewProject ? 'Créer le projet' : 'Créer le chat'}
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

export default NewSessionModal;
