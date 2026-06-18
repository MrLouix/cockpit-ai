import { useDarkMode } from '../hooks/useDarkMode';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
  const { isDark, toggle } = useDarkMode();

  return (
    <button
      onClick={toggle}
      className="flex items-center justify-center w-9 h-9 rounded-lg border border-slate-300/80 bg-white/60 hover:bg-slate-100/80 hover:border-slate-400/80 transition-all shadow-sm hover:shadow-md dark:bg-slate-800/60 dark:border-slate-700/80 dark:hover:bg-slate-700/80 dark:hover:border-slate-600/80 cursor-pointer"
      aria-label={isDark ? 'Passer au mode clair' : 'Passer au mode sombre'}
    >
      {isDark ? (
        <Sun className="w-5 h-5 text-amber-400" />
      ) : (
        <Moon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
      )}
    </button>
  );
}

export default ThemeToggle;
