import { useState, useRef } from 'react';
import { Send, ChevronUp, ChevronDown } from 'lucide-react';
import type { AgentType } from '../types';
import { useClickOutside } from '../hooks/useClickOutside';
import { getAgentConfig, getAgentGradient } from './AgentSelector';

const AGENTS: { id: AgentType; label: string }[] = [
  { id: 'hermes', label: 'Hermes' },
  { id: 'vibe', label: 'Vibe' },
  { id: 'claude', label: 'Claude' },
  { id: 'opencode', label: 'OpenCode' },
  { id: 'antigravity', label: 'Antigravity' },
];

interface QuickInputBarProps {
  agent: AgentType;
  onAgentChange: (a: AgentType) => void;
  prompt: string;
  onPromptChange: (v: string) => void;
  onSend: () => void;
  isPending: boolean;
  keyboardOffset: number;
}

export const QuickInputBar: React.FC<QuickInputBarProps> = ({
  agent, onAgentChange, prompt, onPromptChange, onSend, isPending, keyboardOffset,
}) => {
  const [switchOpen, setSwitchOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  useClickOutside(barRef, () => setSwitchOpen(false), switchOpen);

  const currentAgent = getAgentConfig(agent);
  const AgentIcon = currentAgent?.icon;

  return (
    <div
      ref={barRef}
      className="absolute left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-2xl z-40 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl shadow-xl shadow-slate-300/30 dark:shadow-slate-900/60 overflow-hidden"
      style={{ bottom: keyboardOffset > 0 ? `${keyboardOffset + 16}px` : 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      {/* Switch to panel — s'ouvre vers le haut */}
      {switchOpen && (
        <div className="px-4 pt-3 pb-2.5 border-b border-slate-200/60 dark:border-slate-700/60">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2.5">Switch to</p>
          <div className="flex flex-wrap gap-2">
            {AGENTS.map((a) => {
              const Icon = getAgentConfig(a.id)?.icon;
              const isActive = agent === a.id;
              const grad = getAgentGradient(a.id);
              return (
                <button
                  key={a.id}
                  onClick={() => { onAgentChange(a.id); setSwitchOpen(false); }}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                    isActive
                      ? `bg-gradient-to-r ${grad} text-white shadow-sm`
                      : 'border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                  }`}
                >
                  {Icon && <Icon className="h-3.5 w-3.5" />}
                  <span>{a.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Ligne d'input */}
      <div className="px-4 pt-3 pb-1.5">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && prompt.trim()) onSend(); }}
            placeholder="Décrivez la tâche…"
            className="flex-1 rounded-2xl border border-slate-300/80 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 shadow-sm transition focus:border-indigo-300 dark:focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-700/50"
          />
          <button
            onClick={onSend}
            disabled={!prompt.trim() || isPending}
            className="rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 p-2 text-white shadow-sm transition hover:shadow-md disabled:opacity-30 active:scale-95 dark:shadow-indigo-700/50 cursor-pointer"
            aria-label="Envoyer"
          >
            {isPending
              ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              : <Send className="h-4 w-4" />
            }
          </button>
        </div>
      </div>

      {/* Bandeau agent — déclencheur du menu Switch to */}
      <button
        onClick={() => setSwitchOpen(o => !o)}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 transition cursor-pointer"
      >
        {AgentIcon && <AgentIcon className="h-3 w-3" />}
        <span>{currentAgent?.label}</span>
        {switchOpen
          ? <ChevronDown className="h-3 w-3" />
          : <ChevronUp className="h-3 w-3" />
        }
      </button>
    </div>
  );
};
