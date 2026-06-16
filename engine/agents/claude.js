import { spawn } from 'node:child_process';
import { getAgent } from '../config/agents.js';

const MAX_BUFFER = 50 * 1024 * 1024; // 50 MB

/**
 * Wrapper Claude — lance `claude -p` avec le prompt sur stdin.
 * Claude -p lit le prompt depuis stdin, pas en argument.
 */
export async function run(prompt, timeout) {
  const cfg = getAgent('claude');
  if (!cfg) {
    return { success: false, error: 'Claude CLI is not installed on this machine.' };
  }

  // Claude: echo "prompt" | claude -p --output-format {text|json}
  const outputArgs = cfg.outputFmt === 'json' ? (cfg.jsonArgs || []) : [];
  const args = [...cfg.args, ...outputArgs];
  const ms = timeout ?? cfg.timeout;

  return new Promise((resolve) => {
    const child = spawn(cfg.command, args, {
      timeout: ms,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    const timeoutId = setTimeout(() => {
      child.kill('SIGTERM');
      resolve({ success: false, error: `Agent timed out after ${ms}ms` });
    }, ms);

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    // Write prompt to stdin then close
    child.stdin.write(prompt);
    child.stdin.end();

    child.on('close', (code) => {
      clearTimeout(timeoutId);
      if (code !== 0 && code !== null && stdout.trim() === '') {
        resolve({ success: false, error: stderr.trim() || `Process exited with code ${code}` });
        return;
      }
      resolve(parseResult(stdout.trim(), stderr.trim(), cfg.outputFmt));
    });

    child.on('error', (err) => {
      clearTimeout(timeoutId);
      resolve({ success: false, error: err.message || String(err) });
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
