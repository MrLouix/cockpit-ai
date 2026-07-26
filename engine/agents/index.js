import { runClaude } from './claude.js';
import { runVibe } from './vibe.js';
import { runAntigravity } from './antigravity.js';
import { runHermes } from './hermes.js';
import { runOpencode } from './opencode.js';
import { RATE_LIMIT_PATTERNS } from '../config/agents.js';

const agentRunners = {
  claude: runClaude,
  vibe: runVibe,
  antigravity: runAntigravity,
  hermes: runHermes,
  opencode: runOpencode,
};

/**
 * Check if an error string matches any rate limit pattern for the given agent.
 */
function isRateLimitError(agent, errorStr) {
  if (!errorStr) return false;
  const patterns = RATE_LIMIT_PATTERNS[agent] || [];
  return patterns.some(({ pattern }) => pattern.test(errorStr));
}

export const runAgent = async (agent, prompt, options = {}) => {
  const runner = agentRunners[agent];
  if (!runner) throw new Error(`Agent '${agent}' not supported`);
  const result = await runner(prompt, options);

  // Classify errors: add errorType field
  if (!result.success) {
    const errorText = result.error || '';
    result.errorType = isRateLimitError(agent, errorText) ? 'rate_limit' : 'generic';
  }

  return result;
};

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
