#!/usr/bin/env node

/**
 * AI Query Manager - Engine Entry Point
 * 
 * Starts the AI Engine which:
 * - Connects to MongoDB
 * - Polls for pending tasks
 * - Dispatches tasks to configured AI agents
 * - Saves results back to MongoDB
 */

import { startEngine } from './aiEngine.js';

startEngine().catch(err => {
  console.error('Failed to start AI Engine:', err);
  process.exit(1);
});
