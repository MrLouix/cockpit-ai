import React, { useCallback, useEffect, useState } from 'react';
import * as api from '../api/client';

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
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl shadow-slate-300/30 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">Choisir un répertoire</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Fermer"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Breadcrumb */}
        {listing && (
          <div className="px-5 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-1 overflow-x-auto">
            {listing.path.split('/').filter(Boolean).map((segment, i, arr) => {
              const partial = '/' + arr.slice(0, i + 1).join('/');
              const isHome = segment === 'home';
              const isAiAgent = segment === 'ai_agent';
              const isLast = i === arr.length - 1;
              return (
                <React.Fragment key={partial}>
                  {(i > 0) && <span className="text-slate-300 text-xs">/</span>}
                  {isLast ? (
                    <span className="text-xs font-medium text-slate-700 whitespace-nowrap truncate max-w-[200px]">{segment}</span>
                  ) : (
                    <button
                      onClick={() => loadDir(partial)}
                      className="text-xs text-indigo-500 hover:text-indigo-700 hover:underline whitespace-nowrap truncate max-w-[200px]"
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
            className="w-full flex items-center gap-2 px-5 py-2 text-sm text-slate-500 hover:bg-slate-50 transition border-b border-slate-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            <span className="text-xs font-medium">..</span>
          </button>
        )}

        {/* Content */}
        <div className="max-h-[280px] overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
            </div>
          )}
          {error && !loading && (
            <div className="px-5 py-8 text-center text-sm text-rose-500">{error}</div>
          )}
          {!loading && !error && listing && listing.directories.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-slate-400">
              Aucun sous-répertoire
            </div>
          )}
          {!loading && !error && listing && listing.directories.map((d) => (
            <button
              key={d.fullPath}
              onClick={() => handleSelect(d)}
              className="w-full flex items-center gap-2.5 px-5 py-2.5 text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 transition text-left"
            >
              <svg className="h-4 w-4 shrink-0 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <span className="truncate font-mono text-xs">{d.name}</span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50">
          <code className="text-[11px] font-mono text-slate-400 truncate max-w-[260px]">
            {listing?.path || '...'}
          </code>
          <div className="flex gap-2 ml-3">
            <button
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 transition"
            >
              Annuler
            </button>
            <button
              onClick={handleConfirm}
              disabled={!listing}
              className="rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm transition hover:shadow-md disabled:opacity-40"
            >
              Sélectionner ce dossier
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
