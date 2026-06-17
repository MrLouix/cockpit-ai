import { useEffect, useState } from 'react';

/**
 * Hook pour gérer le mode sombre avec persistance dans localStorage
 * et synchronisation avec les préférences système
 */
export function useDarkMode() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    // Vérifier localStorage en premier
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cockpitai-theme');
      if (saved) {
        return saved === 'dark';
      }
      // Sinon, vérifier les préférences système
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Synchroniser avec la classe dark sur le body/html
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    // Sauvegarder dans localStorage
    localStorage.setItem('cockpitai-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  // Écouter les changements des préférences système
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      // Ne pas écraser si l'utilisateur a défini une préférence manuelle
      if (!localStorage.getItem('cockpitai-theme')) {
        setIsDark(e.matches);
      }
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const toggle = () => setIsDark(prev => !prev);
  const setDark = (value: boolean) => setIsDark(value);

  return {
    isDark,
    toggle,
    setDark,
  };
}

export default useDarkMode;
