# AI Query Manager - Architecture & Code

## 📋 Overview

Application full-stack pour gérer des requêtes IA avec :
- **Backend** : Node.js + Express + MongoDB
- **Moteur IA** : Service Node.js qui exécute les agents CLI (Claude, Vibe, Antigravity, Hermès, OpenCode)
- **Frontend** : React + TypeScript + Vite + Tailwind CSS (responsive smartphone/PC)
- **Fonctionnalités** : Filtre par projet (directory), affichage tableau/cartes, détails des tâches et sous-tâches

---

## 🗃️ MongoDB Schema

### Collections

#### 1. `sessions`
```javascript
{
  _id: ObjectId,
  directory: String,        // Projet (utilisé pour le filtre)
  titre: String,           // Titre de la session
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}
```

#### 2. `tasks`
```javascript
{
  _id: ObjectId,
  sessionId: { type: ObjectId, ref: 'sessions', required: true },
  prompt: { type: String, required: true },
  agent: { 
    type: String, 
    enum: ['claude', 'vibe', 'antigravity', 'hermes', 'opencode'],
    default: 'vibe'
  },
  status: { 
    type: String, 
    enum: ['pending', 'running', 'success', 'pause', 'failed', 'skipped'],
    default: 'pending'
  },
  result: String,
  executedByAgent: String,  // Agent CLI qui a exécuté la tâche
  createdAt: { type: Date, default: Date.now },
  endDate: Date,
  subtasks: [{
    _id: ObjectId,
    prompt: String,
    agent: String,
    executedByAgent: String,  // Agent CLI qui a exécuté la sous-tâche
    status: { 
      type: String, 
      enum: ['pending', 'running', 'success', 'pause', 'failed', 'skipped'],
      default: 'pending'
    },
    result: String,
    createdAt: { type: Date, default: Date.now },
    endDate: Date
  }],
  // Index recommandés
  indexes: [
    { sessionId: 1 },
    { status: 1 },
    { 'sessionId.directory': 1 },
    { executedByAgent: 1 }
  ]
}
```

---

## 🏗️ Backend (Node.js + Express + MongoDB)

### Structure du projet
```
backend/
├── package.json
├── server.js          # Point d'entrée
├── config/
│   └── db.js          # Configuration MongoDB
├── models/
│   ├── Session.js     # Modèle Session
│   └── Task.js        # Modèle Task
├── routes/
│   ├── sessions.js    # Routes Sessions
│   └── tasks.js       # Routes Tasks
├── controllers/
│   ├── sessionController.js
│   └── taskController.js
└── middlewares/
    └── errorHandler.js
```

### 1. `package.json`
```json
{
  "name": "ai-query-backend",
  "version": "1.0.0",
  "type": "module",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "mongoose": "^8.0.3"
  }
}
```

### 2. `config/db.js`
```javascript
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ai_query_manager');
    console.log('✅ MongoDB connected');
    
    // Indexes
    await mongoose.connection.db.collection('tasks').createIndexes([
      { key: { sessionId: 1 } },
      { key: { status: 1 } },
      { key: { 'sessionId': 1 } }
    ]);
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  }
};

export default connectDB;
```

### 3. `models/Session.js`
```javascript
import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  directory: { type: String, required: true },
  titre: { type: String, required: true },
}, { timestamps: true });

sessionSchema.index({ directory: 1 });

export default mongoose.model('Session', sessionSchema);
```

### 4. `models/Task.js`
```javascript
import mongoose from 'mongoose';

const subtaskSchema = new mongoose.Schema({
  prompt: { type: String, required: true },
  agent: { 
    type: String, 
    enum: ['claude', 'vibe', 'antigravity', 'hermes', 'opencode'],
    default: 'vibe'
  },
  executedByAgent: String,  // Agent CLI qui a exécuté la sous-tâche
  status: { 
    type: String, 
    enum: ['pending', 'running', 'success', 'pause', 'failed', 'skipped'],
    default: 'pending'
  },
  result: String,
  createdAt: { type: Date, default: Date.now },
  endDate: Date
});

const taskSchema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
  prompt: { type: String, required: true },
  agent: { 
    type: String, 
    enum: ['claude', 'vibe', 'antigravity', 'hermes', 'opencode'],
    default: 'vibe'
  },
  executedByAgent: String,  // Agent CLI qui a exécuté la tâche
  status: { 
    type: String, 
    enum: ['pending', 'running', 'success', 'pause', 'failed', 'skipped'],
    default: 'pending'
  },
  result: String,
  createdAt: { type: Date, default: Date.now },
  endDate: Date,
  subtasks: [subtaskSchema]
}, { timestamps: true });

taskSchema.index({ sessionId: 1 });
taskSchema.index({ status: 1 });
taskSchema.index({ executedByAgent: 1 });

export default mongoose.model('Task', taskSchema);
```

### 5. `routes/tasks.js`
```javascript
import express from 'express';
import Task from '../models/Task.js';
import Session from '../models/Session.js';

const router = express.Router();

// GET /api/tasks?directory=...&status=...&limit=...
router.get('/', async (req, res) => {
  try {
    const { directory, status, limit = 50 } = req.query;
    
    let query = {};
    
    // Filtre par projet (directory)
    if (directory) {
      const sessions = await Session.find({ directory });
      const sessionIds = sessions.map(s => s._id);
      query.sessionId = { $in: sessionIds };
    }
    
    // Filtre par statut
    if (status && ['pending', 'running', 'success', 'pause', 'failed', 'skipped'].includes(status)) {
      query.status = status;
    }
    
    const tasks = await Task.find(query)
      .populate('sessionId', 'directory titre')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
    
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tasks/:id
router.get('/:id', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).populate('sessionId', 'directory titre');
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks
router.post('/', async (req, res) => {
  try {
    const { sessionId, prompt, agent = 'vibe' } = req.body;
    
    // Vérifier que la session existe
    const session = await Session.findById(sessionId);
    if (!session) return res.status(400).json({ error: 'Invalid sessionId' });
    
    const task = new Task({
      sessionId,
      prompt,
      agent,
      status: 'pending'
    });
    
    await task.save();
    res.status(201).json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/tasks/:id (update status, result, etc.)
router.put('/:id', async (req, res) => {
  try {
    const { status, result, executedByAgent } = req.body;
    const task = await Task.findById(req.params.id);
    
    if (!task) return res.status(404).json({ error: 'Task not found' });
    
    if (status) task.status = status;
    if (result) task.result = result;
    if (executedByAgent) task.executedByAgent = executedByAgent;
    if (status === 'success' || status === 'failed' || status === 'skipped') {
      task.endDate = new Date();
    }
    
    await task.save();
    res.json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/tasks/:id/skip - Skip une tâche
router.patch('/:id/skip', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    
    // Ne peut skip que les tâches pending ou running
    if (!['pending', 'running'].includes(task.status)) {
      return res.status(400).json({ error: 'Cannot skip a task that is not pending or running' });
    }
    
    task.status = 'skipped';
    task.endDate = new Date();
    task.result = 'Task skipped by user';
    await task.save();
    
    res.json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/tasks/:id/resume - Resume une tâche paused
router.patch('/:id/resume', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    
    // Ne peut resume que les tâches paused
    if (task.status !== 'pause') {
      return res.status(400).json({ error: 'Cannot resume a task that is not paused' });
    }
    
    task.status = 'pending';
    task.endDate = undefined;
    await task.save();
    
    res.json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks/:id/subtasks
router.post('/:id/subtasks', async (req, res) => {
  try {
    const { prompt, agent } = req.body;
    const task = await Task.findById(req.params.id);
    
    if (!task) return res.status(404).json({ error: 'Task not found' });
    
    const subtask = {
      prompt,
      agent: agent || task.agent,
      status: 'pending',
      createdAt: new Date()
    };
    
    task.subtasks.push(subtask);
    await task.save();
    
    res.status(201).json(subtask);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/tasks/:id/subtasks/:subtaskId/skip - Skip une sous-tâche
router.patch('/:id/subtasks/:subtaskId/skip', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    
    const subtask = task.subtasks.id(req.params.subtaskId);
    if (!subtask) return res.status(404).json({ error: 'Subtask not found' });
    
    if (!['pending', 'running'].includes(subtask.status)) {
      return res.status(400).json({ error: 'Cannot skip a subtask that is not pending or running' });
    }
    
    subtask.status = 'skipped';
    subtask.endDate = new Date();
    subtask.result = 'Subtask skipped by user';
    await task.save();
    
    res.json(subtask);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/tasks/:id/subtasks/:subtaskId/resume - Resume une sous-tâche paused
router.patch('/:id/subtasks/:subtaskId/resume', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    
    const subtask = task.subtasks.id(req.params.subtaskId);
    if (!subtask) return res.status(404).json({ error: 'Subtask not found' });
    
    if (subtask.status !== 'pause') {
      return res.status(400).json({ error: 'Cannot resume a subtask that is not paused' });
    }
    
    subtask.status = 'pending';
    subtask.endDate = undefined;
    await task.save();
    
    res.json(subtask);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
```

### 6. `routes/sessions.js`
```javascript
import express from 'express';
import Session from '../models/Session.js';
import Task from '../models/Task.js';

const router = express.Router();

// GET /api/sessions
router.get('/', async (req, res) => {
  try {
    const sessions = await Session.find().sort({ createdAt: -1 });
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sessions/:id
router.get('/:id', async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sessions
router.post('/', async (req, res) => {
  try {
    const { directory, titre } = req.body;
    const session = new Session({ directory, titre });
    await session.save();
    res.status(201).json(session);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/sessions/:id (supprime aussi les tâches associées)
router.delete('/:id', async (req, res) => {
  try {
    const session = await Session.findByIdAndDelete(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    
    // Supprimer les tâches associées
    await Task.deleteMany({ sessionId: req.params.id });
    
    res.json({ message: 'Session and associated tasks deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sessions/:id/tasks
router.get('/:id/tasks', async (req, res) => {
  try {
    const tasks = await Task.find({ sessionId: req.params.id })
      .sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
```

### 7. `server.js`
```javascript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import sessionRoutes from './routes/sessions.js';
import taskRoutes from './routes/tasks.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/sessions', sessionRoutes);
app.use('/api/tasks', taskRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
const startServer = async () => {
  await connectDB();
  
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
};

startServer().catch(err => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});
```

### 8. `.env` (à créer)
```
MONGODB_URI=mongodb://localhost:27017/ai_query_manager
PORT=3001
```

---

## ⚙️ Moteur IA (Service Node.js)

### Structure
```
engine/
├── package.json
├── aiEngine.js      # Point d'entrée
├── agents/
│   ├── claude.js     # Wrapper Claude CLI
│   ├── vibe.js       # Wrapper Vibe CLI
│   ├── antigravity.js
│   ├── hermes.js
│   └── opencode.js
└── config/
    └── agents.js     # Configuration des agents
```

### 1. `package.json`
```json
{
  "name": "ai-engine",
  "version": "1.0.0",
  "type": "module",
  "main": "aiEngine.js",
  "scripts": {
    "start": "node aiEngine.js",
    "dev": "node --watch aiEngine.js"
  },
  "dependencies": {
    "dotenv": "^16.3.1",
    "mongoose": "^8.0.3"
  }
}
```

### 2. `config/agents.js`
```javascript
// Commandes CLI pour chaque agent
const AGENT_COMMANDS = {
  claude: 'claude',
  vibe: 'vibe',
  antigravity: 'ag',
  hermes: 'hermes',
  opencode: 'opencode'
};

// Timeout par défaut (en ms)
const DEFAULT_TIMEOUT = 300000; // 5 minutes

// Options par agent
const AGENT_OPTIONS = {
  claude: { timeout: DEFAULT_TIMEOUT },
  vibe: { timeout: DEFAULT_TIMEOUT },
  antigravity: { timeout: DEFAULT_TIMEOUT },
  hermes: { timeout: DEFAULT_TIMEOUT },
  opencode: { timeout: DEFAULT_TIMEOUT }
};

export { AGENT_COMMANDS, AGENT_OPTIONS };
```

### 3. `agents/vibe.js` (exemple)
```javascript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Exécute une requête avec Vibe CLI
 * @param {string} prompt - Le prompt à exécuter
 * @param {object} options - Options supplémentaires
 * @returns {Promise<{success: boolean, result: string, error?: string}>}
 */
export const runVibe = async (prompt, options = {}) => {
  try {
    const { timeout = 300000 } = options;
    
    // Commande Vibe CLI (à adapter selon ton installation)
    const command = `vibe --prompt "${prompt.replace(/"/g, '\\"')}"`;
    
    const { stdout, stderr } = await execAsync(command, { 
      timeout,
      maxBuffer: 1024 * 1024 * 10 // 10MB
    });
    
    if (stderr && !stdout) {
      return { success: false, result: '', error: stderr };
    }
    
    return { success: true, result: stdout };
  } catch (err) {
    return { 
      success: false, 
      result: '', 
      error: err.message || err.stdout || err.stderr || 'Unknown error'
    };
  }
};
```

### 4. `agents/index.js`
```javascript
import { runVibe } from './vibe.js';
import { runClaude } from './claude.js';
import { runAntigravity } from './antigravity.js';
import { runHermes } from './hermes.js';
import { runOpencode } from './opencode.js';

const agentRunners = {
  vibe: runVibe,
  claude: runClaude,
  antigravity: runAntigravity,
  hermes: runHermes,
  opencode: runOpencode
};

/**
 * Exécute un agent CLI
 * @param {string} agent - Nom de l'agent
 * @param {string} prompt - Le prompt
 * @returns {Promise<{success: boolean, result: string, error?: string}>}
 */
export const runAgent = async (agent, prompt) => {
  const runner = agentRunners[agent];
  if (!runner) {
    throw new Error(`Agent '${agent}' not supported`);
  }
  return runner(prompt);
};
```

### 5. `aiEngine.js` (Cœur du moteur)
```javascript
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { runAgent } from './agents/index.js';
import Task from './models/Task.js';

dotenv.config();

// Configuration MongoDB (même base que le backend)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai_query_manager';

// Intervalle de polling (en ms)
const POLL_INTERVAL = 5000; // 5 secondes

// Connexion à MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ AI Engine: MongoDB connected');
    return mongoose.connection;
  } catch (err) {
    console.error('❌ AI Engine: MongoDB connection error:', err);
    process.exit(1);
  }
};

// Traitement d'une tâche
const processTask = async (task) => {
  try {
    console.log(`🔄 Processing task ${task._id} (status: ${task.status})`);
    
    // Ignorer si déjà terminé, skipped ou en pause
    if (task.status !== 'pending' && task.status !== 'running') {
      return;
    }
    
    // Mettre à jour le statut
    await Task.findByIdAndUpdate(task._id, { 
      status: 'running',
      updatedAt: new Date()
    });
    
    // Exécuter l'agent
    console.log(`🤖 Running agent '${task.agent}' for task ${task._id}`);
    const result = await runAgent(task.agent, task.prompt);
    
    // Mettre à jour la tâche
    const updateData = {
      status: result.success ? 'success' : 'failed',
      result: result.success ? result.result : result.error,
      executedByAgent: task.agent,  // Stocker l'agent qui a exécuté la tâche
      endDate: new Date(),
      updatedAt: new Date()
    };
    
    await Task.findByIdAndUpdate(task._id, updateData);
    console.log(`✅ Task ${task._id} completed with status: ${updateData.status}`);
    
  } catch (err) {
    console.error(`❌ Error processing task ${task._id}:`, err);
    await Task.findByIdAndUpdate(task._id, {
      status: 'failed',
      result: err.message,
      executedByAgent: task.agent,
      endDate: new Date(),
      updatedAt: new Date()
    });
  }
};

// Traitement des sous-tâches
const processSubtasks = async (task) => {
  if (!task.subtasks || task.subtasks.length === 0) return;
  
  for (const subtask of task.subtasks) {
    // Ignorer si déjà terminé, skipped ou en pause
    if (subtask.status !== 'pending' && subtask.status !== 'running') {
      continue;
    }
    
    try {
      console.log(`🔄 Processing subtask ${subtask._id}`);
      
      // Mettre à jour le statut
      const taskDoc = await Task.findById(task._id);
      const subtaskIndex = taskDoc.subtasks.findIndex(st => st._id.equals(subtask._id));
      taskDoc.subtasks[subtaskIndex].status = 'running';
      await taskDoc.save();
      
      // Exécuter l'agent
      const agentToUse = subtask.agent || task.agent;
      console.log(`🤖 Running agent '${agentToUse}' for subtask ${subtask._id}`);
      const result = await runAgent(agentToUse, subtask.prompt);
      
      // Mettre à jour la sous-tâche
      taskDoc.subtasks[subtaskIndex] = {
        ...taskDoc.subtasks[subtaskIndex].toObject(),
        status: result.success ? 'success' : 'failed',
        result: result.success ? result.result : result.error,
        executedByAgent: agentToUse,  // Stocker l'agent qui a exécuté la sous-tâche
        endDate: new Date()
      };
      await taskDoc.save();
      
      console.log(`✅ Subtask ${subtask._id} completed`);
    } catch (err) {
      console.error(`❌ Error processing subtask ${subtask._id}:`, err);
      const taskDoc = await Task.findById(task._id);
      const subtaskIndex = taskDoc.subtasks.findIndex(st => st._id.equals(subtask._id));
      taskDoc.subtasks[subtaskIndex].status = 'failed';
      taskDoc.subtasks[subtaskIndex].result = err.message;
      taskDoc.subtasks[subtaskIndex].executedByAgent = subtask.agent || task.agent;
      taskDoc.subtasks[subtaskIndex].endDate = new Date();
      await taskDoc.save();
    }
  }
};

// Boucle principale
const mainLoop = async () => {
  try {
    // Récupérer les tâches en attente (pending) ou en cours (running)
    const tasks = await Task.find({
      status: { $in: ['pending', 'running'] }
    }).populate('sessionId');
    
    console.log(`📊 Found ${tasks.length} tasks to process`);
    
    for (const task of tasks) {
      // Traiter la tâche principale
      if (task.status === 'pending') {
        await processTask(task);
      }
      
      // Traiter les sous-tâches
      await processSubtasks(task);
    }
    
  } catch (err) {
    console.error('❌ Error in main loop:', err);
  }
};

// Démarrage
const startEngine = async () => {
  await connectDB();
  
  console.log('🚀 AI Engine started');
  console.log(`🔄 Polling interval: ${POLL_INTERVAL / 1000}s`);
  
  // Boucle infinie
  setInterval(mainLoop, POLL_INTERVAL);
  
  // Premier traitement immédiat
  mainLoop();
};

startEngine().catch(err => {
  console.error('❌ Failed to start AI Engine:', err);
  process.exit(1);
});

// Gestion des signaux pour arrêt propre
process.on('SIGINT', async () => {
  console.log('\n🛑 AI Engine: Shutting down...');
  await mongoose.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 AI Engine: Shutting down...');
  await mongoose.disconnect();
  process.exit(0);
});
```

---

## 🎨 Frontend (React + TypeScript + Vite + Tailwind)

### Structure du projet
```
frontend/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── public/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── types/
│   │   └── index.ts
│   ├── api/
│   │   └── client.ts
│   ├── components/
│   │   ├── TaskCard.tsx
│   │   ├── TaskTable.tsx
│   │   ├── TaskDetailModal.tsx
│   │   ├── SubtaskCard.tsx
│   │   ├── FilterBar.tsx
│   │   ├── StatusBadge.tsx
│   │   └── ...
│   ├── hooks/
│   │   └── useTasks.ts
│   └── styles/
│       └── globals.css
```

### 1. `package.json`
```json
{
  "name": "ai-query-frontend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.17.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.21.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.3.3",
    "vite": "^5.0.8"
  }
}
```

### 2. `tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### 3. `vite.config.ts`
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3333,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
```

### 4. `src/types/index.ts`
```typescript
export type TaskStatus = 'pending' | 'running' | 'success' | 'pause' | 'failed' | 'skipped';
export type AgentType = 'claude' | 'vibe' | 'antigravity' | 'hermes' | 'opencode';

export interface Subtask {
  _id: string;
  prompt: string;
  agent: AgentType;
  executedByAgent?: string;  // Agent CLI qui a exécuté la sous-tâche
  status: TaskStatus;
  result?: string;
  createdAt: string;
  endDate?: string;
}

export interface Task {
  _id: string;
  sessionId: {
    _id: string;
    directory: string;
    titre: string;
  };
  prompt: string;
  agent: AgentType;
  executedByAgent?: string;  // Agent CLI qui a exécuté la tâche
  status: TaskStatus;
  result?: string;
  createdAt: string;
  endDate?: string;
  subtasks: Subtask[];
  updatedAt: string;
}

export interface Session {
  _id: string;
  directory: string;
  titre: string;
  createdAt: string;
  updatedAt: string;
}

export interface FilterParams {
  directory?: string;
  status?: TaskStatus;
  limit?: number;
}
```

### 5. `src/api/client.ts`
```typescript
import { Task, Session, FilterParams } from '@/types';

const API_BASE = '/api';

// Sessions

export const getSessions = async (): Promise<Session[]> => {
  const response = await fetch(`${API_BASE}/sessions`);
  if (!response.ok) throw new Error('Failed to fetch sessions');
  return response.json();
};

export const createSession = async (data: { directory: string; titre: string }): Promise<Session> => {
  const response = await fetch(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create session');
  return response.json();
};

export const deleteSession = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE}/sessions/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete session');
};

// Tasks

export const getTasks = async (params: FilterParams = {}): Promise<Task[]> => {
  const query = new URLSearchParams();
  if (params.directory) query.append('directory', params.directory);
  if (params.status) query.append('status', params.status);
  if (params.limit) query.append('limit', params.limit.toString());
  
  const response = await fetch(`${API_BASE}/tasks?${query.toString()}`);
  if (!response.ok) throw new Error('Failed to fetch tasks');
  return response.json();
};

export const getTask = async (id: string): Promise<Task> => {
  const response = await fetch(`${API_BASE}/tasks/${id}`);
  if (!response.ok) throw new Error('Failed to fetch task');
  return response.json();
};

export const createTask = async (data: {
  sessionId: string;
  prompt: string;
  agent?: AgentType;
}): Promise<Task> => {
  const response = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create task');
  return response.json();
};

export const updateTask = async (id: string, data: Partial<Task>): Promise<Task> => {
  const response = await fetch(`${API_BASE}/tasks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update task');
  return response.json();
};

export const deleteTask = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE}/tasks/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete task');
};

export const archiveTask = async (id: string): Promise<Task> => {
  return updateTask(id, { status: 'pause' });
};

export const addSubtask = async (taskId: string, data: {
  prompt: string;
  agent?: AgentType;
}): Promise<{ subtask: Subtask; task: Task }> => {
  const response = await fetch(`${API_BASE}/tasks/${taskId}/subtasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to add subtask');
  const subtask = await response.json();
  const task = await getTask(taskId);
  return { subtask, task };
};
```

### 6. `src/hooks/useTasks.ts`
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  archiveTask,
  addSubtask,
  getSessions,
  createSession,
  deleteSession,
} from '@/api/client';
import { Task, Session, FilterParams } from '@/types';

export const useSessions = () => {
  return useQuery<Session[]>({
    queryKey: ['sessions'],
    queryFn: getSessions,
  });
};

export const useCreateSession = () => {
  const queryClient = useQueryClient();
  return useMutation<Session, Error, { directory: string; titre: string }>({
    mutationFn: createSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
};

export const useDeleteSession = () => {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: deleteSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
};

export const useTasks = (params: FilterParams = {}) => {
  return useQuery<Task[]>({
    queryKey: ['tasks', params],
    queryFn: () => getTasks(params),
  });
};

export const useTask = (id: string) => {
  return useQuery<Task>({
    queryKey: ['task', id],
    queryFn: () => getTask(id),
    enabled: !!id,
  });
};

export const useCreateTask = () => {
  const queryClient = useQueryClient();
  return useMutation<Task, Error, { sessionId: string; prompt: string; agent?: string }>({
    mutationFn: createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
};

export const useUpdateTask = () => {
  const queryClient = useQueryClient();
  return useMutation<Task, Error, { id: string; data: Partial<Task> }>({
    mutationFn: ({ id, data }) => updateTask(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task', id] });
    },
  });
};

export const useDeleteTask = () => {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
};

export const useArchiveTask = () => {
  const queryClient = useQueryClient();
  return useMutation<Task, Error, string>({
    mutationFn: archiveTask,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task', id] });
    },
  });
};

export const useAddSubtask = () => {
  const queryClient = useQueryClient();
  return useMutation<{ subtask: any; task: Task }, Error, { taskId: string; prompt: string; agent?: string }>({
    mutationFn: ({ taskId, ...data }) => addSubtask(taskId, data),
    onSuccess: (_, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
    },
  });
};
```

### 7. `src/components/StatusBadge.tsx`
```tsx
import { TaskStatus } from '@/types';

interface StatusBadgeProps {
  status: TaskStatus;
  className?: string;
}

const statusColors: Record<TaskStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  running: 'bg-blue-100 text-blue-800',
  success: 'bg-green-100 text-green-800',
  pause: 'bg-gray-100 text-gray-800',
  failed: 'bg-red-100 text-red-800',
  skipped: 'bg-orange-100 text-orange-800',
};

const statusLabels: Record<TaskStatus, string> = {
  pending: 'En attente',
  running: 'En cours',
  success: 'Terminé',
  pause: 'Archivé',
  failed: 'Échoué',
  skipped: 'Ignoré',
};

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const colorClass = statusColors[status] || 'bg-gray-100 text-gray-800';
  const label = statusLabels[status] || status;

  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium ${colorClass} ${className}`}
    >
      {label}
    </span>
  );
}
```

### 8. `src/components/TaskCard.tsx`
```tsx
import { Task } from '@/types';
import StatusBadge from './StatusBadge';

interface TaskCardProps {
  task: Task;
  onClick: () => void;
  onSkip?: () => void;
  onResume?: () => void;
  className?: string;
}

export default function TaskCard({ task, onClick, onSkip, onResume, className = '' }: TaskCardProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const truncate = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-lg shadow-md p-4 cursor-pointer hover:shadow-lg transition-shadow border border-gray-100 ${className}`}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex flex-wrap gap-1">
          <StatusBadge status={task.status} />
          <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
            {task.agent}
          </span>
        </div>
        <span className="text-xs text-gray-500">
          {task.sessionId.directory}
        </span>
      </div>
      
      <h3 className="font-semibold text-gray-900 mb-2">
        {task.sessionId.titre}
      </h3>
      
      <p className="text-sm text-gray-600 mb-3">
        {truncate(task.prompt, 150)}
      </p>
      
      <div className="flex justify-between items-center text-xs text-gray-500">
        <span>Créé: {formatDate(task.createdAt)}</span>
        {task.endDate && <span>Terminé: {formatDate(task.endDate)}</span>}
      </div>
      
      {task.subtasks && task.subtasks.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <span className="text-xs text-gray-500">
            {task.subtasks.length} sous-tâche(s)
          </span>
        </div>
      )}
      
      {/* Actions rapides */}
      <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2">
        {task.status === 'pause' && onResume && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onResume();
            }}
            className="flex-1 text-xs bg-green-100 text-green-700 py-1 px-2 rounded hover:bg-green-200 transition-colors"
          >
            ▶️ Reprendre
          </button>
        )}
        {(task.status === 'pending' || task.status === 'running') && onSkip && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSkip();
            }}
            className="flex-1 text-xs bg-orange-100 text-orange-700 py-1 px-2 rounded hover:bg-orange-200 transition-colors"
          >
            ⏭️ Ignorer
          </button>
        )}
      </div>
    </div>
  );
}
```

### 9. `src/components/TaskTable.tsx`
```tsx
import { Task } from '@/types';
import StatusBadge from './StatusBadge';

interface TaskTableProps {
  tasks: Task[];
  onRowClick: (task: Task) => void;
  onArchive: (taskId: string) => void;
  onSkip: (taskId: string) => void;
  onResume: (taskId: string) => void;
  onDelete: (taskId: string) => void;
}

export default function TaskTable({ 
  tasks, 
  onRowClick, 
  onArchive,
  onSkip,
  onResume,
  onDelete 
}: TaskTableProps) {
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const truncate = (text: string, maxLength: number = 80) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Projet
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Titre
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Prompt
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Agent
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Statut
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Créé
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Terminé
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {tasks.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                Aucune tâche trouvée
              </td>
            </tr>
          ) : (
            tasks.map((task) => (
              <tr
                key={task._id}
                onClick={() => onRowClick(task)}
                className="cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {task.sessionId.directory}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {task.sessionId.titre}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {truncate(task.prompt, 60)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                    {task.agent}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <StatusBadge status={task.status} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(task.createdAt)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(task.endDate)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  <div className="flex justify-end gap-2">
                    {task.status === 'pending' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onArchive(task._id);
                        }}
                        className="text-gray-400 hover:text-gray-600"
                        title="Archiver"
                      >
                        📦
                      </button>
                    )}
                    {task.status === 'pause' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onResume(task._id);
                        }}
                        className="text-green-400 hover:text-green-600"
                        title="Reprendre"
                      >
                        ▶️
                      </button>
                    )}
                    {(task.status === 'pending' || task.status === 'running') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSkip(task._id);
                        }}
                        className="text-orange-400 hover:text-orange-600"
                        title="Ignorer"
                      >
                        ⏭️
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(task._id);
                      }}
                      className="text-red-400 hover:text-red-600"
                      title="Supprimer"
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
```

### 10. `src/components/SubtaskCard.tsx`
```tsx
import { Subtask } from '@/types';
import StatusBadge from './StatusBadge';

interface SubtaskCardProps {
  subtask: Subtask;
  className?: string;
}

export default function SubtaskCard({ subtask, className = '' }: SubtaskCardProps) {
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className={`bg-gray-50 rounded-lg p-3 mb-2 border border-gray-200 ${className}`}>
      <div className="flex justify-between items-start mb-1">
        <div className="flex flex-wrap gap-1">
          <StatusBadge status={subtask.status} />
          <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
            {subtask.agent}
          </span>
        </div>
      </div>
      
      <p className="text-sm text-gray-700 mb-2">{subtask.prompt}</p>
      
      {subtask.result && (
        <div className="mt-2 p-2 bg-white rounded border border-gray-200">
          <pre className="text-xs text-gray-800 whitespace-pre-wrap">{subtask.result}</pre>
        </div>
      )}
      
      <div className="flex justify-between items-center text-xs text-gray-500 mt-2">
        <span>Créé: {formatDate(subtask.createdAt)}</span>
        {subtask.endDate && <span>Terminé: {formatDate(subtask.endDate)}</span>}
      </div>
    </div>
  );
}
```

### 11. `src/components/TaskDetailModal.tsx`
```tsx
import { useState } from 'react';
import { Task, AgentType } from '@/types';
import StatusBadge from './StatusBadge';
import SubtaskCard from './SubtaskCard';

interface TaskDetailModalProps {
  task: Task;
  onClose: () => void;
  onAddSubtask: (prompt: string, agent: AgentType) => void;
  onArchive: () => void;
  onSkip: () => void;
  onResume: () => void;
  onDelete: () => void;
}

export default function TaskDetailModal({
  task,
  onClose,
  onAddSubtask,
  onArchive,
  onSkip,
  onResume,
  onDelete,
}: TaskDetailModalProps) {
  const [newSubtaskPrompt, setNewSubtaskPrompt] = useState('');
  const [newSubtaskAgent, setNewSubtaskAgent] = useState<AgentType>(task.agent);
  const [showAddSubtask, setShowAddSubtask] = useState(false);

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSubtaskPrompt.trim()) {
      onAddSubtask(newSubtaskPrompt, newSubtaskAgent);
      setNewSubtaskPrompt('');
      setNewSubtaskAgent(task.agent);
      setShowAddSubtask(false);
    }
  };

  const agents: AgentType[] = ['claude', 'vibe', 'antigravity', 'hermes', 'opencode'];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{task.sessionId.titre}</h2>
            <div className="flex gap-2 mt-2">
              <StatusBadge status={task.status} />
              <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full">
                {task.agent}
              </span>
              <span className="px-3 py-1 bg-gray-100 text-gray-800 text-sm rounded-full">
                {task.sessionId.directory}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Prompt principal */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Prompt</h3>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <pre className="text-sm text-gray-800 whitespace-pre-wrap">{task.prompt}</pre>
            </div>
          </div>

          {/* Résultat */}
          {task.result && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Résultat</h3>
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <pre className="text-sm text-gray-800 whitespace-pre-wrap">{task.result}</pre>
              </div>
            </div>
          )}

          {/* Sous-tâches */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold text-gray-900">
                Sous-tâches ({task.subtasks?.length || 0})
              </h3>
              <button
                onClick={() => setShowAddSubtask(!showAddSubtask)}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
              >
                + Ajouter
              </button>
            </div>

            {/* Formulaire ajout sous-tâche */}
            {showAddSubtask && (
              <form onSubmit={handleAddSubtask} className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Agent
                  </label>
                  <select
                    value={newSubtaskAgent}
                    onChange={(e) => setNewSubtaskAgent(e.target.value as AgentType)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {agents.map((agent) => (
                      <option key={agent} value={agent}>
                        {agent}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prompt
                  </label>
                  <textarea
                    value={newSubtaskPrompt}
                    onChange={(e) => setNewSubtaskPrompt(e.target.value)}
                    rows={3}
                    placeholder="Décrivez la sous-tâche..."
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Créer
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddSubtask(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </form>
            )}

            {/* Liste des sous-tâches */}
            {task.subtasks?.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Aucune sous-tâche</p>
            ) : (
              task.subtasks?.map((subtask) => (
                <SubtaskCard key={subtask._id} subtask={subtask} />
              ))
            )}
          </div>

          {/* Métadonnées */}
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Créé:</span>
                <span className="ml-2 text-gray-900">{formatDate(task.createdAt)}</span>
              </div>
              {task.endDate && (
                <div>
                  <span className="text-gray-500">Terminé:</span>
                  <span className="ml-2 text-gray-900">{formatDate(task.endDate)}</span>
                </div>
              )}
              <div>
                <span className="text-gray-500">ID:</span>
                <span className="ml-2 text-gray-900 font-mono">{task._id}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
          {task.status === 'pending' && (
            <button
              onClick={onArchive}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              📦 Archiver
            </button>
          )}
          {task.status === 'pause' && (
            <button
              onClick={onResume}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              ▶️ Reprendre
            </button>
          )}
          {(task.status === 'pending' || task.status === 'running') && (
            <button
              onClick={onSkip}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
            >
              ⏭️ Ignorer
            </button>
          )}
          <button
            onClick={onDelete}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            🗑️ Supprimer
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 12. `src/components/FilterBar.tsx`
```tsx
import { useState, useEffect } from 'react';
import { TaskStatus } from '@/types';

interface FilterBarProps {
  directories: string[];
  selectedDirectory: string | undefined;
  selectedStatus: TaskStatus | undefined;
  onDirectoryChange: (directory: string | undefined) => void;
  onStatusChange: (status: TaskStatus | undefined) => void;
}

const statusOptions: { value: TaskStatus | undefined; label: string }[] = [
  { value: undefined, label: 'Tous les statuts' },
  { value: 'pending', label: 'En attente' },
  { value: 'running', label: 'En cours' },
  { value: 'success', label: 'Terminé' },
  { value: 'pause', label: 'Archivé' },
  { value: 'failed', label: 'Échoué' },
  { value: 'skipped', label: 'Ignoré' },
];

const statusColors: Record<TaskStatus, string> = {
  pending: 'text-yellow-600',
  running: 'text-blue-600',
  success: 'text-green-600',
  pause: 'text-gray-600',
  failed: 'text-red-600',
  skipped: 'text-orange-600',
};

export default function FilterBar({
  directories,
  selectedDirectory,
  selectedStatus,
  onDirectoryChange,
  onStatusChange,
}: FilterBarProps) {
  const [directoryOptions, setDirectoryOptions] = useState<string[]>([]);

  useEffect(() => {
    setDirectoryOptions(['Tous les projets', ...directories]);
  }, [directories]);

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-6 border border-gray-200">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Filtre par projet */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Projet
          </label>
          <select
            value={selectedDirectory || 'Tous les projets'}
            onChange={(e) => {
              const value = e.target.value === 'Tous les projets' ? undefined : e.target.value;
              onDirectoryChange(value);
            }}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {directoryOptions.map((dir) => (
              <option key={dir} value={dir}>
                {dir}
              </option>
            ))}
          </select>
        </div>

        {/* Filtre par statut */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Statut
          </label>
          <select
            value={selectedStatus || undefined}
            onChange={(e) => {
              const value = e.target.value === '' ? undefined : e.target.value as TaskStatus;
              onStatusChange(value);
            }}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {statusOptions.map((option) => (
              <option key={option.value || ''} value={option.value || ''}>
                <span className={option.value ? statusColors[option.value] : ''}>
                  {option.label}
                </span>
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
```

### 13. `src/components/NewTaskModal.tsx`
```tsx
import { useState } from 'react';
import { AgentType } from '@/types';

interface NewTaskModalProps {
  sessions: { _id: string; directory: string; titre: string }[];
  onClose: () => void;
  onCreate: (sessionId: string, prompt: string, agent: AgentType) => void;
}

const agents: AgentType[] = ['claude', 'vibe', 'antigravity', 'hermes', 'opencode'];

export default function NewTaskModal({ sessions, onClose, onCreate }: NewTaskModalProps) {
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<AgentType>('vibe');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSessionId && prompt.trim()) {
      onCreate(selectedSessionId, prompt, selectedAgent);
      setSelectedSessionId('');
      setPrompt('');
      setSelectedAgent('vibe');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Nouvelle tâche</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Projet / Session
            </label>
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="">Sélectionnez une session</option>
              {sessions.map((session) => (
                <option key={session._id} value={session._id}>
                  {session.directory} - {session.titre}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Agent
            </label>
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value as AgentType)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {agents.map((agent) => (
                <option key={agent} value={agent}>
                  {agent}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={5}
              placeholder="Décrivez votre requête IA..."
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              required
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Créer la tâche
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

### 14. `src/App.tsx`
```tsx
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useSessions,
  useTasks,
  useCreateTask,
  useDeleteTask,
  useArchiveTask,
  useAddSubtask,
  useCreateSession,
} from '@/hooks/useTasks';
import FilterBar from '@/components/FilterBar';
import TaskTable from '@/components/TaskTable';
import TaskCard from '@/components/TaskCard';
import TaskDetailModal from '@/components/TaskDetailModal';
import NewTaskModal from '@/components/NewTaskModal';
import { Task, TaskStatus, AgentType } from '@/types';

function App() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [selectedDirectory, setSelectedDirectory] = useState<string | undefined>();
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus | undefined>();

  // Données
  const { data: sessions = [] } = useSessions();
  const { data: tasks = [] } = useTasks({
    directory: selectedDirectory,
    status: selectedStatus,
    limit: 100,
  });

  // Mutations
  const createTaskMutation = useCreateTask();
  const deleteTaskMutation = useDeleteTask();
  const archiveTaskMutation = useArchiveTask();
  const addSubtaskMutation = useAddSubtask();
  const createSessionMutation = useCreateSession();
  const skipTaskMutation = useMutation<Task, Error, string>({
    mutationFn: async (taskId) => {
      const response = await fetch(`/api/tasks/${taskId}/skip`, {
        method: 'PATCH',
      });
      if (!response.ok) throw new Error('Failed to skip task');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task', selectedTask?._id] });
    },
  });
  const resumeTaskMutation = useMutation<Task, Error, string>({
    mutationFn: async (taskId) => {
      const response = await fetch(`/api/tasks/${taskId}/resume`, {
        method: 'PATCH',
      });
      if (!response.ok) throw new Error('Failed to resume task');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task', selectedTask?._id] });
    },
  });

  // Liste unique des directories
  const directories = Array.from(
    new Set(sessions.map((s) => s.directory).filter(Boolean))
  );

  // Handlers
  const handleRowClick = (task: Task) => {
    setSelectedTask(task);
  };

  const handleCloseDetail = () => {
    setSelectedTask(null);
  };

  const handleDeleteTask = async (taskId: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette tâche ?')) {
      try {
        await deleteTaskMutation.mutateAsync(taskId);
      } catch (err) {
        console.error('Error deleting task:', err);
      }
    }
  };

  const handleArchiveTask = async (taskId: string) => {
    try {
      await archiveTaskMutation.mutateAsync(taskId);
    } catch (err) {
      console.error('Error archiving task:', err);
    }
  };

  const handleSkipTask = async (taskId: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir ignorer cette tâche ?')) {
      try {
        await skipTaskMutation.mutateAsync(taskId);
      } catch (err) {
        console.error('Error skipping task:', err);
      }
    }
  };

  const handleResumeTask = async (taskId: string) => {
    try {
      await resumeTaskMutation.mutateAsync(taskId);
    } catch (err) {
      console.error('Error resuming task:', err);
    }
  };

  const handleAddSubtask = async (taskId: string, prompt: string, agent: AgentType) => {
    try {
      await addSubtaskMutation.mutateAsync({ taskId, prompt, agent });
      // Rafraîchir la tâche
      await queryClient.invalidateQueries({ queryKey: ['task', taskId] });
    } catch (err) {
      console.error('Error adding subtask:', err);
    }
  };

  const handleCreateTask = async (sessionId: string, prompt: string, agent: AgentType) => {
    try {
      await createTaskMutation.mutateAsync({ sessionId, prompt, agent });
      setShowNewTaskModal(false);
    } catch (err) {
      console.error('Error creating task:', err);
    }
  };

  const handleCreateSession = async () => {
    const directory = prompt('Nom du projet (directory):');
    if (!directory) return;
    
    const titre = prompt('Titre de la session:');
    if (!titre) return;

    try {
      await createSessionMutation.mutateAsync({ directory, titre });
    } catch (err) {
      console.error('Error creating session:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              AI Query Manager
            </h1>
            <p className="text-gray-500 mt-1">
              Gestion des requêtes IA avec {sessions.length} projet(s) et {tasks.length} tâche(s)
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreateSession}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
            >
              + Nouveau projet
            </button>
            <button
              onClick={() => setShowNewTaskModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              + Nouvelle tâche
            </button>
          </div>
        </header>

        {/* Barre de filtres */}
        <FilterBar
          directories={directories}
          selectedDirectory={selectedDirectory}
          selectedStatus={selectedStatus}
          onDirectoryChange={setSelectedDirectory}
          onStatusChange={setSelectedStatus}
        />

        {/* Boutons de vue */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setViewMode('table')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'table'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            📋 Tableau
          </button>
          <button
            onClick={() => setViewMode('cards')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'cards'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            🃏 Cartes
          </button>
        </div>

        {/* Contenu principal */}
        {viewMode === 'table' ? (
          <TaskTable
            tasks={tasks}
            onRowClick={handleRowClick}
            onArchive={handleArchiveTask}
            onSkip={handleSkipTask}
            onResume={handleResumeTask}
            onDelete={handleDeleteTask}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tasks.map((task) => (
              <TaskCard
                key={task._id}
                task={task}
                onClick={() => handleRowClick(task)}
                onSkip={() => handleSkipTask(task._id)}
                onResume={() => handleResumeTask(task._id)}
              />
            ))}
          </div>
        )}

        {/* Modales */}
        {showNewTaskModal && (
          <NewTaskModal
            sessions={sessions}
            onClose={() => setShowNewTaskModal(false)}
            onCreate={handleCreateTask}
          />
        )}

        {selectedTask && (
          <TaskDetailModal
            task={selectedTask}
            onClose={handleCloseDetail}
            onAddSubtask={(prompt, agent) => handleAddSubtask(selectedTask._id, prompt, agent)}
            onArchive={() => handleArchiveTask(selectedTask._id)}
            onSkip={() => handleSkipTask(selectedTask._id)}
            onResume={() => handleResumeTask(selectedTask._id)}
            onDelete={() => handleDeleteTask(selectedTask._id)}
          />
        )}
      </div>
    </div>
  );
}

export default App;
```

### 15. `src/main.tsx`
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './styles/globals.css';

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
```

### 16. `src/styles/globals.css`
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom styles */
@layer base {
  html {
    font-family: 'Inter', system-ui, sans-serif;
  }
  
  body {
    @apply bg-gray-50 text-gray-900;
  }
}

/* Scrollbar styling */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  @apply bg-gray-100 rounded-full;
}

::-webkit-scrollbar-thumb {
  @apply bg-gray-300 rounded-full hover:bg-gray-400;
}

/* Code blocks */
pre {
  @apply bg-gray-100 p-4 rounded-lg overflow-x-auto;
}

/* Focus visible */
:focus-visible {
  @apply outline-none ring-2 ring-blue-500 ring-offset-2;
}
```

---

## 🤖 Skill Interne : Gestion des Sous-Tâches

Crée un fichier **`skills/ai-subtask-manager/SKILL.md`** avec le contenu suivant :

```markdown
---
name: ai-subtask-manager
description: Permet aux agents IA de décomposer automatiquement les requêtes complexes en sous-tâches gérables
---

# AI Subtask Manager - Skill de Décomposition de Tâches

## 🎯 Objectif

Ce skill permet aux agents IA (Claude, Vibe, Antigravity, Hermès, OpenCode) de **décomposer automatiquement** les requêtes complexes en sous-tâches séquentielles, améliorant ainsi la qualité des résultats et la transparence du processus.

## 📋 Prompt System à Intégrer

### Version Longue (pour les agents avancés)

```
Tu es un assistant IA capable de décomposer les requêtes complexes en sous-tâches logiques et séquentielles.

### RÈGLES DE DÉCOMPOSITION :

1. **ANALYSE INITIALE** : Avant de répondre, évalue si la requête peut être traitée en une seule étape OU si elle nécessite une décomposition.

2. **CRITÈRES DE DÉCOMPOSITION** : Décompose la requête si :
   - Elle contient plusieurs actions distinctes (ex: "Analyse ce code ET propose des optimisations ET génère un test")
   - Elle implique plusieurs étapes logiques
   - Elle nécessite des données intermédiaires
   - Elle dépasse une complexité raisonnable pour une seule exécution

3. **FORMAT DES SOUS-TÂCHES** : Chaque sous-tâche doit être :
   - **Atomique** : Une seule action/question claire
   - **Indépendante** : Pouvoir être exécutée séparément
   - **Ordonnée** : Numérotée si l'ordre est important
   - **Précise** : Avec un objectif clair et mesurable

4. **STRUCTURE DE RÉPONSE** :
   Si décomposition nécessaire :
   ```
   [DECOMPOSITION_DETECTEE]
   
   **Tâche principale** : [répéter la requête originale]
   
   **Sous-tâches** :
   1. [Sous-tâche 1] - [Description claire]
   2. [Sous-tâche 2] - [Description claire]
   ...
   
   **Résultat final** : [Ce que la tâche principale doit produire]
   ```
   
   Si PAS de décomposition nécessaire :
   ```
   [TRAITEMENT_DIRECT]
   [Ta réponse normale]
   ```

5. **EXEMPLES** :
   
   Exemple 1 (Décomposition) :
   - Requête : "Analyse ce code Python, identifie les bugs, propose des corrections et optimise les performances"
   - Décomposition :
     1. Analyser le code pour identifier les bugs
     2. Proposer des corrections pour chaque bug
     3. Analyser les performances du code
     4. Proposer des optimisations
   
   Exemple 2 (Direct) :
   - Requête : "Quelle est la capital de la France ?"
   - Réponse : [TRAITEMENT_DIRECT] Paris

6. **BONNES PRATIQUES** :
   - Ne décompose pas les requêtes trop simples
   - Évite les sous-tâches trop vagues
   - Assure-toi que chaque sous-tâche a une valeur ajoutée
   - Si une sous-tâche dépend d'une autre, indique-le clairement

7. **INTÉGRATION AVEC LE SYSTÈME** :
   - Le système créera automatiquement les sous-tâches dans la base de données
   - Chaque sous-tâche sera exécutée séquentiellement
   - Les résultats seront agrégés pour la tâche principale
   - Tu peux référencer les résultats des sous-tâches précédentes

### Version Courte (pour les agents avec contexte limité)

```
Si la requête est complexe, décompose-la en sous-tâches avec le format :

[DECOMPOSITION_DETECTEE]
**Sous-tâches** :
1. [Action 1]
2. [Action 2]
...

Sinon, réponds normalement avec : [TRAITEMENT_DIRECT]
```

## 🔧 Intégration Technique

### Dans le Moteur IA (`aiEngine.js`)

Modifie la fonction `runAgent` pour détecter et traiter les décompositions :

```javascript
// Dans engine/agents/index.js
import { runVibe } from './vibe.js';
// ... autres imports

const agentRunners = {
  vibe: runVibe,
  claude: runClaude,
  // ...
};

/**
 * Détecte si la réponse contient une décomposition
 */
const detectSubtasks = (response) => {
  const decompositionPattern = /\[DECOMPOSITION_DETECTEE\]/;
  const subtaskPattern = /(\d+)\..*?(?=\n\d+\.|\n\*\*|$)/g;
  
  if (!decompositionPattern.test(response)) {
    return null;
  }
  
  const subtasks = [];
  const matches = response.match(subtaskPattern) || [];
  
  for (const match of matches) {
    const subtaskMatch = match.match(/^(\d+)\.(.*)/);
    if (subtaskMatch) {
      subtasks.push({
        order: parseInt(subtaskMatch[1]),
        prompt: subtaskMatch[2].trim()
      });
    }
  }
  
  return {
    needsDecomposition: true,
    subtasks: subtasks.sort((a, b) => a.order - b.order)
  };
};

/**
 * Exécute un agent avec détection de décomposition
 */
export const runAgentWithSubtaskDetection = async (agent, prompt, taskId) => {
  const runner = agentRunners[agent];
  if (!runner) {
    throw new Error(`Agent '${agent}' not supported`);
  }
  
  const result = await runner(prompt);
  
  // Détecter si l'agent a proposé une décomposition
  const decomposition = detectSubtasks(result.result || '');
  
  if (decomposition && decomposition.subtasks.length > 0) {
    // Créer les sous-tâches dans la base de données
    const Task = (await import('../models/Task.js')).default;
    const task = await Task.findById(taskId);
    
    if (task) {
      for (const subtask of decomposition.subtasks) {
        task.subtasks.push({
          prompt: subtask.prompt,
          agent: task.agent,
          status: 'pending',
          createdAt: new Date()
        });
      }
      await task.save();
      
      // Marquer la tâche principale comme en attente de sous-tâches
      return {
        ...result,
        hasSubtasks: true,
        subtaskCount: decomposition.subtasks.length
      };
    }
  }
  
  return result;
};
```

### Mise à jour du Moteur IA

Dans `aiEngine.js`, remplace l'appel à `runAgent` par `runAgentWithSubtaskDetection` :

```javascript
// Dans la fonction processTask
const result = await runAgentWithSubtaskDetection(task.agent, task.prompt, task._id);

// Si des sous-tâches ont été créées, ne pas marquer comme terminé
if (result.hasSubtasks) {
  const updateData = {
    status: 'running',  // Reste en running jusqu'à ce que toutes les sous-tâches soient terminées
    result: `[DECOMPOSITION] ${result.subtaskCount} sous-tâches créées`,
    executedByAgent: task.agent,
    updatedAt: new Date()
  };
  await Task.findByIdAndUpdate(task._id, updateData);
  return;  // Ne pas marquer comme terminé
}
```

## 📊 Statistiques et Métriques

Le système peut maintenant tracker :
- Combien de tâches ont été décomposées
- Quel agent propose le plus de décompositions
- Temps moyen d'exécution avec/sans décomposition
- Taux de succès des tâches décomposées vs directes

## 🎯 Avantages

✅ **Meilleure qualité** : Les requêtes complexes sont mieux traitées
✅ **Transparence** : L'utilisateur voit exactement quelles étapes sont exécutées
✅ **Reprise sur erreur** : Si une sous-tâche échoue, on peut la relancer séparément
✅ **Optimisation** : Les agents peuvent se spécialiser sur des sous-tâches spécifiques
✅ **Audit** : Historique complet de toutes les étapes de traitement

## 🔄 Workflow Complet

1. Utilisateur soumet une requête complexe
2. Agent IA détecte la nécessité de décomposition
3. Système crée automatiquement les sous-tâches
4. Moteur IA traite les sous-tâches séquentiellement
5. Résultats sont agrégés pour la tâche principale
6. Utilisateur voit le détail de chaque sous-tâche dans l'UI

---

## 📁 Structure complète des dossiers

```
ai-query-manager/
├── backend/
│   ├── package.json
│   ├── server.js
│   ├── config/
│   │   └── db.js
│   ├── models/
│   │   ├── Session.js
│   │   └── Task.js
│   ├── routes/
│   │   ├── sessions.js
│   │   └── tasks.js
│   ├── controllers/
│   │   ├── sessionController.js
│   │   └── taskController.js
│   └── .env
│
├── engine/
│   ├── package.json
│   ├── aiEngine.js
│   ├── agents/
│   │   ├── index.js
│   │   ├── claude.js
│   │   ├── vibe.js
│   │   ├── antigravity.js
│   │   ├── hermes.js
│   │   └── opencode.js
│   └── config/
│       └── agents.js
│
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── types/
        │   └── index.ts
        ├── api/
        │   └── client.ts
        ├── hooks/
        │   └── useTasks.ts
        ├── components/
        │   ├── StatusBadge.tsx
        │   ├── TaskCard.tsx
        │   ├── TaskTable.tsx
        │   ├── TaskDetailModal.tsx
        │   ├── SubtaskCard.tsx
        │   ├── FilterBar.tsx
        │   └── NewTaskModal.tsx
        └── styles/
            └── globals.css
```

---

## 🚀 Instructions de déploiement

### 1. Prérequis
- Node.js 18+ installé
- MongoDB installé et en cours d'exécution (`mongod`)
- Agents CLI installés et accessibles dans le PATH

### 2. Backend
```bash
cd backend
npm install
npm run dev  # ou npm start pour la production
```

Le backend sera disponible sur `http://localhost:3001`

### 3. Moteur IA
```bash
cd engine
npm install
npm run start
```

Le moteur tourera en arrière-plan et traitera les tâches automatiquement.

### 4. Frontend
```bash
cd frontend
npm install
npm run dev
```

Le frontend sera disponible sur **`http://localhost:3333`**

---

## ✨ **Nouveautés Ajoutées**

### 1. **Port Frontend Changé**
- ✅ Frontend maintenant sur **port 3333** (au lieu de 3000)
- Backend reste sur port 3001

### 2. **Fonctionnalités Skip & Resume**
- ✅ **Skip** : Permet d'ignorer une tâche en attente ou en cours (statut → `skipped`)
- ✅ **Resume** : Permet de reprendre une tâche en pause (statut → `pending`)
- Boutons disponibles dans la modale de détail de tâche
- Endpoints API : `PATCH /api/tasks/:id/skip` et `PATCH /api/tasks/:id/resume`
- Même fonctionnalité pour les sous-tâches

### 3. **Tracking des Agents Exécutants**
- ✅ Nouveau champ **`executedByAgent`** dans les tâches et sous-tâches
- Stocke quel agent CLI a effectivement exécuté la tâche
- Permet un suivi précis de l'utilisation des agents

### 4. **Skill Interne de Décomposition**
- ✅ **`ai-subtask-manager`** : Permet aux agents IA de décomposer automatiquement les requêtes complexes
- **Prompt System** intégré qui guide l'IA à détecter quand une décomposition est nécessaire
- Format standardisé : `[DECOMPOSITION_DETECTEE]` + liste des sous-tâches
- Création automatique des sous-tâches dans la base de données
- Intégration technique fournie pour le moteur IA

### 5. **Statut "Skipped"**
- ✅ Nouveau statut `skipped` pour les tâches/sous-tâches ignorées
- Affichage avec badge orange dans l'UI
- Filtre disponible dans la barre de filtres

---

## 🔧 Configuration supplémentaire

### Variables d'environnement

**Backend (`backend/.env`)** :
```
MONGODB_URI=mongodb://localhost:27017/ai_query_manager
PORT=3001
```

**Moteur IA (`engine/.env`)** :
```
MONGODB_URI=mongodb://localhost:27017/ai_query_manager
```

### Commandes CLI des agents

Modifie les fichiers dans `engine/agents/` pour correspondre à tes commandes CLI réelles. Par exemple :

- `claude.js` : `claude --prompt