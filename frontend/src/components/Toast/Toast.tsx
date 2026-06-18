import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  addToast: (type: ToastType, title: string, message?: string, duration?: number) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const TOAST_COLORS: Record<ToastType, { bg: string; border: string; iconColor: string; icon: React.ComponentType<{ className?: string }> }> = {
  success: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/30',
    border: 'border-emerald-200 dark:border-emerald-700/50',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    icon: CheckCircle,
  },
  error: {
    bg: 'bg-rose-50 dark:bg-rose-900/30',
    border: 'border-rose-200 dark:border-rose-700/50',
    iconColor: 'text-rose-600 dark:text-rose-400',
    icon: XCircle,
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-900/30',
    border: 'border-amber-200 dark:border-amber-700/50',
    iconColor: 'text-amber-600 dark:text-amber-400',
    icon: AlertCircle,
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900/30',
    border: 'border-blue-200 dark:border-blue-700/50',
    iconColor: 'text-blue-600 dark:text-blue-400',
    icon: Info,
  },
};

interface ToastProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  const colors = TOAST_COLORS[toast.type];
  const Icon = colors.icon;

  return (
    <motion.div
      key={toast.id}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95, height: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`rounded-xl border ${colors.border} ${colors.bg} p-4 pr-10 shadow-lg shadow-slate-200/30 dark:shadow-slate-700/30 mb-3 last:mb-0 min-w-[300px] max-w-[400px]`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <Icon className={`h-5 w-5 ${colors.iconColor} shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-0.5">{toast.title}</h4>
          {toast.message && (
            <p className="text-sm text-slate-600 dark:text-slate-400">{toast.message}</p>
          )}
        </div>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="absolute top-3 right-3 rounded-full p-1 text-slate-400 dark:text-slate-500 hover:bg-slate-100/80 dark:hover:bg-slate-700/50 hover:text-slate-600 dark:hover:text-slate-400 transition cursor-pointer"
        aria-label="Fermer"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  );
};

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((
    type: ToastType,
    title: string,
    message?: string,
    duration: number = 4000
  ) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, title, message, duration }]);

    // Auto-dismiss after duration
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = { addToast, dismissToast };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[200] flex flex-col items-end pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <Toast
              key={toast.id}
              toast={toast}
              onDismiss={dismissToast}
            />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Helper function to show toast without hook
export const showToast = (
  type: ToastType,
  title: string,
  message?: string,
  duration?: number
) => {
  // This is a fallback for cases where we can't use the hook
  // In practice, you should use the useToast hook
  console.log(`[Toast ${type}] ${title}: ${message || ''}`);
};

export default ToastProvider;
