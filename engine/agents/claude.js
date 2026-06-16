import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { getAgent } from '../config/agents.js';

/**
 * Wrapper Claude — lance `claude -p` avec le prompt en argument.
 * Utilise spawn avec stdin redirigé vers /dev/null pour éviter l'attente de 3s.
 */
export async function run(prompt, timeout) {
  const cfg = getAgent('claude');
  if (!cfg) {
    return { success: false, error: 'Claude CLI is not installed on this machine.' };
  }

  // Claude: claude -p --output-format {text|json} "prompt"
  const outputArgs = cfg.outputFmt === 'json' ? (cfg.jsonArgs || []) : [];
  const args = [...cfg.args, ...outputArgs, prompt];
  const ms = timeout ?? cfg.timeout;

  return new Promise((resolve) => {
    // Open /dev/null for stdin to prevent "no stdin data received" warning
    const nullFd = fs.openSync('/dev/null', 'r');
    
    const child = spawn(cfg.command, args, {
      stdio: [nullFd, 'pipe', 'pipe'],
      timeout: ms,
      killSignal: 'SIGTERM',
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => { stdout += data; });
    child.stderr.on('data', (data) => { stderr += data; });

    child.on('close', (code) => {
      fs.closeSync(nullFd);
      const rawOutput = stdout.trim();
      const stderrTrimmed = stderr.trim();
      
      if (code === 0) {
        resolve(parseResult(rawOutput, stderrTrimmed, cfg.outputFmt));
      } else {
        resolve({ success: false, error: stderrTrimmed || `Process exited with code ${code}` });
      }
    });

    child.on('error', (err) => {
      fs.closeSync(nullFd);
      resolve({ success: false, error: err.message || String(err) });
    });

    child.on('timeout', () => {
      child.kill('SIGTERM');
      fs.closeSync(nullFd);
      resolve({ success: false, error: `Agent timed out after ${ms}ms` });
    });
  });
}

/** Parse the agent output based on the configured format. */
function parseResult(stdout, stderr, outputFmt) {
  if (outputFmt === 'json') {
    try {
      const parsed = JSON.parse(stdout);
      // Claude: {result:{text:"..."}}, {result:"..."}
      const text = parsed?.result?.text ?? parsed?.result ?? '';
      return { success: true, result: String(text).trim(), raw: parsed };
    } catch {
      // JSON parse failed — return raw with warning
      return { success: true, result: stdout, error: 'Failed to parse JSON output' };
    }
  }
  // text mode
  return {
    success: true,
    result: stdout,
    error: stderr || undefined,
  };
}
