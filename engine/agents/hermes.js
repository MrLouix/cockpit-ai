import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getAgent } from '../config/agents.js';

const execFileAsync = promisify(execFile);
const MAX_BUFFER = 50 * 1024 * 1024; // 50 MB

export async function run(prompt, timeout) {
  const cfg = getAgent('hermes');
  if (!cfg) {
    return { success: false, error: 'Hermes CLI is not installed on this machine.' };
  }

  const args = [...cfg.args, prompt];
  const ms = timeout ?? cfg.timeout;

  try {
    const { stdout, stderr } = await execFileAsync(cfg.command, args, {
      timeout: ms,
      maxBuffer: MAX_BUFFER,
      killSignal: 'SIGTERM',
    });

    return {
      success: true,
      result: stdout.trim(),
      error: stderr.trim() || undefined,
    };
  } catch (err) {
    if (err.code === 'ETIMEDOUT' || err.killed) {
      return { success: false, error: `Agent timed out after ${ms}ms` };
    }
    return { success: false, error: err.message || String(err) };
  }
}
