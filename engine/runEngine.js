#!/usr/bin/env node

/**
 * AI Query Manager - Engine Entry Point
 * 
 * Starts the AI Engine which:
 * - Connects to Redis
 * - Runs a BullMQ Worker on the cockpitai:tasks queue
 * - Dispatches tasks to configured AI agents
 * - Saves results back to Redis
 */

import { startEngine } from './aiEngine.js';

startEngine().catch(err => {
  console.error('Failed to start AI Engine:', err);
  process.exit(1);
});
