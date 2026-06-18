import { useState, useRef } from 'react';
import { Send, Plus } from 'lucide-react';
import type { AgentType } from '../types';
import { useClickOutside } from '../hooks/useClickOutside';
import { AgentSelector, getAgentConfig } from './AgentSelector';

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
  const [agentOpen, setAgentOpen] = useState(false);
  const agentRef = useRef<HTMLDivElement>(null);
  useClickOutside(agentRef, () => setAgentOpen(false), agentOpen);

  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-2xl z-40 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl shadow-xl shadow-slate-300/30 dark:shadow-slate-900/60"
      style={{ bottom: keyboardOffset > 0 ? `${keyboardOffset + 16}px` : 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      <div className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="relative shrink-0" ref={agentRef}>
            <AgentSelector value={agent} onChange={onAgentChange} variant="compact" showLabel={false} onClick={() => setAgentOpen(o => !o)} />
            {agentOpen && (
              <div className="absolute bottom-full left-0 mb-2 w-48 rounded-xl border border-slate-300/80 dark:border-slate-600 bg-white dark:bg-slate-700 shadow-xl shadow-slate-200/40 dark:shadow-slate-700/40 overflow-hidden z-[60]">
                <div className="py-1">
                  {AGENTS.map((a) => {
                    const AgentIcon = getAgentConfig(a.id)?.icon || Plus;
                    return (
                      <button
                        key={a.id}
                        onClick={() => { onAgentChange(a.id); setAgentOpen(false); }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                          agent === a.id
                            ? 'bg-indigo-50 dark:bg-slate-600 text-indigo-700 dark:text-indigo-300 font-medium'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600/50'
                        }`}
                      >
                        <AgentIcon className="h-4 w-4" />
                        <span>{a.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
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
    </div>
  );
};
