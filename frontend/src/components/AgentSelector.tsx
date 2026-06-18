import React from 'react';
import { Zap, Sparkles, Bot, Code2, Rocket } from 'lucide-react';
import type { AgentType } from '../types';

const AGENTS: { id: AgentType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'hermes', label: 'Hermes', icon: Zap },
  { id: 'vibe', label: 'Vibe', icon: Sparkles },
  { id: 'claude', label: 'Claude', icon: Bot },
  { id: 'opencode', label: 'OpenCode', icon: Code2 },
  { id: 'antigravity', label: 'Antigravity', icon: Rocket },
];

const AGENT_COLORS: Record<AgentType, string> = {
  hermes: 'bg-indigo-50 text-indigo-600 ring-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:ring-indigo-700/50',
  claude: 'bg-violet-50 text-violet-600 ring-violet-100 dark:bg-violet-900/30 dark:text-violet-400 dark:ring-violet-700/50',
  vibe: 'bg-emerald-50 text-emerald-600 ring-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:ring-emerald-700/50',
  opencode: 'bg-sky-50 text-sky-600 ring-sky-100 dark:bg-sky-900/30 dark:text-sky-400 dark:ring-sky-700/50',
  antigravity: 'bg-amber-50 text-amber-600 ring-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:ring-amber-700/50',
};

const AGENT_BORDER: Record<AgentType, string> = {
  hermes: 'border-indigo-300 dark:border-indigo-700/50',
  claude: 'border-violet-300 dark:border-violet-700/50',
  vibe: 'border-emerald-300 dark:border-emerald-700/50',
  opencode: 'border-sky-300 dark:border-sky-700/50',
  antigravity: 'border-amber-300 dark:border-amber-700/50',
};

const AGENT_BG: Record<AgentType, string> = {
  hermes: 'from-indigo-500 to-indigo-600',
  claude: 'from-violet-500 to-violet-600',
  vibe: 'from-emerald-500 to-emerald-600',
  opencode: 'from-sky-500 to-sky-600',
  antigravity: 'from-amber-500 to-amber-600',
};

interface AgentSelectorProps {
  value: AgentType;
  onChange: (agent: AgentType) => void;
  variant?: 'buttons' | 'dropdown' | 'compact' | 'badge';
  className?: string;
  showLabel?: boolean;
  onClick?: () => void;
}

// Helper to get agent config
export const getAgentConfig = (agentId: AgentType) => {
  return AGENTS.find(a => a.id === agentId);
};

export const getAgentColor = (agentId: AgentType) => {
  return AGENT_COLORS[agentId];
};

export const getAgentBorder = (agentId: AgentType) => {
  return AGENT_BORDER[agentId];
};

export const getAgentGradient = (agentId: AgentType) => {
  return AGENT_BG[agentId];
};

export const AgentSelector: React.FC<AgentSelectorProps> = ({
  value,
  onChange,
  variant = 'buttons',
  className = '',
  showLabel = true,
  onClick,
}) => {
  const selectedAgent = AGENTS.find(a => a.id === value);

  if (variant === 'badge' && selectedAgent) {
    const Icon = selectedAgent.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${AGENT_COLORS[value]} ${className}`}>
        <Icon className="h-3 w-3" />
        {showLabel && selectedAgent.label}
      </span>
    );
  }

  if (variant === 'compact') {
    const Icon = selectedAgent?.icon || Zap;
    return (
      <button
        type="button"
        onClick={onClick || (() => onChange(value))}
        className={`flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-2.5 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 shadow-sm transition hover:border-slate-300 dark:hover:border-slate-500 cursor-pointer ${className}`}
        aria-label={`Agent actuel: ${selectedAgent?.label || value}`}
      >
        <Icon className="h-4 w-4" />
        {showLabel && <span className="hidden sm:inline">{selectedAgent?.label}</span>}
      </button>
    );
  }

  if (variant === 'dropdown') {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as AgentType)}
        className={`rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 shadow-sm transition focus:border-indigo-300 dark:focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-700/50 ${className}`}
        aria-label="Sélectionner un agent"
      >
        {AGENTS.map((a) => (
          <option key={a.id} value={a.id}>
            {a.label}
          </option>
        ))}
      </select>
    );
  }

  // Default: buttons variant
  return (
    <div className={`flex flex-wrap gap-2 ${className}`} role="radiogroup" aria-label="Sélectionner un agent">
      {AGENTS.map((a) => {
        const Icon = a.icon;
        const active = value === a.id;
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => onChange(a.id)}
            aria-pressed={active}
            aria-label={`Sélectionner ${a.label}`}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
              active
                ? `bg-gradient-to-r ${AGENT_BG[a.id]} text-white shadow-md dark:shadow-${a.id}-700/50`
                : 'border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
            role="radio"
          >
            <Icon className="h-4 w-4" />
            {showLabel && <span>{a.label}</span>}
          </button>
        );
      })}
    </div>
  );
};

export default AgentSelector;
