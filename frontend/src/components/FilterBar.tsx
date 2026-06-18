import React from 'react';
import { X } from 'lucide-react';

type FilterMode = '' | 'completed' | 'pending';

interface FilterBarProps {
  selectedFilter: FilterMode;
  onFilterChange: (f: FilterMode) => void;
}

const FILTERS: { key: FilterMode; label: string; color: string; border: string; dot: string }[] = [
  { key: '', label: 'Toutes', color: 'bg-slate-500 text-white shadow-slate-200/50 dark:shadow-slate-700/50', border: 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-500', dot: 'bg-slate-400 dark:bg-slate-500' },
  { key: 'completed', label: 'Terminées', color: 'bg-emerald-500 text-white shadow-emerald-200/50 dark:shadow-emerald-700/50', border: 'border-emerald-300 dark:border-emerald-600 text-emerald-700 dark:text-emerald-300 hover:border-emerald-400 dark:hover:border-emerald-500', dot: 'bg-emerald-400 dark:bg-emerald-500' },
  { key: 'pending', label: 'En cours', color: 'bg-blue-500 text-white shadow-blue-200/50 dark:shadow-blue-700/50', border: 'border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300 hover:border-blue-400 dark:hover:border-blue-500', dot: 'bg-blue-400 dark:bg-blue-500' },
];

export const FilterBar: React.FC<FilterBarProps> = ({
  selectedFilter,
  onFilterChange,
}) => {
  return (
    <div className="mb-4 py-1">
      <div className="mx-auto max-w-7xl flex flex-wrap items-center gap-3">
        {/* Status filter pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {FILTERS.map((f) => {
            const active = selectedFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => onFilterChange(active ? '' : f.key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${
                  active
                    ? `border-transparent ${f.color} shadow-sm`
                    : `${f.border} bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-700/80`
                }`}
                aria-pressed={active}
                aria-label={`Filtre: ${f.label}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full transition ${f.dot} ${active ? 'bg-white dark:bg-slate-700' : ''}`} />
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Clear filter */}
        {selectedFilter && (
          <button
            onClick={() => onFilterChange('')}
            className="flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-medium text-slate-500 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-700 dark:hover:text-slate-300 whitespace-nowrap cursor-pointer"
            aria-label="Effacer le filtre"
          >
            <X className="h-3 w-3" />
            Effacer
          </button>
        )}
      </div>
    </div>
  );
};

export default FilterBar;
