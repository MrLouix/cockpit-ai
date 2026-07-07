# Dev Plan : Card View → Chat View

## Contexte

**Cible** : Transformer la grille de `TaskCard` en un fil de conversation à bulles, style chat.
**Stack** : React 19 + TypeScript + Tailwind CSS v4 + TanStack Query
**Périmètre** : Frontend uniquement — le backend et les hooks de données ne changent pas.

---

## Phase 1 — Nouveau composant `ChatMessage`

**Fichier** : `frontend/src/components/ChatMessage.tsx`

Remplace `TaskCard.tsx` comme unité visuelle de base. Chaque `Task` devient deux bulles :

```
┌─────────────────────────────────────┐
│  [Avatar Agent]  • Prompt envoyé    │  ← bulle "user" (droite)
│                                     │
│  [Avatar Agent]  Résultat / état    │  ← bulle "agent" (gauche)
│                  [Skip][Resume][Del] │
└─────────────────────────────────────┘
```

**Sous-tâches :**
1. Bulle prompt (droite) : fond neutre, texte complet avec `line-clamp-4 expandable`
2. Bulle agent (gauche) : couleur par agent (`antigravity`, `hermes`, `claude`…), badge statut animé
3. Avatar agent : icône SVG 32x32 par `AgentType` (réutiliser les couleurs existantes de `AgentSelector`)
4. Zone résultat : collapsible avec bouton "Voir plus", fond `bg-muted/40`
5. Actions hover : `Skip`, `Resume`, `Delete` sur la bulle agent
6. Sous-tâches inline : liste pliable sous la bulle agent

**Props interface :**
```typescript
interface ChatMessageProps {
  task: Task;
  onSkip: (id: string) => void;
  onResume: (id: string) => void;
  onDelete: (id: string) => void;
  onClick: (task: Task) => void;
}
```

---

## Phase 2 — Nouveau composant `ChatView`

**Fichier** : `frontend/src/components/ChatView.tsx`

Conteneur qui remplace la grille CSS. Reçoit la liste des tasks filtrées et les affiche en fil vertical.

**Structure :**
```tsx
<div className="flex flex-col gap-4 px-4 pb-32">
  {groupedByDate.map(group => (
    <DateSeparator date={group.date} />
    {group.tasks.map(task => <ChatMessage ... />)}
  ))}
  <div ref={bottomRef} />   // ancre pour auto-scroll
</div>
```

**Comportements :**
- **Auto-scroll** : `useEffect` sur `tasks.length` → scroll vers `bottomRef` (logique déjà dans `App.tsx`, à migrer ici)
- **Groupement par date** : séparateur `Aujourd'hui`, `Hier`, `DD/MM/YYYY`
- **Reverse chronologique** : les plus récents en bas (comme un chat)
- **Loading skeleton** : 3 bulles fantômes pendant le fetch initial

---

## Phase 3 — Intégration dans `App.tsx`

**Fichier** : `frontend/src/App.tsx`

**Changements minimes :**

1. Ajouter `'chat'` au type `ViewMode` :
   ```typescript
   type ViewMode = 'cards' | 'table' | 'chat';  // 'chat' added
   ```

2. Ajouter le bouton "Chat" dans le toggle de vue (header) :
   ```
   [Table] [Cards] [Chat]   ← icône MessageSquare (Lucide)
   ```

3. Conditionnel dans le rendu :
   ```typescript
   {viewMode === 'chat' && (
     <ChatView tasks={filteredTasks} onSkip=... onResume=... onDelete=... />
   )}
   ```

4. Optionnel : sauvegarder `viewMode` dans `localStorage` pour persistance.

---

## Phase 4 — Ajustements de la `QuickInputBar`

**Fichier** : `App.tsx` (section bottom bar)

La barre de saisie existante est déjà correcte pour le chat. Petits ajustements visuels :

- Arrondir davantage le champ texte (`rounded-2xl`)
- Bouton envoi : remplacer "Créer" par une icône `Send` (Lucide)
- Animation de loading pendant la création d'une task (spinner dans le bouton)

---

## Phase 5 — Styles et tokens

**Fichier** : `frontend/src/index.css`

Ajouter les variables CSS pour les bulles :

```css
/* Chat bubbles */
.chat-bubble-user   { @apply bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-br-sm; }
.chat-bubble-agent  { @apply rounded-2xl rounded-bl-sm; }
.chat-avatar        { @apply w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0; }
```

Couleurs par agent (réutiliser la logique de `AgentSelector.tsx`) :

| Agent | Bubble bg | Border |
|---|---|---|
| `claude` | `bg-violet-50 dark:bg-violet-950/30` | `border-violet-300` |
| `hermes` | `bg-amber-50 dark:bg-amber-950/30` | `border-amber-300` |
| `antigravity` | `bg-cyan-50 dark:bg-cyan-950/30` | `border-cyan-300` |
| `vibe` | `bg-pink-50 dark:bg-pink-950/30` | `border-pink-300` |
| `opencode` | `bg-emerald-50 dark:bg-emerald-950/30` | `border-emerald-300` |

---

## Phase 6 — Tests

**Fichier** : `engine/tests/agents.test.js`

Vérifier que les tests existants passent toujours. Ajouter si nécessaire :
- Rendu de `ChatMessage` avec chaque statut (`pending`, `running`, `success`, `failed`, `pause`, `skipped`)
- Auto-scroll déclenché quand `tasks.length` augmente
- Groupement par date correct

---

## Ordre d'exécution recommandé

```
1. ChatMessage.tsx        ← composant isolé, testable seul
2. ChatView.tsx           ← conteneur, dépend de ChatMessage
3. App.tsx patch          ← +5 lignes, non destructif
4. index.css tokens       ← cosmétique
5. QuickInputBar polish   ← optionnel
6. Tests                  ← validation finale
```

---

## Ce qui NE change PAS

- `TaskDetailModal.tsx` — modal de détail inchangée, accessible depuis les bulles
- `useTasks.ts` — tous les hooks réutilisés tels quels
- `TaskTable.tsx` — vue table conservée
- Backend complet — zéro modification API
- `FilterBar.tsx` — fonctionne en mode chat comme en mode cards

---

## Estimation

| Phase | Complexité | Temps estimé |
|---|---|---|
| ChatMessage | Moyenne | 2-3h |
| ChatView | Faible | 1h |
| App.tsx patch | Très faible | 30min |
| Styles | Faible | 30min |
| QuickInputBar | Très faible | 30min |
| Tests | Faible | 1h |
| **Total** | | **~6h** |
