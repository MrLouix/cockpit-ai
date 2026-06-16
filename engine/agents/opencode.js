import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getAgent } from '../config/agents.js';

const execFileAsync = promisify(execFile);
const MAX_BUFFER = 50 * 1024 * 1024; // 50 MB

/**
 * OpenCode CLI wrapper.
 * Uses: opencode run --format {json|default} "prompt"
 */
export async function run(prompt, timeout) {
  const cfg = getAgent('opencode');
  if (!cfg) {
    return { success: false, error: 'OpenCode CLI is not installed on this machine.' };
  }

  // opencode run --format json "prompt"
  const outputArgs = cfg.outputFmt === 'json' ? (cfg.jsonArgs || []) : ['--format', 'default'];
  const args = ['run', ...outputArgs, prompt];
  const ms = timeout ?? cfg.timeout;

  try {
    const { stdout, stderr } = await execFileAsync(cfg.command, args, {
      timeout: ms,
      maxBuffer: MAX_BUFFER,
      killSignal: 'SIGTERM',
    });

    const rawOutput = stdout.trim();
    return parseResult(rawOutput, stderr.trim(), cfg.outputFmt);
  } catch (err) {
    if (err.code === 'ETIMEDOUT' || err.killed) {
      return { success: false, error: `Agent timed out after ${ms}ms` };
    }
    return { success: false, error: err.message || String(err) };
  }
}

/** Parse the agent output based on the configured format. */
function parseResult(stdout, stderr, outputFmt) {
  if (outputFmt === 'json') {
    try {
      // OpenCode JSON output is a stream of JSON events
      // We need to extract the assistant message content
      // This may need adjustment based on actual output format
      const parsed = JSON.parse(stdout);
      const text = parsed?.content ?? parsed?.text ?? stdout;
      return { success: true, result: String(text).trim(), raw: parsed };
    } catch {
      return { success: true, result: stdout, error: 'Failed to parse JSON output' };
    }
  }
  return {
    success: true,
    result: stdout,
    error: stderr || undefined,
  };
}
