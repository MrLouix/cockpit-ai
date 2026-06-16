# CockpitAI

**Full-stack dashboard for orchestrating AI coding agents** — manage sessions, create tasks, dispatch them to CLI agents (Hermes, Claude, Vibe, etc.), track progress, and inspect results in real time.

![Node.js](https://img.shields.io/badge/Node.js-22.22.2-green)
![MongoDB](https://img.shields.io/badge/MongoDB-v7-green)
![React](https://img.shields.io/badge/React-19+-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8+-blue)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8)
![License](https://img.shields.io/badge/license-MIT-yellow)

---

## Architecture

```
┌──────────────────────┐     REST / TanStack Query      ┌──────────────────────┐
│  Frontend (:5173)    │ ◄────────────────────────────►  │  Backend (:3001)    │
│  React 19 + Vite     │                                 │  Express + Mongoose  │
│  TypeScript + Tailwind│                                └──────────┬───────────┘
└──────────────────────┘                                           │
                                                                   ▼
                                                     ┌──────────────────────┐
                                                     │  MongoDB (:27017)    │
                                                     │  Docker container    │
                                                     └──────────┬───────────┘
                                                                │
                                                                │ polling 5s
                                                  ┌─────────────┴──────────┐
                                                  │  Engine (runEngine.js)  │
                                                  │  AI Agent dispatcher    │
                                                  └────┬──┬──┬──┬──┬───────┘
                                                       │  │  │  │  │
                                          ┌────────────┤  │  │  │  └── opencode (stub)
                                          │      ┌─────┘  │  │  └── antigravity (stub)
                                          │      │  ┌─────┘  └── claude CLI
                                          │      │  │
                                     hermes CLI  vibe CLI
```

## Sprint Progress

| Sprint | Phase | Status |
|--------|-------|--------|
| Sprint 0 | Préparation & Architecture | ✅ **Done** |
| Sprint 1 | Backend Core (Express + MongoDB) | ✅ **Done** |
| Sprint 2 | Moteur IA (Agent CLI dispatch) | ✅ **Done** |
| Sprint 3 | Frontend Core (React + Tailwind) | ✅ **Done** |
| Sprint 4 | Fonctionnalités Avancées (Skip/Resume, sous-tâches) | ✅ **Done** |
| Sprint 5 | Skill Interne (auto-decomposition) | 🚧 In progress |
| Sprint 6 | Finalisation (tests, optimisation) | ⏳ Pending |

---

## Features

### Backend (Sprint 1)

- **Sessions (projects)** — CRUD with directory path + title
- **Tasks** — full CRUD, status lifecycle, subtask management
- **Filtering** — by directory, status, limit
- **Cascade delete** — deleting a session removes all its tasks
- **Error handling middleware** — consistent JSON error responses

### Engine (Sprint 2)

- **Polling loop** — checks MongoDB every 5s for pending tasks
- **Agent dispatch** — spawns CLI agents (hermes, vibe, claude) with sub-process
- **JSON output parsing** — extracts structured results from agent output
- **Subtask detection** — parses `{{SUBTASK: ...}}` markers to create child tasks
- **Status transitions** — pending → running → success/failed/pause/skipped
- **Isolated Task model** — avoids mongoose connection conflicts with backend

### Frontend (Sprint 3–4)

- **Dashboard** — table AND card views with toggle switch
- **Filter bar** — pills for status (with live counts) + directory dropdown
- **Status pills** — `all`, `pending`, `running`, `success`, `pause`, `failed`, `skipped`
- **Task cards** — color-coded per agent (hermes=indigo, claude=violet, vibe=emerald), hover actions (skip/resume/delete), error previews, success indicators
- **Task table** — zebra-striped, responsive, sortable columns
- **Directory picker** — server-side folder navigation when creating sessions
- **Modals** — NewSession, NewTask, TaskDetail with subtask display
- **Empty state** — illustrated placeholder with CTA buttons
- **Responsive design** — mobile-first layout, gradient header, backdrop blur
- **Live polling** — React Query auto-refetch every 5s

---

## Project Structure

```
cockpitAI/
├── backend/                    # Express API server
│   ├── config/db.js            # MongoDB connection
│   ├── models/
│   │   ├── Session.js          # Session schema
│   │   └── Task.js             # Task schema + subtasks
│   ├── routes/
│   │   ├── sessions.js         # CRUD + tasks by session
│   │   ├── tasks.js            # CRUD + skip/resume/subtasks
│   │   └── files.js            # Server-side file listing
│   ├── middlewares/
│   │   └── errorHandler.js     # Global error handler
│   ├── server.js               # Express entry point
│   ├── .env                    # MONGODB_URI, PORT
│   └── package.json
├── engine/                     # AI agent dispatcher
│   ├── agents/
│   │   ├── index.js            # runAgent() + detectSubtasks()
│   │   ├── hermes.js           # hermes -z "prompt"
│   │   ├── vibe.js             # vibe -p "prompt" --output json
│   │   ├── claude.js           # claude -p --output-format json
│   │   ├── antigravity.js      # stub
│   │   └── opencode.js         # stub
│   ├── config/
│   │   └── agents.js           # Agent CLI configurations
│   ├── models/
│   │   └── Task.js             # Own Task model (mongoose isolation)
│   ├── aiEngine.js             # Polling engine logic
│   ├── runEngine.js            # Entry point
│   ├── .env                    # MONGODB_URI
│   └── package.json
├── frontend/                   # React + TypeScript dashboard
│   ├── src/
│   │   ├── api/
│   │   │   └── client.ts       # API client + React Query hooks
│   │   ├── components/
│   │   │   ├── DirectoryPicker.tsx  # Server-side folder navigation
│   │   │   ├── FilterBar.tsx        # Status pills + directory filter
│   │   │   ├── NewSessionModal.tsx  # Create project modal
│   │   │   ├── NewTaskModal.tsx     # Create task modal
│   │   │   ├── StatusBadge.tsx      # Colored status badge
│   │   │   ├── TaskCard.tsx         # Task card (desktop view)
│   │   │   ├── TaskDetailModal.tsx  # Task detail + subtasks
│   │   │   └── TaskTable.tsx        # Task table (alternative view)
│   │   ├── hooks/
│   │   │   └── useTasks.ts     # TanStack Query hooks
│   │   ├── types/
│   │   │   └── index.ts        # TypeScript interfaces
│   │   ├── App.tsx             # Main app component
│   │   ├── App.css
│   │   ├── index.css           # Tailwind imports
│   │   └── main.tsx            # React 19 entry point
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── eslint.config.js
│   └── package.json
└── docs/
    ├── dev_plan.md             # 7-sprint development plan
    └── specification.md        # Architecture + code specs
```

---

## Quick Start

### Prerequisites

| Requirement | Version | How |
|-------------|---------|-----|
| Node.js | ≥ 22 | `node --version` |
| MongoDB | 7 (Docker) | `docker run -d --name cockpit_mongo -p 27017:27017 -e MONGO_INITDB_DATABASE=aiquerymanager mongo:7` |

At least one agent CLI must be installed: `hermes`, `vibe`, or `claude`.

### Start All Services

```bash
# 1. Backend (port 3001)
cd backend && npm install && node server.js

# 2. Engine (polling every 5s)
cd engine && npm install && node runEngine.js

# 3. Frontend (port 5173)
cd frontend && npm install && npm run dev
```

Open **http://localhost:5173** in your browser.

---

## API Reference

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check with session/task counts |

### Sessions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sessions` | List all sessions |
| GET | `/api/sessions/:id` | Get session by ID |
| POST | `/api/sessions` | Create session `{directory, titre}` |
| DELETE | `/api/sessions/:id` | Delete session + cascade tasks |
| GET | `/api/sessions/:id/tasks` | List tasks for a session |

### Tasks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks?directory=&status=&limit=` | Filter tasks |
| GET | `/api/tasks/:id` | Task detail (populates session) |
| POST | `/api/tasks` | Create task `{sessionId, prompt, agent}` |
| PUT | `/api/tasks/:id` | Update task |
| DELETE | `/api/tasks/:id` | Delete task |
| PATCH | `/api/tasks/:id/skip` | Skip pending/running task |
| PATCH | `/api/tasks/:id/resume` | Resume skipped/failed task |
| POST | `/api/tasks/:id/subtasks` | Add subtask |
| PATCH | `/api/tasks/:id/subtasks/:sid/skip` | Skip subtask |
| PATCH | `/api/tasks/:id/subtasks/:sid/resume` | Resume subtask |

### Files
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/files/ls?path=/home/ai_agent/projects` | Server-side directory listing |

### Task Statuses

`pending` → `running` → `success` / `failed` / `pause` / `skipped`

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript 5.8, Vite 7, TailwindCSS 4, TanStack Query 5 |
| Backend | Express 4, Mongoose 8, ES modules |
| Database | MongoDB 7 (Docker) |
| Engine | Node.js child_process, polling |
| Monitoring | `systeminformation` (CPU/RAM), p-limit (concurrency) |

---

## Development

```bash
# Backend dev
cd backend && node server.js

# Engine dev
cd engine && node runEngine.js

# Frontend dev (with HMR)
cd frontend && npm run dev

# Linting
cd frontend && npm run lint
```

---

## License

MIT
