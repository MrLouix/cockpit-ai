# 📅 Plan de Codage - AI Query Manager
*Projet : Gestion des requêtes IA avec décomposition automatique et suivi des agents CLI*

---

## 🎯 **Vue d'Ensemble**

| **Phase** | **Durée** | **Objectif Principal** | **Livrables** |
|-----------|-----------|------------------------|---------------|
| **Sprint 0** | 1 jour | Préparation & Architecture | Schémas BD, structure projets, docs |
| **Sprint 1** | 2-3 jours | Backend Core | API REST, CRUD, filtres |
| **Sprint 2** | 2-3 jours | Moteur IA | Intégration agents CLI, polling |
| **Sprint 3** | 3-4 jours | Frontend Core | UI responsive, tableau/cartes |
| **Sprint 4** | 2-3 jours | Fonctionnalités Avancées | Skip/Resume, sous-tâches UI |
| **Sprint 5** | 2 jours | Skill Interne | Décomposition automatique |
| **Sprint 6** | 1-2 jours | Finalisation | Tests, optimisation, docs |

**Durée totale estimée** : **13-18 jours** (selon disponibilité)

---

## 🏁 Sprint 0 : Préparation & Architecture

### 📌 **Objectif**
Préparer l'environnement et valider l'architecture technique.

### 📋 **Tâches**

#### 🔹 **Environnement** (1/2 journée)
- [ ] Installer Node.js 18+ sur la machine locale
- [ ] Installer MongoDB et vérifier le service (`mongod`)
- [ ] Vérifier que les agents CLI sont accessibles :
  - `claude --version`
  - `vibe --version`
  - `ag --version` (Antigravity)
  - `hermes --version`
  - `opencode --version`
- [ ] Créer un workspace dédié : `mkdir ai-query-manager && cd ai-query-manager`
- [ ] Initialiser Tailscale et vérifier la connectivité

#### 🔹 **Architecture** (1/2 journée)
- [ ] Créer la structure des dossiers :
  ```
  ai-query-manager/
  ├── backend/
  ├── engine/
  ├── frontend/
  └── skills/
  ```
- [ ] Valider le schéma MongoDB final (avec `executedByAgent`)
- [ ] Créer un diagramme d'architecture (Mermaid) :
  ```mermaid
  graph TD
    A[Frontend:3333] -->|API REST| B[Backend:3001]
    B --> C[MongoDB:27017]
    D[Engine] -->|Polling| C
    D -->|CLI Calls| E[Agents: Claude, Vibe, ...]
    B -->|WebSocket/Long Polling| A
  ```
- [ ] Documenter les endpoints API (OpenAPI/Swagger)
- [ ] Rédiger un README.md global avec la vision du projet

### ✅ **Livrables**
- [ ] Environnement fonctionnel (Node.js, MongoDB, agents CLI)
- [ ] Structure de projets validée
- [ ] Schéma MongoDB finalisé
- [ ] Diagramme d'architecture
- [ ] Documentation initiale (README.md)

### 📊 **Critères de Réussite**
- Tous les outils sont installés et fonctionnels
- La structure des dossiers est créée
- Le schéma BD est validé par l'équipe
- Les agents CLI répondent correctement

---

## 🚀 Sprint 1 : Backend Core

### 📌 **Objectif**
Développer l'API backend complète avec gestion des sessions, tâches et sous-tâches.

### 📋 **Tâches**

#### 🔹 **Configuration** (1/2 journée)
- [ ] Initialiser le projet backend : `npm init -y`
- [ ] Installer les dépendances :
  ```bash
  npm install express mongoose cors dotenv
  npm install --save-dev nodemon
  ```
- [ ] Configurer `package.json` (scripts, type: module)
- [ ] Créer `server.js` avec middleware (cors, json)
- [ ] Configurer la connexion MongoDB (`config/db.js`)
- [ ] Créer le fichier `.env` avec `MONGODB_URI` et `PORT=3001`

#### 🔹 **Modèles MongoDB** (1/2 journée)
- [ ] Créer `models/Session.js` :
  - Champs : `directory`, `titre`, `timestamps`
  - Index sur `directory`
- [ ] Créer `models/Task.js` :
  - Champs : `sessionId`, `prompt`, `agent`, **`executedByAgent`**, `status`, `result`, `subtasks`, `timestamps`
  - Statuts : `pending`, `running`, `success`, `pause`, `failed`, **`skipped`**
  - Sous-tâches : Même structure avec `executedByAgent`
  - Index sur `sessionId`, `status`, `executedByAgent`

#### 🔹 **Routes & Contrôleurs** (1-2 jours)
- [ ] Créer `routes/sessions.js` :
  - `GET /api/sessions` (liste)
  - `GET /api/sessions/:id` (détail)
  - `POST /api/sessions` (création)
  - `DELETE /api/sessions/:id` (suppression + cascade)
  - `GET /api/sessions/:id/tasks` (tâches d'une session)
- [ ] Créer `routes/tasks.js` :
  - `GET /api/tasks` (avec filtres `directory`, `status`, `limit`)
  - `GET /api/tasks/:id` (détail + populate session)
  - `POST /api/tasks` (création)
  - `PUT /api/tasks/:id` (mise à jour)
  - `DELETE /api/tasks/:id` (suppression)
  - `POST /api/tasks/:id/subtasks` (ajout sous-tâche)
  - **`PATCH /api/tasks/:id/skip`** (nouveau)
  - **`PATCH /api/tasks/:id/resume`** (nouveau)
  - **`PATCH /api/tasks/:id/subtasks/:subtaskId/skip`** (nouveau)
  - **`PATCH /api/tasks/:id/subtasks/:subtaskId/resume`** (nouveau)
- [ ] Créer les contrôleurs correspondants
- [ ] Ajouter un endpoint de santé : `GET /api/health`

#### 🔹 **Middlewares** (1/2 journée)
- [ ] Gestion des erreurs (`middlewares/errorHandler.js`)
- [ ] Validation des données (optionnel : Joi ou Zod)
- [ ] Logging basique (console.log)

#### 🔹 **Tests Unitaires** (1/2 journée - optionnel)
- [ ] Tests des modèles avec Jest/Mocha
- [ ] Tests des routes avec Supertest

### ✅ **Livrables**
- [ ] Backend fonctionnel avec toutes les routes
- [ ] Base de données MongoDB opérationnelle
- [ ] API testable avec Postman/curl
- [ ] Code commenté et documenté

### 📊 **Critères de Réussite**
- Toutes les routes fonctionnent (testées avec Postman)
- Les filtres par `directory` et `status` fonctionnent
- Les CRUD de base sont opérationnels
- Les nouveaux endpoints skip/resume sont implémentés

---

## ⚙️ Sprint 2 : Moteur IA

### 📌 **Objectif**
Développer le service qui exécute les agents CLI et gère le statut des tâches.

### 📋 **Tâches**

#### 🔹 **Configuration** (1/2 journée)
- [ ] Initialiser le projet engine : `npm init -y`
- [ ] Installer les dépendances :
  ```bash
  npm install mongoose dotenv
  ```
- [ ] Créer `aiEngine.js` (point d'entrée)
- [ ] Configurer la connexion MongoDB (même base que le backend)

#### 🔹 **Wrappers des Agents CLI** (1 jour)
- [ ] Créer `agents/index.js` (export unifié)
- [ ] Créer les wrappers individuels :
  - `agents/vibe.js` : Exécution de Vibe CLI
  - `agents/claude.js` : Exécution de Claude CLI
  - `agents/antigravity.js` : Exécution d'Antigravity CLI
  - `agents/hermes.js` : Exécution d'Hermès CLI
  - `agents/opencode.js` : Exécution d'OpenCode CLI
- [ ] Chaque wrapper doit :
  - Accepter un `prompt` en entrée
  - Retourner `{ success: boolean, result: string, error?: string }`
  - Gérer les timeouts (5 min par défaut)
  - Gérer les erreurs CLI

#### 🔹 **Configuration des Agents** (1/2 journée)
- [ ] Créer `config/agents.js` :
  - Mapping des commandes CLI
  - Timeouts par agent
  - Options spécifiques

#### 🔹 **Logique du Moteur** (1 jour)
- [ ] Implémenter `processTask()` :
  - Récupérer les tâches `pending` ou `running`
  - Mettre à jour le statut en `running`
  - Exécuter l'agent CLI
  - Stocker le résultat et `executedByAgent`
  - Mettre à jour le statut (`success`/`failed`)
  - Gérer les erreurs
- [ ] Implémenter `processSubtasks()` :
  - Traiter les sous-tâches `pending` ou `running`
  - Stocker `executedByAgent` pour chaque sous-tâche
  - Gérer les statuts `skipped` et `pause`
- [ ] Implémenter la boucle principale :
  - Polling toutes les **5 secondes** (`POLL_INTERVAL`)
  - Traiter les tâches et sous-tâches
  - Gestion des erreurs globales

#### 🔹 **Gestion des Signaux** (1/2 journée)
- [ ] Arrêt propre sur `SIGINT`/`SIGTERM`
- [ ] Déconnexion MongoDB

#### 🔹 **Détection de Décomposition** (1/2 journée - optionnel pour Sprint 2)
- [ ] Implémenter `detectSubtasks()` dans `agents/index.js`
- [ ] Intégrer avec le moteur pour création automatique

### ✅ **Livrables**
- [ ] Moteur IA fonctionnel
- [ ] Intégration complète avec les agents CLI
- [ ] Mise à jour automatique des statuts
- [ ] Stockage de `executedByAgent`

### 📊 **Critères de Réussite**
- Le moteur traite les tâches `pending` automatiquement
- Les statuts sont mis à jour correctement
- `executedByAgent` est rempli pour chaque tâche exécutée
- Le polling fonctionne sans fuites mémoire

---

## 🎨 Sprint 3 : Frontend Core

### 📌 **Objectif**
Développer l'interface utilisateur de base avec affichage des tâches et filtres.

### 📋 **Tâches**

#### 🔹 **Configuration** (1/2 journée)
- [ ] Initialiser le projet frontend :
  ```bash
  npm create vite@latest frontend -- --template react-ts
  cd frontend
  npm install
  ```
- [ ] Installer les dépendances :
  ```bash
  npm install @tanstack/react-query react-router-dom
  npm install -D tailwindcss postcss autoprefixer
  npm install -D @types/react @types/react-dom
  ```
- [ ] Configurer Tailwind CSS (`tailwind.config.js`, `postcss.config.js`)
- [ ] Configurer Vite (`vite.config.ts`) :
  - Port **3333**
  - Proxy API vers `http://localhost:3001`
- [ ] Configurer TypeScript (`tsconfig.json`)

#### 🔹 **Types & API Client** (1/2 journée)
- [ ] Créer `src/types/index.ts` :
  - `TaskStatus` (avec `skipped`)
  - `AgentType`
  - `Subtask`, `Task`, `Session`, `FilterParams`
  - Ajouter `executedByAgent` dans les interfaces
- [ ] Créer `src/api/client.ts` :
  - Fonctions pour chaque endpoint backend
  - Gestion des erreurs
  - Typage des réponses

#### 🔹 **Hooks React Query** (1/2 journée)
- [ ] Créer `src/hooks/useTasks.ts` :
  - `useSessions()`
  - `useTasks(params)`
  - `useTask(id)`
  - `useCreateTask()`, `useDeleteTask()`
  - `useArchiveTask()`, **`useSkipTask()`**, **`useResumeTask()`**
  - `useAddSubtask()`
  - `useCreateSession()`, `useDeleteSession()`

#### 🔹 **Composants UI** (1-2 jours)
- [ ] Créer `src/components/StatusBadge.tsx` :
  - Badges colorés par statut (inclure `skipped`)
- [ ] Créer `src/components/FilterBar.tsx` :
  - Filtre par `directory` (projet)
  - Filtre par `status` (inclure `skipped`)
  - Style responsive
- [ ] Créer `src/components/TaskTable.tsx` :
  - Tableau avec colonnes : Projet, Titre, Prompt, Agent, Statut, Dates
  - Clic sur une ligne pour voir les détails
  - Boutons d'action : Archivage, **Skip**, **Resume**, Suppression
- [ ] Créer `src/components/TaskCard.tsx` :
  - Affichage en carte pour la vue mobile
  - Même fonctionnalités que le tableau
  - Boutons **Skip/Resume** intégrés

#### 🔹 **Pages & Routing** (1 jour)
- [ ] Créer `src/App.tsx` :
  - État global (viewMode: table/cards)
  - Gestion des filtres (`selectedDirectory`, `selectedStatus`)
  - Appel aux hooks React Query
  - Handlers : `handleRowClick`, `handleArchiveTask`, **`handleSkipTask`**, **`handleResumeTask`**, `handleDeleteTask`, `handleAddSubtask`
  - Intégration de `TaskTable` et `TaskCard`
- [ ] Ajouter la barre de filtres
- [ ] Ajouter les boutons de toggle (Tableau/Cartes)
- [ ] Ajouter les boutons : Nouveau projet, Nouvelle tâche

#### 🔹 **Styles Globaux** (1/2 journée)
- [ ] Créer `src/styles/globals.css` :
  - Reset Tailwind
  - Styles personnalisés (scrollbar, code blocks)
  - Responsive design

### ✅ **Livrables**
- [ ] Frontend responsive (mobile + desktop)
- [ ] Affichage des tâches en tableau OU cartes
- [ ] Filtres fonctionnels
- [ ] Actions de base (archive, delete)
- **Actions Skip/Resume intégrées**

### 📊 **Critères de Réussite**
- L'UI est responsive (testé sur smartphone et PC)
- Les filtres par projet et statut fonctionnent
- Le toggle tableau/cartes fonctionne
- Les actions de base sont opérationnelles

---

## 🎯 Sprint 4 : Fonctionnalités Avancées

### 📌 **Objectif**
Ajouter les fonctionnalités avancées : modales, sous-tâches, et intégration complète des actions.

### 📋 **Tâches**

#### 🔹 **Modales** (1 jour)
- [ ] Créer `src/components/TaskDetailModal.tsx` :
  - Affichage du prompt et du résultat
  - Liste des sous-tâches avec leur statut
  - Formulaire d'ajout de sous-tâche
  - Boutons : **Skip**, **Resume**, Archive, Delete, Fermer
  - Affichage de `executedByAgent`
- [ ] Créer `src/components/NewTaskModal.tsx` :
  - Sélection de la session (projet)
  - Sélection de l'agent
  - Champ prompt (textarea)
  - Boutons : Créer, Annuler
- [ ] Créer `src/components/SubtaskCard.tsx` :
  - Affichage compact d'une sous-tâche
  - Statut, agent, résultat, dates

#### 🔹 **Intégration des Modales** (1/2 journée)
- [ ] Dans `App.tsx` :
  - État `selectedTask` pour la modale de détail
  - État `showNewTaskModal`
  - Appel des modales avec les bonnes props
- [ ] Passer les handlers : `onSkip`, `onResume`, `onAddSubtask`

#### 🔹 **Gestion des Sous-Tâches** (1/2 journée)
- [ ] Affichage du nombre de sous-tâches dans `TaskCard` et `TaskTable`
- [ ] Formulaire d'ajout de sous-tâche dans `TaskDetailModal`
- [ ] Sélection de l'agent pour les sous-tâches

#### 🔹 **Affichage de `executedByAgent`** (1/2 journée)
- [ ] Ajouter dans `TaskDetailModal` :
  - Affichage de l'agent exécutant pour la tâche principale
  - Affichage pour chaque sous-tâche
- [ ] Optionnel : Badge ou icône pour l'agent

#### 🔹 **Améliorations UI** (1/2 journée)
- [ ] Tooltips sur les boutons d'action
- [ ] Confirmation avant suppression/skip
- [ ] Animations (hover, transitions)
- [ ] Loading states pour les mutations

### ✅ **Livrables**
- [ ] Modales fonctionnelles
- [ ] Gestion complète des sous-tâches
- [ ] Affichage de `executedByAgent`
- [ ] UX améliorée

### 📊 **Critères de Réussite**
- Les modales s'ouvrent et se ferment correctement
- Les sous-tâches sont affichées et gérables
- `executedByAgent` est visible dans l'UI
- L'expérience utilisateur est fluide

---

## 🤖 Sprint 5 : Skill Interne & Décomposition

### 📌 **Objectif**
Implémenter le skill interne pour la décomposition automatique des requêtes.

### 📋 **Tâches**

#### 🔹 **Création du Skill** (1/2 journée)
- [ ] Créer `skills/ai-subtask-manager/SKILL.md`
- [ ] Rédiger le **Prompt System** :
  - Instructions de décomposition
  - Critères de détection
  - Format de réponse (`[DECOMPOSITION_DETECTEE]`)
  - Exemples concrets
- [ ] Documenter l'intégration technique

#### 🔹 **Détection Automatique** (1 jour)
- [ ] Dans `engine/agents/index.js` :
  - Implémenter `detectSubtasks(response)`
  - Parser le format `[DECOMPOSITION_DETECTEE]`
  - Extraire la liste des sous-tâches
- [ ] Créer `runAgentWithSubtaskDetection()` :
  - Appeler l'agent normalement
  - Détecter si décomposition nécessaire
  - Créer les sous-tâches dans MongoDB
  - Retourner un flag `hasSubtasks`

#### 🔹 **Intégration avec le Moteur** (1/2 journée)
- [ ] Modifier `processTask()` dans `aiEngine.js` :
  - Utiliser `runAgentWithSubtaskDetection()`
  - Si `hasSubtasks` : ne pas marquer comme terminé
  - Stocker le nombre de sous-tâches dans le résultat
- [ ] Vérifier que les sous-tâches créées ont le bon `sessionId`

#### 🔹 **Gestion des Sous-Tâches Créées** (1/2 journée)
- [ ] Dans le moteur IA :
  - Traiter les sous-tâches créées par décomposition
  - Mettre à jour la tâche principale quand toutes les sous-tâches sont terminées
  - Agrégation des résultats

#### 🔹 **UI pour la Décomposition** (1/2 journée - optionnel)
- [ ] Dans `TaskDetailModal` :
  - Afficher un message "Décomposition détectée : X sous-tâches créées"
  - Lien vers les sous-tâches
- [ ] Style visuel pour les tâches décomposées

### ✅ **Livrables**
- [ ] Skill `ai-subtask-manager` fonctionnel
- [ ] Détection automatique des décompositions
- [ ] Création automatique des sous-tâches
- [ ] Intégration complète avec le moteur IA

### 📊 **Critères de Réussite**
- Le skill est documenté et utilisable
- La détection fonctionne sur des prompts complexes
- Les sous-tâches sont créées automatiquement
- La tâche principale reste en `running` jusqu'à la fin de toutes les sous-tâches

---

## ✅ Sprint 6 : Finalisation & Déploiement

### 📌 **Objectif**
Finaliser le projet : tests, optimisation, documentation et déploiement.

### 📋 **Tâches**

#### 🔹 **Tests** (1 jour)
- [ ] Tests manuels complets :
  - Créer une session → créer une tâche → vérifier le statut
  - Tester skip/resume sur une tâche
  - Tester la décomposition automatique
  - Vérifier l'affichage de `executedByAgent`
  - Tester les filtres
- [ ] Tests automatisés (optionnel) :
  - Backend : Tests des routes avec Jest/Supertest
  - Frontend : Tests des composants avec Vitest
  - E2E : Cypress ou Playwright

#### 🔹 **Optimisation** (1/2 journée)
- [ ] Optimiser les requêtes MongoDB (indexes, projections)
- [ ] Optimiser le polling du moteur IA (éviter les requêtes inutiles)
- [ ] Minifier le frontend (build de production)
- [ ] Vérifier les performances sur mobile

#### 🔹 **Documentation** (1/2 journée)
- [ ] Compléter le README.md global :
  - Installation
  - Configuration
  - Lancement
  - Utilisation
- [ ] Documenter l'API (Swagger/OpenAPI)
- [ ] Documenter le skill `ai-subtask-manager`
- [ ] Créer un guide utilisateur

#### 🔹 **Déploiement Local** (1/2 journée)
- [ ] Vérifier que tout fonctionne ensemble :
  - MongoDB → Backend → Moteur IA → Frontend
- [ ] Tester sur Tailscale :
  - Accès depuis d'autres machines du réseau
  - Vérifier la connectivité
- [ ] Créer des scripts de lancement :
  - `start-backend.sh`
  - `start-engine.sh`
  - `start-frontend.sh`

#### 🔹 **Sauvegarde & Versioning** (1/2 journée)
- [ ] Initialiser Git :
  ```bash
  git init
  git add .
  git commit -m "Initial commit"
  ```
- [ ] Créer un `.gitignore` (node_modules, .env, etc.)
- [ ] Taguer la version : `git tag v1.0.0`

### ✅ **Livrables**
- [ ] Projet complètement fonctionnel
- [ ] Documentation complète
- [ ] Tests validés
- [ ] Déploiement local opérationnel

### 📊 **Critères de Réussite**
- Toutes les fonctionnalités sont testées et validées
- La documentation est complète et claire
- Le projet est prêt pour une utilisation en production (locale)
- Le code est versionné et sauvegardé

---

## 📊 **Récapitulatif des Sprint**

| Sprint | Durée | Focus | Livrables Clés |
|--------|-------|-------|-----------------|
| **0** | 1 jour | Préparation | Environnement, Architecture |
| **1** | 2-3 j | Backend | API REST, CRUD, Skip/Resume |
| **2** | 2-3 j | Moteur IA | Agents CLI, Polling, executedByAgent |
| **3** | 3-4 j | Frontend | UI Responsive, Tableau/Cartes |
| **4** | 2-3 j | Avancé | Modales, Sous-tâches, UX |
| **5** | 2 j | Skill | Décomposition automatique |
| **6** | 1-2 j | Finalisation | Tests, Docs, Déploiement |

**Total** : **13-18 jours**

---

## 🎯 **Priorités & Dépannage**

### 🔴 **Critique (Doit être fait)**
- Sprint 0 : Sans environnement, rien ne fonctionne
- Sprint 1 : Sans backend, pas de données
- Sprint 2 : Sans moteur IA, pas d'exécution
- Sprint 3 : Sans frontend, pas d'interface

### 🟡 **Important (Fortement recommandé)**
- Sprint 4 : Fonctionnalités avancées pour une bonne UX
- Sprint 5 : Skill pour la décomposition automatique

### 🟢 **Optionnel (Améliorations)**
- Tests automatisés (Sprint 6)
- Documentation Swagger (Sprint 6)
- Scripts de lancement (Sprint 6)

### ⚠️ **Problèmes Courants & Solutions**

| Problème | Solution |
|----------|----------|
| MongoDB ne démarre pas | `sudo systemctl start mongod` |
| Agents CLI non trouvés | Vérifier le PATH ou les alias |
| CORS errors | Vérifier le middleware CORS dans le backend |
| Port déjà utilisé | Changer le port dans `.env` et `vite.config.ts` |
| Dépendances manquantes | `npm install` dans chaque dossier |
| Polling trop fréquent | Augmenter `POLL_INTERVAL` dans `aiEngine.js` |

---

## 📈 **Suivi des Sprint**

### **Template de Suivi Quotidien**

```markdown
## [Date] - Sprint [X] Jour [Y]

### ✅ Fait Hier
- [ ] Tâche 1
- [ ] Tâche 2

### 🎯 Aujourd'hui
- [ ] Tâche 3
- [ ] Tâche 4

### ⚠️ Blocages
- Problème 1 : [Description] → [Solution envisagée]

### 📊 Avancement
- Sprint [X] : [XX]% complet
```

### **Tableau de Bord**

| Sprint | Début | Fin | Statut | Avancement |
|--------|-------|-----|--------|------------|
| 0 | J1 | J1 | ⬜ | 0% |
| 1 | J2 | J4 | ⬜ | 0% |
| 2 | J5 | J7 | ⬜ | 0% |
| 3 | J8 | J11 | ⬜ | 0% |
| 4 | J12 | J14 | ⬜ | 0% |
| 5 | J15 | J16 | ⬜ | 0% |
| 6 | J17 | J18 | ⬜ | 0% |

**Légende** : ⬜ = À faire | 🟡 = En cours | ✅ = Terminé

---

## 💡 **Conseils**

1. **Commence par Sprint 0** : Sans environnement, tu ne peux rien faire.
2. **Teste chaque sprint** : Valide que tout fonctionne avant de passer au suivant.
3. **Priorise le backend** : Sans données, le frontend n'a rien à affich