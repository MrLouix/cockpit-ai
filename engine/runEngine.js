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

import './aiEngine.js';
