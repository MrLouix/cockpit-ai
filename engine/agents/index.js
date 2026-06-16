import { getAgent } from '../config/agents.js';
import * as claude from './claude.js';
import * as vibe from './vibe.js';
import * as antigravity from './antigravity.js';
import * as hermes from './hermes.js';
import * as opencode from './opencode.js';

const agentModules = {
  claude,
  vibe,
  antigravity,
  hermes,
  opencode,
};

/**
 * Unified function to run any agent by name.
 * Uses config/agents.js for command resolution.
 * If the wrapper's config is not installed (ag, opencode), returns graceful error.
 * @param {string} agentName - The name of the agent to run.
 * @param {string} prompt - The prompt to send to the agent.
 * @returns {Promise<{success: boolean, result: string, error?: string}>}
 */
export async function runAgent(agentName, prompt) {
  const cfg = getAgent(agentName);
  if (!cfg) {
    return { success: false, error: `Unknown or uninstalled agent: ${agentName}` };
  }

  const module = agentModules[agentName];
  if (!module || typeof module.run !== 'function') {
    return { success: false, error: `No module found for agent: ${agentName}` };
  }

  return module.run(prompt, cfg.timeout);
}

/**
 * Parses response for [DECOMPOSITION_DETECTEE] marker and extracts subtask list.
 * @param {string} response - The agent's response string.
 * @returns {string[] | null} - Array of subtasks or null if none found.
 */
export function detectSubtasks(response) {
  if (!response || typeof response !== 'string') return null;

  const marker = '[DECOMPOSITION_DETECTEE]';
  const idx = response.indexOf(marker);
  if (idx === -1) return null;

  const afterMarker = response.slice(idx + marker.length).trim();
  if (!afterMarker) return null;

  const subtasks = [];
  const lines = afterMarker.split('\n');
  for (const line of lines) {
    const trimmed = line.replace(/^[\s\-*\d.)#]+/, '').trim();
    if (trimmed) {
      subtasks.push(trimmed);
    }
  }
  return subtasks.length > 0 ? subtasks : null;
}
