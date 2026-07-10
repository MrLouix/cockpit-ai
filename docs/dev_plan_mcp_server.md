# Spécification — Serveur MCP pour CockpitAI

## Contexte

CockpitAI orchestre des agents CLI IA (claude, hermes, vibe, antigravity, opencode) sur des tâches organisées par "sessions" (projets liés à un répertoire filesystem). Aujourd'hui, la seule façon de déposer une tâche ou de suivre son exécution est le dashboard React, qui consomme l'API REST Express (`backend/routes/sessions.js`, `backend/routes/tasks.js`).

L'objectif de ce second plan : exposer un **serveur MCP (Model Context Protocol)** permettant à un agent IA externe (Claude Code, Claude Desktop, ou tout autre client MCP) de déposer des requêtes de codage et de piloter/suivre leur exécution directement, sans passer par l'UI web — le pendant "agent-to-agent" du dashboard humain existant.

**Contrainte de conception majeure** : ce plan est indépendant du plan de migration MongoDB → Redis + BullMQ (`docs/dev_plan_redis_bullmq.md`). Le serveur MCP ne parle **qu'à l'API REST du backend** (jamais directement à Mongoose, Redis ou BullMQ) — il fonctionne donc à l'identique, que la migration Redis ait eu lieu ou non, tant que `backend` expose le même contrat REST.

**Décisions actées avec l'utilisateur :**
- **Double transport** : stdio (subprocess local, ex. config Claude Desktop/Claude Code) **et** Streamable HTTP (accès réseau distant), à partir de la même logique d'outils.
- **Authentification minimale par clé API**, uniquement sur le transport HTTP — le reste de l'API REST du backend reste inchangé (aucune auth), hors scope de ce plan.
- **Surface d'outils ciblée** "création + suivi" (7 outils), pas de parité CRUD complète avec la REST API — pas de suppression, pas d'update générique.

---

## Architecture

Nouveau composant `mcp/`, pair de `backend/`, `engine/`, `frontend/` (même convention : package npm indépendant, `"type":"module"`, son propre `package.json`/lockfile/tests). Ce n'est **pas** intégré dans `backend/` :
- ça éviterait la tentation d'appeler Mongoose/les handlers de routes directement plutôt que la REST API, cassant la contrainte "MCP ne parle qu'à la REST API" (garantit la survie du plan à la migration Redis) ;
- ça éviterait de mélanger deux protocoles (Express REST + transport MCP Streamable HTTP, avec sa propre gestion de `Mcp-Session-Id`) dans une seule app ;
- ça garde `backend/package.json` libre de toute dépendance MCP (`@modelcontextprotocol/sdk`, `zod`) sans rapport avec son rôle.

`mcp/` n'a besoin d'aucune dépendance lourde (`mongoose`, `ioredis`, `bullmq` exclus) — juste `@modelcontextprotocol/sdk`, `zod` (schémas d'entrée des outils), `dotenv`, et `express` (uniquement comme point de montage du transport HTTP).

```
mcp/
├── package.json
├── .env.example                 # MCP_API_KEY, BACKEND_API_URL, MCP_HTTP_PORT
├── src/
│   ├── server.js                # construit McpServer, enregistre les 7 outils (agnostique du transport)
│   ├── backendClient.js         # client fetch fin vers l'API REST de backend/
│   ├── tools/{createSession,listSessions,createTask,getTask,listTasks,skipTask,resumeTask}.js
│   ├── stdio.js                 # point d'entrée subprocess local
│   └── http.js                  # point d'entrée réseau (Express + auth + Streamable HTTP)
└── tests/
    ├── tools.test.js             # unitaire, backend mocké
    └── http.integration.test.js  # round-trip réel via un vrai client MCP
```

---

## Les 7 outils MCP

Chaque outil est enregistré via `server.registerTool(name, {title, description, inputSchema}, handler)`. La `description` est écrite pour être comprise par un agent LLM appelant. Chaque handler appelle `backendClient.js`, puis mappe la réponse :
- 2xx → `CallToolResult` normal, contenu en JSON (pas de prose) puisque l'appelant principal est un autre agent qui va réutiliser les IDs retournés dans des appels suivants ;
- 4xx (400/404 du backend) → `CallToolResult` avec `isError:true` et le message du backend — un 404 sur `get_task` est un résultat attendu/récupérable pour l'appelant, pas un crash protocolaire ;
- 5xx/erreur réseau (backend injoignable) → `isError:true` avec un message distinct ("backend unreachable") pour différencier "tâche introuvable" de "problème d'infra".

| Outil | Entrée (zod) | Appel REST | Notes |
|---|---|---|---|
| `create_session` | `directory, titre` | `POST /api/sessions` | Pas d'`update_session`/`delete_session` — REST/dashboard only. |
| `list_sessions` | `directoryFilter?` | `GET /api/sessions` | Filtre appliqué **côté client de l'outil** (le backend n'a pas de `GET /api/sessions?directory=` — seul `GET /api/tasks?directory=` existe) ; à documenter explicitement pour ne pas laisser croire à un filtre serveur. |
| `create_task` | `sessionId, prompt, agent?` | `POST /api/tasks` | Nécessite un `sessionId` explicite — **pas** de résolution/création implicite depuis un `directory` (voir justification ci-dessous). |
| `get_task` | `taskId` | `GET /api/tasks/:id` | Retourne le contenu quasi tel quel (statut, résultat, subtasks). |
| `list_tasks` | `directory?, status?, limit?` | `GET /api/tasks?directory=&status=&limit=` | Passe les filtres tels quels — le backend les supporte nativement ici. |
| `skip_task` | `taskId` | `PATCH /api/tasks/:id/skip` | 400 "already skipped" remonté tel quel comme erreur d'outil, pas un crash. |
| `resume_task` | `taskId` | `PATCH /api/tasks/:id/resume` | idem pour "cannot be resumed from its current status". |

**Pourquoi `create_task` exige `sessionId` et ne résout pas implicitement un `directory`** : `directory` n'est pas unique dans le modèle de données (index non-unique) — une résolution automatique "la session pour ce répertoire" serait ambiguë dès que deux sessions partagent un répertoire, et une création implicite de session au passage contredirait l'intention "surface ciblée, pas d'effet de bord caché" derrière le choix de ne pas exposer de CRUD complet. Le flux en deux étapes (`list_sessions` → éventuellement `create_session` → `create_task`) coûte un appel d'outil de plus mais reste prévisible. Une évolution possible en v2 : un outil `find_session_by_directory` (lecture seule, pas d'écriture) si l'ergonomie s'avère un vrai problème — pas inclus dans ce scope.

**Explicitement hors scope** (par choix, à documenter dans `docs/mcp_server.md` pour que ce ne soit pas lu comme un oubli) : `delete_session`, `delete_task`, `update_session`/`update_task` génériques (l'échappatoire `PUT` "écrire n'importe quoi"), et le skip/resume au niveau sous-tâche (`skip_subtask`/`resume_subtask` — candidat naturel pour une v2 une fois le flux principal validé).

---

## Double transport

**`mcp/src/server.js`** construit un `McpServer` unique (`buildMcpServer()`) sans transport attaché — les deux points d'entrée réutilisent exactement la même logique d'outils.

**`mcp/src/stdio.js`** : `const server = buildMcpServer(); await server.connect(new StdioServerTransport());` — rien d'autre. C'est ce qu'un utilisateur pointe directement dans sa config MCP locale (`.mcp.json` de Claude Code, config Claude Desktop) : `{"command": "node", "args": ["/abs/path/mcp/src/stdio.js"]}`.

**`mcp/src/http.js`** : app Express, endpoint `/mcp` (POST/GET/DELETE, convention Streamable HTTP). Mode **stateful** recommandé (pattern standard du SDK) : une `Map<sessionId, transport>` en mémoire, un `initialize` sans header `Mcp-Session-Id` crée une nouvelle session (`StreamableHTTPServerTransport` + `McpServer` frais via `buildMcpServer()`), les requêtes suivantes avec le header réutilisent la session existante ; nettoyage de la map à la fermeture du transport. C'est de la pure plomberie de cycle de vie de connexion — aucun des 7 outils ne porte d'état métier propre (chaque appel est un aller-retour REST indépendant vers `backend`).

---

## Authentification (HTTP uniquement)

- `MCP_API_KEY` (secret partagé unique, pas de système utilisateur/rôle) dans `mcp/.env`.
- Middleware Express monté **avant** le handler `/mcp`, donc avant tout traitement du protocole MCP : vérifie `Authorization: Bearer <key>` ou `X-API-Key: <key>` (support des deux formats, les clients MCP HTTP varient dans leur capacité à fixer des headers custom). Absent/invalide → `401` brut, sans forme MCP, retourné immédiatement.
- Comparaison en temps constant (`crypto.timingSafeEqual`), pas de `===` — point de sécurité à faire correctement dès le départ vu qu'il n'y a aucun précédent d'auth dans le repo.
- Le `/health` du serveur MCP reste **non authentifié**, cohérent avec les endpoints `/health` existants de `backend`/`engine` (supervision sans credential).
- **stdio n'a pas besoin d'auth** : c'est un subprocess local spawné par le client MCP appelant, sous le même utilisateur OS — pas de saut réseau, la frontière de confiance est "qui peut lancer des process sur cette machine", comme n'importe quel autre outil CLI local. Ajouter une clé n'apporterait aucune sécurité réelle (elle vivrait dans le même fichier de config que la commande de lancement).
- **Deux frontières de confiance empilées, à documenter explicitement** : `MCP_API_KEY` protège l'entrée dans la couche MCP (l'appelant externe) ; une fois passé ce contrôle, le serveur MCP agit comme client interne de confiance de l'API REST du backend, qui reste totalement ouverte — exactement le même niveau de confiance que celui du `frontend` aujourd'hui. La clé ne devient donc pas une restriction de capacité une fois à l'intérieur (l'appelant authentifié a accès à toute la surface des 7 outils) — limitation assumée, resserrer `backend` lui-même est hors scope.

---

## Ops

- **Mode HTTP ajouté à `restart.sh`** comme 4ème bloc de service (même style que les 3 existants : `pkill` par pattern, démarrage `node --watch mcp/src/http.js` en arrière-plan, port par défaut `3334` via `MCP_HTTP_PORT`, ajouté au résumé final des PIDs/URLs).
- **Mode stdio n'est explicitement pas géré par `restart.sh`** — ce n'est pas un démon persistant, mais un process spawné à la demande par le client MCP appelant. Documenté dans `docs/mcp_server.md` (extrait de config `.mcp.json`), pas dans le script de démarrage.
- `mcp/.env.example` dédié (`MCP_API_KEY`, `BACKEND_API_URL=http://localhost:3331`, `MCP_HTTP_PORT=3334`), cohérent avec la convention un-`.env.example`-par-composant déjà en place.

---

## Tests

- **Unitaires** (`mcp/tests/tools.test.js`) : backend mocké via `undici` `MockAgent` (intercepte `fetch` nativement, pas besoin de restructurer `backendClient.js`). Couvre, pour chacun des 7 outils, le tableau de mapping statut HTTP → `isError`/contenu (200/201, 400, 404, 500, erreur réseau) — c'est la partie avec le plus de règles métier, à tester de façon exhaustive.
- **Intégration** (`mcp/tests/http.integration.test.js`) : un vrai `backend` démarré en mémoire (réutilise le pattern `mongodb-memory-server` déjà en place dans `backend/tests/*.routes.test.js` — bascule sans douleur vers l'équivalent Redis si la migration a eu lieu d'ici là, puisque ce test ne parle qu'à `backend` par HTTP), un vrai `mcp/src/http.js`, piloté par un vrai `Client`/`StreamableHTTPClientTransport` du SDK MCP (pas du fetch brut) — un chemin heureux représentatif + le rejet d'auth (401 sans clé) + un cas 404. Un test de fumée léger en stdio (`StdioClientTransport` contre `mcp/src/stdio.js` spawné) confirme que ce mode fonctionne sans clé API.

---

## Docs

- **README.md** : diagramme d'architecture étendu avec un 4ème bloc (MCP Server, HTTP+stdio), client de `Backend` au même titre que `Frontend` (pas de lien direct vers Mongo/Redis, pour rester honnête sur la contrainte de découplage). Ligne ajoutée au tableau Sprint, section Features, entrée dans "Project Structure", section Quick Start.
- **Nouveau `docs/mcp_server.md`** : référence complète — tableau des 7 outils, recettes de configuration des deux transports (exemple HTTP avec headers, extrait `.mcp.json` pour stdio), explication du modèle d'auth et des deux frontières de confiance empilées, et un encart explicite "ce qui n'est pas exposé et pourquoi" (delete/update génériques, skip/resume de sous-tâches).

---

## Phasage

1. **Scaffolding + logique d'outils** (~1j) — `package.json`, `backendClient.js`, les 7 modules d'outils avec schémas zod + mapping d'erreurs, `server.js`. Tests unitaires écrits en parallèle (c'est la partie à la plus grosse surface de règles).
2. **Transport stdio** (~0.5j) — `stdio.js`, test manuel `create_session`→`create_task`→`get_task` en bout en bout contre un vrai `backend`.
3. **Transport Streamable HTTP + auth** (~1–1.5j) — `http.js` (Express, map de sessions, middleware `requireApiKey`, `/health`), test manuel des chemins auth-accepté/auth-rejeté.
4. **Tests** (~1j) — complétion `tools.test.js`, `http.integration.test.js` (backend réel + client MCP réel + cas d'auth), smoke test stdio.
5. **Docs & ops** (~0.5–1j) — README, `docs/mcp_server.md`, `mcp/.env.example`, 4ème bloc dans `restart.sh`, vérification manuelle complète.

**Total estimé : ~4-5 jours-personne.** Ce plan peut être mené en parallèle du plan Redis + BullMQ, sans dépendance dans un sens ou l'autre — `mcp/` n'importe jamais rien de `backend/models`, `backend/config/db.js` ni du futur `shared/redis`/`shared/queue`, uniquement `BACKEND_API_URL`.

---

## Vérification

- Suites de tests `mcp/` vertes (unitaires + intégration).
- `restart.sh` démarre les 4 services ; un client MCP HTTP réel (avec puis sans clé API) exécute `create_session` → `create_task` → `get_task` → `skip_task` → `resume_task` de bout en bout.
- Un client MCP en mode stdio (config `.mcp.json` pointée sur `mcp/src/stdio.js`) exécute le même scénario indépendamment de `restart.sh`.
- Vérifier qu'un appel HTTP sans clé API (ou avec une clé invalide) est rejeté en 401 avant tout traitement MCP.
- Vérifier qu'un `get_task`/`skip_task`/`resume_task` sur un ID inexistant renvoie une erreur d'outil MCP lisible (`isError:true`), pas un crash du serveur.
