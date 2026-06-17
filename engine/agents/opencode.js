import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { getAgent } from '../config/agents.js';

/**
 * OpenCode CLI wrapper.
 * Uses: opencode run --format {json|default} "prompt"
 */
export async function run(prompt, timeout, cwd = process.cwd()) {
  const cfg = getAgent('opencode');
  if (!cfg) {
    return { success: false, error: 'OpenCode CLI is not installed on this machine.' };
  }

  // opencode run --format json "prompt"
  const outputArgs = cfg.outputFmt === 'json' ? (cfg.jsonArgs || []) : ['--format', 'default'];
  const args = ['run', ...outputArgs, prompt];
  const ms = timeout ?? cfg.timeout;

  return new Promise((resolve) => {
    // Open /dev/null for stdin to prevent "no stdin data received" warning
    const nullFd = fs.openSync('/dev/null', 'r');
    
    const child = spawn(cfg.command, args, {
      stdio: [nullFd, 'pipe', 'pipe'],
      timeout: ms,
      killSignal: 'SIGTERM',
      cwd,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => { stdout += data; });
    child.stderr.on('data', (data) => { stderr += data; });

    child.on('close', (code) => {
      fs.closeSync(nullFd);
      const rawOutput = stdout.trim();
      const stderrTrimmed = stderr.trim();

      if (code !== 0) {
        resolve({ success: false, error: stderrTrimmed || `Agent exited with code ${code}` });
        return;
      }

      resolve(parseResult(rawOutput, stderrTrimmed, cfg.outputFmt));
    });

    child.on('error', (err) => {
      fs.closeSync(nullFd);
      if (err.code === 'ETIMEDOUT' || err.killed) {
        resolve({ success: false, error: `Agent timed out after ${ms}ms` });
        return;
      }
      resolve({ success: false, error: err.message || String(err) });
    });
  });
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
