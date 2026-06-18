import React, { useCallback, useEffect, useState } from 'react';
import * as api from '../api/client';
import { X, Folder, ArrowUp, Check, Loader2 } from 'lucide-react';

interface DirEntry {
  name: string;
  fullPath: string;
}

interface DirListing {
  path: string;
  parent: string;
  directories: DirEntry[];
  files: DirEntry[];
}

interface DirectoryPickerProps {
  onSelect: (path: string) => void;
  onClose: () => void;
}

export const DirectoryPicker: React.FC<DirectoryPickerProps> = ({ onSelect, onClose }) => {
  const [listing, setListing] = useState<DirListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDir = useCallback(async (dirPath: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.listFiles(dirPath);
      setListing(result);
    } catch (err: any) {
      setError(err.message || 'Impossible de lire ce répertoire');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load root on mount
  useEffect(() => {
    loadDir('/home/ai_agent/projects');
  }, [loadDir]);

  const handleSelect = (entry: DirEntry) => {
    loadDir(entry.fullPath);
  };

  const handleConfirm = () => {
    if (listing) {
      onSelect(listing.path);
      onClose();
    }
  };

  const handleUp = () => {
    if (listing) {
      loadDir(listing.parent);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-300/80 dark:border-slate-700/80 bg-white dark:bg-slate-800 p-0 shadow-2xl shadow-slate-300/30 dark:shadow-slate-700/30 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200/60 dark:border-slate-700/50">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Choisir un répertoire</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Breadcrumb */}
        {listing && (
          <div className="px-5 py-2 bg-slate-100/80 dark:bg-slate-700/40 border-b border-slate-200/60 dark:border-slate-700/50 flex items-center gap-1 overflow-x-auto">
            {listing.path.split('/').filter(Boolean).map((segment, i, arr) => {
              const partial = '/' + arr.slice(0, i + 1).join('/');
              const isHome = segment === 'home';
              const isAiAgent = segment === 'ai_agent';
              const isLast = i === arr.length - 1;
              return (
                <React.Fragment key={partial}>
                  {(i > 0) && <span className="text-slate-400 dark:text-slate-500 text-xs">/</span>}
                  {isLast ? (
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap truncate max-w-[200px]">{segment}</span>
                  ) : (
                    <button
                      onClick={() => loadDir(partial)}
                      className="text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline whitespace-nowrap truncate max-w-[200px] cursor-pointer"
                    >
                      {(isHome || isAiAgent) ? <span className="truncate max-w-[100px] inline-block">{segment}</span> : segment}
                    </button>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}

        {/* Up button */}
        {listing && listing.path !== '/' && listing.parent !== listing.path && (
          <button
            onClick={handleUp}
            className="w-full flex items-center gap-2 px-5 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-700/50 transition border-b border-slate-200/60 dark:border-slate-700/50 cursor-pointer"
          >
            <ArrowUp className="h-4 w-4" />
            <span className="text-xs font-medium">..</span>
          </button>
        )}

        {/* Content */}
        <div className="max-h-[280px] overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
            </div>
          )}
          {error && !loading && (
            <div className="px-5 py-8 text-center text-sm text-rose-500 dark:text-rose-400">{error}</div>
          )}
          {!loading && !error && listing && listing.directories.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Aucun sous-répertoire
            </div>
          )}
          {!loading && !error && listing && listing.directories.map((d) => (
            <button
              key={d.fullPath}
              onClick={() => handleSelect(d)}
              className="w-full flex items-center gap-2.5 px-5 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-slate-700/50 hover:text-indigo-700 dark:hover:text-indigo-300 transition text-left cursor-pointer"
            >
              <Folder className="h-4 w-4 shrink-0 text-indigo-500 dark:text-indigo-400" />
              <span className="truncate font-mono text-xs">{d.name}</span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200/60 dark:border-slate-700/50 bg-slate-100/50 dark:bg-slate-700/30">
          <code className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate max-w-[260px]">
            {listing?.path || '...'}
          </code>
          <div className="flex gap-2 ml-3">
            <button
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-slate-600/50 transition cursor-pointer"
            >
              Annuler
            </button>
            <button
              onClick={handleConfirm}
              disabled={!listing}
              className="rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm transition hover:shadow-md disabled:opacity-40 dark:shadow-indigo-700/50 cursor-pointer"
            >
              <Check className="h-3.5 w-3.5 mr-1" />
              Sélectionner ce dossier
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DirectoryPicker;
