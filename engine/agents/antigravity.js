import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { getAgent } from '../config/agents.js';

/**
 * Antigravity CLI wrapper — uses `agy --print "prompt"`
 * Non-interactive mode via --print or -p flag.
 * Output is plain text on stdout.
 * Source: agy --help
 */
export async function run(prompt, timeout, cwd = process.cwd()) {
  const cfg = getAgent('antigravity');
  if (!cfg) {
    return { success: false, error: 'Antigravity CLI (agy) is not installed on this machine.' };
  }

  const args = [...cfg.args, prompt];
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
      if (code !== 0) {
        resolve({ success: false, error: stderr.trim() || `Agent exited with code ${code}` });
        return;
      }

      resolve({
        success: true,
        result: stdout.trim(),
        error: stderr.trim() || undefined,
      });
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
