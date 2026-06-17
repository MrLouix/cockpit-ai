import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';

// Initialize dark mode from localStorage or system preference
const initDarkMode = () => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('cockpitai-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = saved ? saved === 'dark' : prefersDark;
    if (isDark) {
      document.documentElement.classList.add('dark');
    }
  }
};

initDarkMode();

const queryClient = new QueryClient();

// Error boundary to catch crashes
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {error: Error | null}> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="p-10 bg-red-50 dark:bg-slate-900 min-h-screen">
          <h1 className="text-2xl font-bold text-red-700 dark:text-red-400 mb-4">cockpitAI - Erreur</h1>
          <pre className="bg-white dark:bg-slate-800 p-4 rounded border border-red-200 dark:border-red-700/50 text-sm text-red-600 dark:text-red-400 overflow-auto">
            {this.state.error.stack || this.state.error.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// Lazy load App for isolation
const App = React.lazy(() => import('./App'));
const AppWithProviders = () => (
  <QueryClientProvider client={queryClient}>
    <React.Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-slate-900">
        <p className="text-lg text-slate-400 dark:text-slate-500">Chargement…</p>
      </div>
    }>
      <App />
    </React.Suspense>
  </QueryClientProvider>
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary><AppWithProviders /></ErrorBoundary>
  </React.StrictMode>
);
