import { getAgent } from '../config/agents.js';

/**
 * Antigravity CLI wrapper — not installed on this machine.
 * Returns a clear error so the engine can skip gracefully.
 */
export async function run(_prompt, _timeout) {
  const cfg = getAgent('antigravity');
  if (!cfg) {
    return { success: false, error: 'Antigravity CLI (ag) is not installed on this machine.' };
  }
  // If added later, the generic runner pattern from other agents applies here.
  return { success: false, error: 'Antigravity CLI wrapper not yet implemented.' };
}
