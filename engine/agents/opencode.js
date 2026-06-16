import { getAgent } from '../config/agents.js';

/**
 * OpenCode CLI wrapper — not installed on this machine.
 */
export async function run(_prompt, _timeout) {
  const cfg = getAgent('opencode');
  if (!cfg) {
    return { success: false, error: 'OpenCode CLI is not installed on this machine.' };
  }
  return { success: false, error: 'OpenCode CLI wrapper not yet implemented.' };
}
