# Étape 6 — Découper AppContent en sous-composants

## Objectif

`App.tsx` contient ~500 lignes. L'objectif est de l'amener à ~200 lignes en extrayant deux composants. **Aucune logique ne change, seul le lieu où le code réside change.**

---

## Fichier 1 — `frontend/src/components/AppHeader.tsx`

### Ce qui s'y déplace (depuis App.tsx)

- Tout le JSX de `<header>` (lignes 210–332)
- L'état `burgerOpen` + son setter
- Le ref `burgerRef`
- Le `useClickOutside(burgerRef, ...)` — gère le clic en dehors du menu burger

### Interface exacte à définir

```ts
interface AppHeaderProps {
  currentTitle: string;
  sessions: Session[];
  selectedDirectory: string;
  onSelectDirectory: (dir: string) => void;
  viewMode: 'table' | 'cards' | 'chat';
  onViewChange: (mode: 'table' | 'cards' | 'chat') => void;
  onNewSession: () => void;
  onNewTask: () => void;
}
```

### Imports nécessaires dans AppHeader.tsx

```ts
import { useState, useRef } from 'react';
import { Menu, ChevronDown, Plus, MessageSquare } from 'lucide-react';
import type { Session } from '../types';
import { useClickOutside } from '../hooks/useClickOutside';
import { LogoPunchline } from './LogoPunchline';
import { ThemeToggle } from './ThemeToggle';
```

### Structure du composant

```tsx
export const AppHeader: React.FC<AppHeaderProps> = ({
  currentTitle, sessions, selectedDirectory, onSelectDirectory,
  viewMode, onViewChange, onNewSession, onNewTask,
}) => {
  const [burgerOpen, setBurgerOpen] = useState(false);
  const burgerRef = useRef<HTMLDivElement>(null);
  useClickOutside(burgerRef, () => setBurgerOpen(false), burgerOpen);

  return (
    <header className="shrink-0 z-50 ...">
      {/* Coller ici le JSX exact des lignes 210–332 de App.tsx */}
    </header>
  );
};
```

### Substitutions à faire dans le JSX copié

| Ancien (App.tsx) | Nouveau (AppHeader.tsx) |
|---|---|
| `setBurgerOpen(!burgerOpen)` | `setBurgerOpen(b => !b)` |
| `setSelectedDirectory(s.directory)` | `onSelectDirectory(s.directory)` |
| `setSelectedDirectory('')` | `onSelectDirectory('')` |
| `setViewMode('table')` | `onViewChange('table')` |
| `setViewMode('cards')` | `onViewChange('cards')` |
| `setViewMode('chat')` | `onViewChange('chat')` |
| `setShowNewSession(true)` | `onNewSession()` |
| `setShowNewTask(true)` | `onNewTask()` |

---

## Fichier 2 — `frontend/src/components/QuickInputBar.tsx`

### Ce qui s'y déplace (depuis App.tsx)

- Tout le JSX de la bottom bar (lignes 403–459 — le `<div className="absolute left-1/2 ...">`)
- L'état `quickAgentOpen` + son setter
- Le ref `quickAgentRef`
- Le `useClickOutside(quickAgentRef, ...)` — gère le clic en dehors du dropdown agent

### Interface exacte à définir

```ts
interface QuickInputBarProps {
  agent: AgentType;
  onAgentChange: (a: AgentType) => void;
  prompt: string;
  onPromptChange: (v: string) => void;
  onSend: () => void;
  isPending: boolean;
  keyboardOffset: number;
}
```

### Imports nécessaires dans QuickInputBar.tsx

```ts
import { useState, useRef } from 'react';
import { Send, Plus } from 'lucide-react';
import type { AgentType } from '../types';
import { useClickOutside } from '../hooks/useClickOutside';
import { AgentSelector, getAgentConfig } from './AgentSelector';
```

Copier également la constante `AGENTS` depuis App.tsx (elle déménage ici) :

```ts
const AGENTS: { id: AgentType; label: string }[] = [
  { id: 'hermes', label: 'Hermes' },
  { id: 'vibe', label: 'Vibe' },
  { id: 'claude', label: 'Claude' },
  { id: 'opencode', label: 'OpenCode' },
  { id: 'antigravity', label: 'Antigravity' },
];
```

### Structure du composant

```tsx
export const QuickInputBar: React.FC<QuickInputBarProps> = ({
  agent, onAgentChange, prompt, onPromptChange, onSend, isPending, keyboardOffset,
}) => {
  const [agentOpen, setAgentOpen] = useState(false);
  const agentRef = useRef<HTMLDivElement>(null);
  useClickOutside(agentRef, () => setAgentOpen(false), agentOpen);

  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-2xl z-40 ..."
      style={{
        bottom: keyboardOffset > 0
          ? `${keyboardOffset + 16}px`
          : 'max(1rem, env(safe-area-inset-bottom))',
      }}
    >
      {/* Coller ici le JSX exact des lignes 408–458 de App.tsx */}
    </div>
  );
};
```

### Substitutions à faire dans le JSX copié

| Ancien (App.tsx) | Nouveau (QuickInputBar.tsx) |
|---|---|
| `ref={quickAgentRef}` | `ref={agentRef}` |
| `quickAgentOpen` | `agentOpen` |
| `setQuickAgentOpen(false)` | `setAgentOpen(false)` |
| `setQuickAgentOpen(!quickAgentOpen)` | `setAgentOpen(o => !o)` |
| `quickAgent` | `agent` |
| `setQuickAgent(a.id)` | `onAgentChange(a.id)` |
| `quickPrompt` | `prompt` |
| `onChange={(e) => setQuickPrompt(e.target.value)}` | `onChange={(e) => onPromptChange(e.target.value)}` |
| `quickPrompt.trim()` (onKeyDown et disabled) | `prompt.trim()` |
| `handleQuickSend()` | `onSend()` |
| `createTask.isPending` | `isPending` |

---

## Fichier 3 — Mise à jour de `App.tsx`

### Blocs entiers à supprimer

- `const AGENTS = [...]` en tête de fichier → déménage dans QuickInputBar
- `const burgerRef = useRef<HTMLDivElement>(null)` + son `useClickOutside`
- `const quickAgentRef = useRef<HTMLDivElement>(null)` + son `useClickOutside`
- `const quickInputRef = useRef<HTMLInputElement>(null)` (plus utilisé)
- Le JSX `<header>...</header>` (lignes 210–332)
- Le JSX `{selectedDirectory && (<div className="absolute left-1/2...">...</div>)}` (lignes 403–459)

### Variables d'état à supprimer

- `burgerOpen` → déménage dans AppHeader (état interne)
- `quickAgentOpen` → déménage dans QuickInputBar (état interne)

### Variables d'état à conserver dans App.tsx

- `quickPrompt`, `quickAgent` — passés en props à QuickInputBar
- `keyboardOffset` — passé en prop à QuickInputBar
- Tout le reste (sessions, tasks, filters, modals, selectedDirectory, viewMode…)

### Imports à supprimer dans App.tsx

```ts
// Supprimer ces imports devenus inutiles :
import { useClickOutside } from './hooks/useClickOutside';  // plus utilisé directement
import { useCallback } from 'react';                         // plus utilisé directement
import { LogoPunchline } from './components/LogoPunchline';
import { ThemeToggle } from './components/ThemeToggle';
import { AgentSelector, getAgentConfig } from './components/AgentSelector';
import { Menu, ChevronDown, MessageSquare } from 'lucide-react'; // si plus utilisés
```

### Imports à ajouter dans App.tsx

```ts
import { AppHeader } from './components/AppHeader';
import { QuickInputBar } from './components/QuickInputBar';
```

### JSX final du return dans App.tsx

```tsx
return (
  <div className={`relative flex flex-col h-[100dvh] overflow-hidden ${isDark ? 'dark bg-slate-900' : 'bg-gradient-to-br from-slate-100 via-white to-indigo-100'}`}>

    <AppHeader
      currentTitle={currentTitle}
      sessions={sessions}
      selectedDirectory={selectedDirectory}
      onSelectDirectory={setSelectedDirectory}
      viewMode={viewMode}
      onViewChange={setViewMode}
      onNewSession={() => setShowNewSession(true)}
      onNewTask={() => setShowNewTask(true)}
    />

    <main ref={tasksContainerRef} className="flex-1 min-h-0 overflow-y-auto w-full">
      {/* FilterBar + contenu — inchangé */}
    </main>

    {selectedDirectory && (
      <QuickInputBar
        agent={quickAgent}
        onAgentChange={setQuickAgent}
        prompt={quickPrompt}
        onPromptChange={setQuickPrompt}
        onSend={handleQuickSend}
        isPending={createTask.isPending}
        keyboardOffset={keyboardOffset}
      />
    )}

    {/* Modals NewSessionModal, NewTaskModal, TaskDetailModal — inchangées */}
  </div>
);
```

---

## Résumé des fichiers à créer/modifier

| Action | Fichier | Lignes résultantes estimées |
|---|---|---|
| Créer | `frontend/src/components/AppHeader.tsx` | ~130 lignes |
| Créer | `frontend/src/components/QuickInputBar.tsx` | ~70 lignes |
| Modifier | `frontend/src/App.tsx` | ~200 lignes (−300) |

---

## Ordre d'exécution recommandé

1. Créer `AppHeader.tsx` — copier le JSX, faire les substitutions, vérifier que la header s'affiche correctement
2. Créer `QuickInputBar.tsx` — copier le JSX, faire les substitutions, vérifier que l'input et l'envoi fonctionnent
3. Mettre à jour `App.tsx` — utiliser les deux nouveaux composants, supprimer les blocs déplacés, nettoyer les imports
4. Vérifier que TypeScript ne signale aucune erreur : `tsc --noEmit`
