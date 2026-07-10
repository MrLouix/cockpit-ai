# Spécification — Abandon de MongoDB au profit de Redis + BullMQ

## Contexte

CockpitAI est un tableau de bord full-stack qui orchestre des agents CLI IA (claude, hermes, vibe, antigravity, opencode) sur des tâches organisées par "sessions" (projets). Le stack est **100% Node.js/TypeScript** (Express + Mongoose côté `backend/`, worker de polling en Node côté `engine/`, React/Vite côté `frontend/`) — aucune trace de Python dans le repo.

Aujourd'hui, MongoDB joue un double rôle : c'est à la fois le stockage persistant des sessions/tâches **et** la queue de travail elle-même. `engine/aiEngine.js` interroge la collection `tasks` toutes les 5s (`Task.find({status:{$in:['pending','running']}})`), ce qui est un polling naïf, non atomique par endroits (races documentées sur les mises à jour de sous-tâches), et sans vraie sémantique de retry/observabilité de queue.

La demande initiale était "Redis Streams + Celery". Après investigation (le repo est 100% Node, Celery est Python-only) et discussion, la décision retenue est **Redis + BullMQ** : équivalent Node-natif de Celery, avec persistance des jobs dans Redis, retries avec backoff, et un mécanisme "Flows" pertinent pour le pattern tâche/sous-tâches actuel. Ce choix évite d'introduire un second runtime (Python) et un pont fragile entre les deux langages, pour un gain fonctionnel équivalent sur le périmètre de cet outil.

**Décisions actées avec l'utilisateur :**
- Cutover à froid — pas de reprise des données MongoDB existantes, Redis démarre vide.
- Redis opéré en process nu (`redis-server`), cohérent avec le style ops actuel de `restart.sh` (pas de Docker introduit).
- Le refactor corrige au passage le bug connu de `aiEngine.js` où un skip pendant l'exécution d'une tâche est silencieusement écrasé par le résultat de l'agent qui revient ensuite.

---

## Architecture cible

- **Redis** (instance unique, persistance AOF + RDB) devient l'unique datastore, à deux niveaux :
  - des structures Redis "métier" (hash/sorted sets) qui remplacent les documents Mongoose et servent de source de vérité pour l'API REST ;
  - les structures internes de BullMQ (namespace `bull:cockpitai:tasks:*`), gérées par la librairie, utilisées uniquement pour piloter l'exécution (dispatch, retry, delay).
- **`backend/`** — l'API Express ne change pas de responsabilité : elle écrit les hash/index Redis métier et enqueue/annule des jobs BullMQ. Elle ne fait jamais tourner de `Worker`.
- **`engine/`** — fait tourner un unique `Worker` BullMQ sur la queue `cockpitai:tasks`, remplaçant la boucle `setTimeout` de `mainLoop`. Devient événementiel plutôt que polling. Conserve son endpoint `/health`.
- **`shared/`** (nouveau dossier) — modules d'accès aux données et à la queue, partagés par `backend/` et `engine/`, qui remplacent les deux définitions Mongoose dupliquées à l'identique aujourd'hui (`backend/models/*.js` et `engine/models/*.js`).

### Contrainte de concurrence par session (remplace `busySessions`)

Aujourd'hui, `mainLoop` construit un `Set` de sessions "occupées" pour garantir qu'une seule tâche/sous-tâche s'exécute à la fois par session (évite deux process CLI concurrents dans le même `directory`).

**Solution retenue : une seule `Queue`/`Worker` globale + verrou Redis par session**, plutôt que :
- une queue BullMQ par session (rejeté — O(N) connexions Redis persistantes, gestion de cycle de vie inutilement complexe) ;
- le paramètre `concurrency`/rate-limiter de BullMQ (rejeté comme mécanisme unique — c'est un plafond global sur la queue, pas un partitionnement par clé arbitraire comme `sessionId`; cette fonctionnalité de "concurrency group" est réservée à BullMQ Pro).

Le processor du Worker acquiert un verrou `SET session:lock:{sessionId} <token> NX PX <ttl>` avant de spawn un agent CLI, le renouvelle (heartbeat) pendant toute la durée de l'appel `runAgent()`, et le libère (`DEL` conditionné au token, via script Lua) dans un `finally`. Si le verrou est déjà pris, le job appelle `job.moveToDelayed(...)` puis `throw new DelayedError()` (API BullMQ dédiée) — le job repart en `delayed` sans consommer de tentative de retry ni déclencher un `failed` factice.

Ce mécanisme unique couvre à la fois "une tâche active par session" et "les sous-tâches s'exécutent séquentiellement" (tâche et sous-tâches d'une même session se disputent la même clé de verrou).

---

## Modèle de données Redis

Tous les index de liste sont des **ZSET** scorés par `createdAt` (timestamp epoch ms) — tri gratuit via `ZREVRANGE`/`ZRANGE`, comptage gratuit via `ZCARD`.

**Session** — `session:{sessionId}` (HASH) : `_id, directory, titre, createdAt, updatedAt`.
Index : `sessions:all` (ZSET) ; `sessions:by-directory:{directory}` (SET) pour le filtre `?directory=`.

**Task** — `task:{taskId}` (HASH) : `_id, sessionId, prompt, agent, status, result, executedByAgent, endDate, createdAt, updatedAt`. Les sous-tâches ne sont **pas** imbriquées dans ce hash.
Index : `tasks:all` (ZSET) ; `tasks:by-status:{status}` — une ZSET par valeur d'énum (`pending|running|success|pause|failed|skipped`) ; `tasks:by-session:{sessionId}` (ZSET).

Toute transition de `status` doit être atomique (MULTI/EVAL) : `HSET` + `ZREM` de l'ancien index `by-status` + `ZADD` du nouveau + `updatedAt`. Corrige directement le pattern read-modify-save non atomique actuel.

**Subtask** — `task:{taskId}:subtask:{subtaskId}` (HASH), mêmes champs que Task. Ordre préservé via `task:{taskId}:subtasks` (LIST, `RPUSH` à la création) — équivalent de l'ordre du tableau embarqué actuel.

**Correspondance ID Task/Subtask ↔ job BullMQ** : même ID pour le hash Redis métier et le job BullMQ (`queue.add('task', data, {jobId: taskId})`). IDs générés via `crypto.randomUUID()` (aucune dépendance nouvelle ; rien dans le code actuel ne dépend du format ObjectId de Mongo, tout le tri se fait sur `createdAt` explicite).

Le hash interne de BullMQ n'est jamais lu directement par les routes REST (il ne représente pas des statuts métier comme `pause`/`skipped`) — le hash métier reste l'unique source de vérité pour l'API ; le job BullMQ ne pilote que l'exécution.

---

## Organisation des modules

**Nouveau dossier `shared/`** (imports ESM relatifs, pas de tooling workspace — aucun n'existe aujourd'hui) :
- `shared/redis/client.js` — client `ioredis` singleton depuis `REDIS_URL`.
- `shared/redis/keys.js` — source unique de vérité pour tous les noms de clés.
- `shared/redis/sessionStore.js`, `shared/redis/taskStore.js` — CRUD + transitions atomiques.
- `shared/redis/locks.js` — `withSessionLock(sessionId, fn)`.
- `shared/redis/rateLimitStore.js` — `getAgentRateLimitUntil(agentType)`, `reportAgentRateLimit(agentType, untilMs)`, `clearAgentRateLimit(agentType)` (coordination globale du rate limit par type d'agent, voir "Gestion des rate limits des agents CLI").
- `shared/queue/connection.js`, `shared/queue/taskQueue.js` — config BullMQ, `Queue` singleton (`QUEUE_NAME='cockpitai:tasks'`).

**Supprimés** : `backend/models/{Task,Session}.js`, `backend/config/db.js`, `engine/models/{Task,Session}.js`, ainsi que `backend/middlewares/errorHandler.js` (doublon mort déjà non importé nulle part — nettoyage opportuniste).

**backend/** : `backend/config/redis.js` remplace `connectDB()` (appelé depuis `backend/server.js`) ; `backend/routes/tasks.js` et `backend/routes/sessions.js` réécrits en place.

**engine/** : nouveau `engine/processor.js` (exporte `processTaskJob(job, token)` / `processSubtaskJob(job, token)`, successeurs directs de `processTask`/`processSubtasks` — même forme de fonction pure pour limiter la casse sur les tests). `engine/aiEngine.js` est vidé de sa boucle `setTimeout`/`mainLoop` mais reste le fichier de bootstrap (`startEngine()` construit le `Worker` + le serveur Express de health). `engine/agents/*.js` (`claude.js`, `hermes.js`, `vibe.js`, `antigravity.js`, `opencode.js`, `config/agents.js`) ne changent **pas** de mécanisme d'invocation (spawn du CLI inchangé), mais doivent désormais **classifier** leurs erreurs (voir "Gestion des rate limits" ci-dessous) au lieu de ne remonter qu'une string libre.

**Dépendances** : retirer `mongoose` de `backend/package.json` et `engine/package.json` ; ajouter `ioredis` + `bullmq` aux deux. Dev-deps : remplacer `mongodb-memory-server` par `ioredis-mock` + `redis-memory-server`.

---

## Migration des routes REST (contrat inchangé pour le frontend)

Le contrat JSON consommé par `frontend/src/api/client.ts` et `frontend/src/types/index.ts` ne change pas.

- **`GET /api/tasks`** : résout `directory` → ids de sessions (`SMEMBERS sessions:by-directory:*`) si fourni ; base l'index sur `tasks:by-status:{status}` si fourni, sinon `tasks:all` ; `ZREVRANGE` + slice par `limit`. Intersection `directory`∩`status` faite en mémoire applicative (volume interne modeste) plutôt que via `ZINTERSTORE`.
- **`GET /api/tasks/:id`** : `HGETALL task:{id}` (404 si vide) ; `LRANGE` + `HGETALL` pipelinés pour les sous-tâches ; ré-imbrique `{_id, directory, titre}` sous `sessionId` pour reproduire la forme actuelle de `.populate()`.
- **`POST /api/tasks`** : valide `sessionId`, génère l'UUID, MULTI-écrit le hash + les 3 index (`all`/`by-status:pending`/`by-session`), puis `queue.add('task', {...}, {jobId: taskId})`. **Edge case documenté, non traité par une transaction distribuée** (hors scope vu l'absence de trafic production) : un crash entre l'écriture Redis et l'enqueue BullMQ peut laisser une tâche `pending` orpheline sans job — mitigation possible plus tard via une passe de réconciliation au démarrage du Worker, non incluse dans ce scope initial.
- **`PUT /api/tasks/:id`** : `HSET` des champs modifiés ; si `status` est présent, passe par le helper de transition atomique (pas un `HSET` brut) pour garder les index cohérents.
- **`DELETE /api/tasks/:id`** : MULTI-supprime le hash task + hashes des sous-tâches + liste d'ordre + entrées dans les 3 index, puis `job.remove()` (tolère "not found").
- **`POST /api/tasks/:id/subtasks`** : écrit le hash + `RPUSH` la liste d'ordre, **et** enqueue explicitement (`queue.add('subtask', ...)`) — contrairement à aujourd'hui où la route se contentait de pousser dans le tableau embarqué en comptant sur le prochain tick de `mainLoop` ; il n'y a plus de scan polling dans le nouveau modèle, donc l'enqueue doit être explicite.
- **`PATCH /api/tasks/:id/skip`** : transition atomique vers `skipped` + `endDate` ; retire/annule le job BullMQ s'il est `waiting`/`delayed`. **Fix inclus** : le processor re-vérifie le statut métier juste avant d'écrire un résultat terminal et ne fait rien si le statut est déjà passé à `skipped` entre-temps (corrige le bug actuel où un résultat tardif écrase silencieusement un skip).
- **`PATCH /api/tasks/:id/resume`** : transition vers `pending`, `endDate` effacé, ré-enqueue (`queue.add` avec le même `jobId`, libre puisque le job précédent a été retiré par le skip).
- **Subtask skip/resume** : même pattern, à l'échelle du hash et du job de la sous-tâche. Modélisées comme des jobs indépendants avec un champ `taskId`/`sessionId`, **pas** comme enfants BullMQ Flow — un resume doit pouvoir fonctionner même longtemps après que le job parent s'est terminé, ce que la sémantique `waiting-children` de BullMQ Flow ne permet pas proprement.
- **Sessions** (`GET/POST/PUT/DELETE /api/sessions`, `GET /:id/tasks`) : mêmes principes ; `PUT` avec changement de `directory` doit explicitement `SREM`/`SADD` l'index `sessions:by-directory:*` (responsabilité nouvelle, absente avec Mongoose qui interrogeait `directory` dynamiquement) ; `DELETE` cascade sur `tasks:by-session:{id}` en réutilisant la suppression de tâche décrite ci-dessus (jobs BullMQ inclus).

---

## Migration du moteur (`engine/aiEngine.js`)

Remplace la boucle `mainLoop`/`setTimeout` par `new Worker('cockpitai:tasks', processor, {connection, concurrency: WORKER_CONCURRENCY})`, où `processor(job, token)` dispatche selon `job.data.type` :

**`processTaskJob`** : acquiert le verrou de session (sinon `moveToDelayed`+`DelayedError`) → re-vérifie que le statut métier est toujours `pending` (no-op sinon, protège contre un skip/delete concurrent) → passe `status:'running'` → `runAgent(agent, prompt, {workingDirectory})` (appel inchangé) → si succès et `detectSubtasks()` détecte des sous-tâches : le statut parent reste `running`, chaque sous-tâche détectée est écrite (`addSubtask`) **et** enqueue son propre job (`queue.add('subtask', ...)`) ; si succès sans sous-tâches : `status:'success'` ; si échec : `status:'failed'`. Le verrou est libéré après chaque appel `runAgent` individuel (pas retenu sur tout le fan-out), pour qu'une sous-tâche nouvellement enqueue puisse immédiatement concourir pour le même verrou de session.

**`processSubtaskJob`** : même cycle verrou/exécution/écriture, puis `maybeFinalizeParent(taskId)` (lit la liste des sous-tâches, si plus aucune `pending`/`running`, calcule `allSuccess` et transitionne la tâche parente). Comme ce check tourne sous le même verrou de session que l'exécution de la sous-tâche, deux complétions ne peuvent pas se concurrencer sur la décision de finalisation.

Arrêt propre (`SIGINT`/`SIGTERM`) : `await worker.close()` puis fermeture de la connexion Redis, remplace `mongoose.disconnect()`.

### Gestion des rate limits des agents CLI (contrainte spécifique sur le nombre de retries)

Constat : quand un agent CLI (claude, hermes, vibe...) échoue sur un rate limit de son fournisseur, le quota ne se réinitialise pas forcément vite — le reset peut n'intervenir que **près d'une semaine plus tard** selon le plan/fournisseur. Un mécanisme de retry classique (`attempts` BullMQ + backoff exponentiel en secondes/minutes) épuiserait ses tentatives bien avant que le rate limit ne se lève, et marquerait la tâche `failed` alors qu'elle est simplement bloquée temporairement — un faux échec.

**Principe retenu : le rate limit ne consomme pas le budget de retry normal.** Il est traité par le même mécanisme que la contention de verrou de session déjà décrit plus haut (`job.moveToDelayed(...)` + `throw new DelayedError()`), qui replanifie le job sans incrémenter `job.attemptsMade` ni déclencher d'événement `failed`. Deux budgets de retry distincts coexistent donc sur un même job :

- **Retry générique** (crash, timeout, erreur réseau transitoire) : `attempts` BullMQ standard, backoff exponentiel court (ex. 3 tentatives, quelques secondes à quelques minutes) — comportement inchangé par cette section.
- **Retry "rate limit"** : hors du compteur `attempts`, avec son propre backoff et son propre plafond, dimensionnés pour couvrir un délai de reset pouvant atteindre ~7 jours.

**Détection.** `runAgent()` (`engine/agents/index.js`) et chaque runner (`engine/agents/{claude,hermes,vibe}.js`) doivent classifier l'erreur au lieu de ne remonter qu'un message libre : `{ success: false, errorType: 'rate_limit' | 'generic', error, retryAfterMs? }`. `retryAfterMs`, quand le CLI le communique explicitement (header/JSON de sortie avec une date de reset), est utilisé tel quel ; sinon on retombe sur le backoff plafonné ci-dessous. La détection se fait sur des motifs connus par agent (codes de sortie, `HTTP 429`, chaînes `rate limit`/`quota` dans stderr/stdout) — à documenter dans `engine/config/agents.js` par agent, car chaque CLI a son propre format d'erreur.

**Backoff et plafond.** Sur `errorType === 'rate_limit'` :
1. Le verrou de session est **libéré avant** la mise en delayed (comme pour tout appel `runAgent` terminé) — une tâche rate-limitée ne doit pas bloquer les autres tâches de la même session pendant des jours.
2. Un compteur dédié `rateLimitRetries` (stocké dans `job.data`, pas dans `job.attemptsMade`) est incrémenté à chaque report.
3. Délai avant la prochaine tentative : `retryAfterMs` du CLI si disponible, sinon backoff exponentiel plafonné — base `RATE_LIMIT_BASE_DELAY_MS` (ex. 5 min), doublé à chaque report, capé à `RATE_LIMIT_MAX_DELAY_MS` (ex. 6h) par report individuel.
4. Le report continue tant que le temps d'attente cumulé reste sous `RATE_LIMIT_MAX_WAIT_MS` (défaut 7 jours, configurable — c'est le plafond qui absorbe explicitement le cas "reset presque une semaine plus tard"). Au-delà, la tâche est marquée `failed` avec un `result` explicite ("rate limit non résolu après {X}j d'attente") distinct d'un échec applicatif classique, pour que l'UI/l'historique ne confondent pas les deux causes.

**Conséquence sur BullMQ/Redis** : un job peut légitimement rester en état `delayed` plusieurs jours — sans coût particulier, un job delayed est juste une entrée dans un ZSET scoré par timestamp cible, il ne mobilise ni timer ni connexion tant qu'il n'est pas dû, et il survit à un redémarrage du Worker grâce à la persistance Redis (AOF) déjà prévue.

**Coordination globale par type d'agent (dans le scope).** Le rate limit est typiquement au niveau du compte/quota du CLI (ex. un seul compte `claude`), donc **partagé entre toutes les sessions** — sans coordination, une tâche d'une autre session retenterait immédiatement et se heurterait au même rate limit, gaspillant des appels CLI et rallongeant inutilement la file. Un état global par type d'agent est donc introduit :

- **Clé Redis** `agent:{agentType}:rate_limited_until` (epoch ms), indépendante de `sessionId`/`taskId` — nouveau module `shared/redis/rateLimitStore.js` exposant `getAgentRateLimitUntil(agentType)`, `reportAgentRateLimit(agentType, untilMs)`, `clearAgentRateLimit(agentType)`.
- **Avant d'appeler `runAgent()`**, `processTaskJob`/`processSubtaskJob` consultent cette clé. Si `now < rate_limited_until`, le job **n'appelle pas le CLI** (évite de consommer un nouvel appel voué à échouer sur un rate limit déjà connu) et se replanifie directement via `moveToDelayed`/`DelayedError` jusqu'à `rate_limited_until` (+ un léger jitter, ex. 0–60s, pour éviter que toutes les tâches en attente ne se réveillent à la même milliseconde et ne "stampede" le CLI au même instant).
- **Quand une erreur `rate_limit` est détectée** (CLI effectivement appelé), le job écrit/actualise la clé globale via `reportAgentRateLimit`, en ne l'écrasant que si la nouvelle estimation (`retryAfterMs` du CLI si disponible, sinon le backoff local calculé §précédente) est **plus tardive** que la valeur existante (`max(existing, new)`, via un script Lua atomique pour éviter qu'une erreur tardive avec une estimation plus courte ne raccourcisse à tort une fenêtre déjà connue plus longue). La clé porte un TTL fixé un peu après `rate_limited_until` (ex. +1h de marge) pour s'auto-nettoyer même en cas de bug applicatif.
- **Récupération** : dès qu'une tâche utilisant cet agent réussit à nouveau (`runAgent` renvoie un succès), `clearAgentRateLimit(agentType)` est appelée — la reprise n'attend donc pas nécessairement l'expiration du TTL si le quota est revenu plus tôt que prévu.
- **Le plafond individuel `RATE_LIMIT_MAX_WAIT_MS`/`rateLimitRetries` de chaque job reste inchangé** et continue de s'appliquer par-dessus cette coordination : un job qui se recale sur la fenêtre globale voit quand même son temps d'attente cumulé décompté de son propre plafond de 7 jours, et finit par échouer explicitement si le rate limit global ne se lève jamais.
- **Observabilité** : l'endpoint `/health` (voir section suivante) expose additivement un objet `rateLimits` (`{claude: null|epochMs, hermes: ..., vibe: ...}`) pour que l'état de rate limit de chaque agent soit visible sans creuser les logs — utile vu la fenêtre pouvant atteindre ~7 jours.

---

## Endpoint santé/métriques

Conserve la forme de réponse actuelle (`{status, timestamp, engine, tasks:{pending,running,total}}`) via `ZCARD` sur `tasks:by-status:pending/running` et `tasks:all`. Ajoute, de façon additive :
- un objet `queue` issu de `taskQueue.getJobCounts('waiting','active','completed','failed','delayed')` pour distinguer un `pending` métier d'un job `delayed` en attente de verrou de session ;
- un objet `rateLimits` (`{ [agentType]: null | epochMs }`) lu depuis `shared/redis/rateLimitStore.js` pour chaque agent configuré (`claude`, `hermes`, `vibe`, `antigravity`, `opencode`), pour rendre visible en un coup d'œil quel(s) agent(s) sont actuellement sous rate limit et jusqu'à quand.

---

## Stratégie de tests

14 fichiers concernés (7 dans `backend/tests/`, 7 dans `engine/tests/`). Stratégie à deux niveaux :
- **`ioredis-mock`** pour les tests qui n'instancient pas de vraie `Queue`/`Worker` BullMQ (tests de la couche store pure) — rapide, pas de process externe.
- **`redis-memory-server`** (équivalent Redis de `mongodb-memory-server` : télécharge/gère un vrai binaire `redis-server` éphémère par run de test) pour tout ce qui instancie un vrai `Queue`/`Worker` BullMQ — nécessaire car BullMQ s'appuie fortement sur des scripts Lua (`EVALSHA`) et des connexions bloquantes, mal couverts par `ioredis-mock`.

Fichiers concernés côté `redis-memory-server` : `backend/tests/{integration,server,sessions.routes,tasks.routes,tasks.skip-resume}.test.js`, `engine/tests/{integration,processSubtasks,processTask,sequential}.test.js` + le successeur de `mainLoop.test.js` (devient un test du Worker). `engine/tests/{agents,config}.test.js` ne sont pas affectés (ils mockent `runAgent`/le spawn, sans toucher à la persistance).

---

## Ops / déploiement

- **`restart.sh`** : remplace le bloc de vérification/démarrage `mongod` (host `100.71.107.100`, `--fork`) par un bloc équivalent pour `redis-server` (probe `redis-cli ping`, démarrage `redis-server --appendonly yes --dir /var/lib/redis --daemonize yes` si absent) — même style ops que l'existant, pas de Docker introduit.
- **`.env.example`** : `backend/.env.example` et `engine/.env.example` — `MONGODB_URI` remplacé par `REDIS_URL`. Côté engine, ajout de `WORKER_CONCURRENCY`, `SESSION_LOCK_TTL_MS`, `SESSION_LOCK_RENEW_MS`, `RATE_LIMIT_BASE_DELAY_MS`, `RATE_LIMIT_MAX_DELAY_MS`, `RATE_LIMIT_MAX_WAIT_MS` (défaut 7 jours) ; `POLL_INTERVAL` réinterprété comme délai de retry sur verrou plutôt que période de polling dur.
- **README.md** : met à jour le diagramme d'architecture et la description du moteur (polling → événementiel BullMQ), remplace le prérequis MongoDB par Redis.
- **docs/** : nouveau `docs/redis_migration.md` comme référence de la couche de persistance ; pointeur de dépréciation en tête de la section modèle de données de `docs/specification.md` (les docs historiques ne sont pas réécrites en place).

---

## Phasage (nouveau Sprint 7, cohérent avec la convention de `docs/dev_plan.md`)

1. **Socle infra & store partagé** (~1j) — `shared/redis/*`, script de démarrage Redis dans `restart.sh`, tests unitaires `ioredis-mock`.
2. **Queue & worker core** (~1–1.5j) — `shared/queue/*`, `processTaskJob`, verrou de session, endpoint santé ; port de `processTask.test.js`.
3. **Sous-tâches & décomposition dynamique** (~1j) — `processSubtaskJob`, `maybeFinalizeParent`, enqueue dynamique sur `[DECOMPOSITION_DETECTEE]` ; port de `processSubtasks.test.js`, `sequential.test.js`, successeur de `mainLoop.test.js`, `integration.test.js`.
3bis. **Gestion des rate limits** (~1j) — classification d'erreurs dans `engine/agents/*.js`, double budget de retry (générique vs rate limit) dans `processor.js`, `shared/redis/rateLimitStore.js` et coordination globale par agent, extension de `/health` (`rateLimits`), tests dédiés (job seul et coordination cross-session).
4. **Migration API REST** (~1–1.5j) — réécriture de `tasks.js`/`sessions.js`, suppression des fichiers Mongoose ; port des 5 fichiers de tests backend ; vérification manuelle du contrat avec le frontend (démarrage réel, smoke test via le skill `run`).
5. **Nettoyage & ops** (~0.5j) — suppression de `backend/middlewares/errorHandler.js`, mise à jour `restart.sh`/`.env.example`/README, retrait de `mongoose`/`mongodb-memory-server` des `package.json`.
6. **Vérification & durcissement** (~0.5j) — suites de tests vertes, run end-to-end manuel (création session → tâche → décomposition → skip/resume), test explicite du cas verrou expiré/worker crashé.

Total estimé : ~6-7 jours-personne.

**Cutover** : atomique, à froid. Arrêt des trois process → démarrage de Redis (AOF actif dès le premier boot) → démarrage du backend/engine migrés → un seul appel à `restart.sh`. Pas de période de double-écriture, pas de script de reprise de données MongoDB (décision actée).

---

## Vérification

- Suites de tests `backend/` et `engine/` vertes après migration (14 fichiers, stratégie `ioredis-mock` + `redis-memory-server` ci-dessus).
- Test end-to-end manuel via le skill `run` : créer une session, créer une tâche, observer sa prise en charge par le Worker, vérifier la décomposition en sous-tâches (marqueur `[DECOMPOSITION_DETECTEE]`), tester skip/resume sur tâche et sous-tâche, vérifier que deux tâches de la même session ne s'exécutent jamais en parallèle (contrainte du verrou).
- Test dédié rate limit : simuler un agent renvoyant `errorType:'rate_limit'` (mock), vérifier que le job passe en `delayed` sans incrémenter `attemptsMade`, que le verrou de session est bien libéré entre-temps (une autre tâche de la même session peut s'exécuter), et que le plafond `RATE_LIMIT_MAX_WAIT_MS` finit par marquer la tâche `failed` avec le message distinct attendu.
- Test dédié coordination globale : deux tâches de **sessions différentes** utilisant le même `agent`, la première déclenche un rate limit (écrit `agent:{agent}:rate_limited_until`) ; vérifier que la seconde, arrivée après, se replanifie directement sans appeler `runAgent()` ; vérifier qu'un succès ultérieur d'une tâche quelconque sur cet agent appelle bien `clearAgentRateLimit` et débloque les autres tâches en attente sur ce même agent.
- Vérifier `GET /health` sur l'engine (nouvel objet `queue` en plus des compteurs existants).
- Vérifier que le frontend (inchangé) continue de fonctionner sans modification contre la nouvelle API — le contrat JSON ne change pas.
