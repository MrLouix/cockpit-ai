import React from 'react';

type FilterMode = '' | 'completed' | 'pending';

interface FilterBarProps {
  directories: string[];
  selectedDirectory: string;
  selectedFilter: FilterMode;
  statusCounts: Record<string, number>;
  onDirectoryChange: (d: string) => void;
  onFilterChange: (f: FilterMode) => void;
}

const FILTERS: { key: FilterMode; label: string; color: string; border: string; dot: string }[] = [
  { key: '', label: 'Toutes', color: 'bg-slate-500 text-white shadow-slate-200/50', border: 'border-slate-300 text-slate-700 hover:border-slate-400', dot: 'bg-slate-400' },
  { key: 'completed', label: 'Terminées', color: 'bg-emerald-500 text-white shadow-emerald-200/50', border: 'border-emerald-300 text-emerald-700 hover:border-emerald-400', dot: 'bg-emerald-400' },
  { key: 'pending', label: 'En cours', color: 'bg-blue-500 text-white shadow-blue-200/50', border: 'border-blue-300 text-blue-700 hover:border-blue-400', dot: 'bg-blue-400' },
];

export const FilterBar: React.FC<FilterBarProps> = ({
  directories,
  selectedDirectory,
  selectedFilter,
  statusCounts,
  onDirectoryChange,
  onFilterChange,
}) => {
  return (
    <div className="sticky top-[56px] z-30 mb-4 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 backdrop-blur-md bg-white/70 border-b border-slate-100/60 shadow-sm shadow-slate-100/30">
      <div className="mx-auto max-w-7xl flex flex-wrap items-center gap-3">
        {/* Status filter pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {FILTERS.map((f) => {
            const active = selectedFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => onFilterChange(active ? '' : f.key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all whitespace-nowrap ${
                  active
                    ? `border-transparent ${f.color} shadow-sm`
                    : `${f.border} bg-white/80 hover:bg-white`
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full transition ${f.dot} ${active ? 'bg-white' : ''}`} />
                {f.label}
              </button>
            );
          })}
        </div>

        {directories.length > 1 && (
          <>
            {/* Separator */}
            <div className="h-4 w-px bg-slate-200/60 hidden sm:block" />

            {/* Project select */}
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <select
                value={selectedDirectory}
                onChange={(e) => onDirectoryChange(e.target.value)}
                className="appearance-none rounded-full border border-slate-200 bg-white/80 pl-8 pr-8 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-all hover:border-slate-300 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer"
              >
                <option value="">Tous les projets</option>
                {directories.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <svg className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </>
        )}

        {/* Clear filter */}
        {(selectedFilter || selectedDirectory) && (
          <button
            onClick={() => { onFilterChange(''); onDirectoryChange(''); }}
            className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 whitespace-nowrap"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Effacer
          </button>
        )}
      </div>
    </div>
  );
};
